require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const ROOT = path.join(__dirname, "..");
const UPLOAD_DIR = path.join(ROOT, "uploads", "print-requests");

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "printurge",
  waitForConnections: true,
  connectionLimit: 10,
});

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "").slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "") || ".bin";
    cb(null, `${crypto.randomBytes(18).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 12 },
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authOptional(req, _res, next) {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) {
    try {
      req.auth = jwt.verify(h.slice(7), JWT_SECRET);
    } catch (_) {
      req.auth = null;
    }
  }
  next();
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    req.auth = jwt.verify(h.slice(7), JWT_SECRET);
    return next();
  } catch (_) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  return next();
}

async function loadUserContext(userId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.status, u.archived_at, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
  };
}

function parseIntField(v, fallback) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function saveUploadedFiles(files) {
  const list = [];
  for (const f of files || []) {
    list.push({
      storedName: f.filename,
      originalName: f.originalname,
      mime: f.mimetype || "",
      size: f.size || 0,
    });
  }
  return list;
}

async function handlePrintRequestCreate(req, res, { forceUserId, attachUploader }) {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ error: "At least one file is required" });
  }

  const service = String(req.body.service || "").trim().slice(0, 64);
  if (!service) {
    return res.status(400).json({ error: "service is required" });
  }

  const colorMode = String(req.body.colorMode || "").trim().slice(0, 64) || null;
  const sizeKey = String(req.body.size || "").trim().slice(0, 64) || null;
  const copies = parseIntField(req.body.copies, 1);
  const pages = parseIntField(req.body.pages, 1);
  const customWidth =
    req.body.customWidth != null && String(req.body.customWidth).trim() !== ""
      ? String(req.body.customWidth).trim().slice(0, 32)
      : null;
  const customHeight =
    req.body.customHeight != null && String(req.body.customHeight).trim() !== ""
      ? String(req.body.customHeight).trim().slice(0, 32)
      : null;

  let userId = null;
  if (forceUserId !== undefined) {
    userId = forceUserId;
  } else if (attachUploader && req.auth && req.auth.sub) {
    const u = await loadUserContext(req.auth.sub);
    if (u && u.status === "active" && !u.archived_at) {
      userId = u.id;
    }
  }

  const filesJson = JSON.stringify(await saveUploadedFiles(files));

  const [result] = await pool.execute(
    `INSERT INTO print_requests
      (user_id, service, color_mode, size_key, copies, pages, custom_width, custom_height, files_json, admin_notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), NULL, 'active')`,
    [userId, service, colorMode, sizeKey, copies, pages, customWidth, customHeight, filesJson]
  );

  return res.status(201).json({
    id: result.insertId,
    message: "Print request created",
  });
}

/* ── Auth ───────────────────────────────────────────────────────── */
app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 160);
    const email = String(req.body.email || "").trim().toLowerCase().slice(0, 255);
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 8) {
      return res.status(400).json({ error: "Name, email, and password (8+ chars) are required" });
    }

    const hash = await bcrypt.hash(password, 10);
    try {
      const [r] = await pool.execute(
        "INSERT INTO users (role_id, name, email, password_hash, status) VALUES (3, ?, ?, ?, 'active')",
        [name, email, hash]
      );
      const user = await loadUserContext(r.insertId);
      const token = signToken({ sub: user.id, role: user.role });
      return res.status(201).json({ token, user: mapUserRow(user) });
    } catch (e) {
      if (e && e.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Email already registered" });
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.password_hash, u.status, u.archived_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const row = rows[0];
    if (!row) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (row.archived_at) {
      return res.status(403).json({ error: "Account archived" });
    }
    if (row.status !== "active") {
      return res.status(403).json({ error: "Account disabled" });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);

    const token = signToken({ sub: row.id, role: row.role });
    return res.json({
      token,
      user: { id: row.id, name: row.name, email: row.email, role: row.role, status: row.status },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await loadUserContext(req.auth.sub);
    if (!user || user.archived_at || user.status !== "active") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json({ user: mapUserRow(user) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Public print requests ──────────────────────────────────────── */
app.post("/api/print-requests", authOptional, upload.array("files", 12), async (req, res) => {
  try {
    return await handlePrintRequestCreate(req, res, { forceUserId: undefined, attachUploader: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Admin: print requests (CRUA) ───────────────────────────────── */
app.get("/api/admin/print-requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "active");
    let where = "WHERE 1=1";
    const params = [];
    if (status === "active") {
      where += " AND pr.status = 'active'";
    } else if (status === "archived") {
      where += " AND pr.status = 'archived'";
    }

    const [rows] = await pool.execute(
      `SELECT pr.id, pr.service, pr.status, pr.created_at, pr.archived_at,
              pr.copies, pr.pages, pr.color_mode, pr.size_key,
              u.name AS user_name, u.email AS user_email
       FROM print_requests pr
       LEFT JOIN users u ON u.id = pr.user_id
       ${where}
       ORDER BY pr.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json({ items: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/print-requests/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const [rows] = await pool.execute(
      `SELECT pr.*, u.name AS user_name, u.email AS user_email
       FROM print_requests pr
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE pr.id = ?
       LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: "Not found" });
    }
    let files = [];
    try {
      files = typeof row.files_json === "string" ? JSON.parse(row.files_json) : row.files_json;
    } catch (_) {
      files = [];
    }
    const payload = {
      ...row,
      files_json: undefined,
      files,
    };
    return res.json({ item: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/print-requests", requireAuth, requireAdmin, upload.array("files", 12), async (req, res) => {
  try {
    const raw = req.body.userId;
    let forceUserId;
    if (raw != null && String(raw).trim() !== "") {
      const n = Number(raw);
      forceUserId = Number.isFinite(n) ? n : null;
    } else {
      forceUserId = null;
    }
    return await handlePrintRequestCreate(req, res, { forceUserId, attachUploader: false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/admin/print-requests/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const body = req.body || {};
    const fields = [];
    const values = [];

    const setIf = (col, val, transform) => {
      if (val === undefined) return;
      fields.push(`${col} = ?`);
      values.push(transform ? transform(val) : val);
    };

    setIf("service", body.service, (v) => String(v).trim().slice(0, 64));
    setIf("color_mode", body.color_mode, (v) => (v == null || v === "" ? null : String(v).trim().slice(0, 64)));
    setIf("size_key", body.size_key, (v) => (v == null || v === "" ? null : String(v).trim().slice(0, 64)));
    if (body.copies !== undefined) {
      fields.push("copies = ?");
      values.push(parseIntField(body.copies, 1));
    }
    if (body.pages !== undefined) {
      fields.push("pages = ?");
      values.push(parseIntField(body.pages, 1));
    }
    setIf("custom_width", body.custom_width, (v) => (v == null || v === "" ? null : String(v).trim().slice(0, 32)));
    setIf("custom_height", body.custom_height, (v) => (v == null || v === "" ? null : String(v).trim().slice(0, 32)));
    if (body.admin_notes !== undefined) {
      fields.push("admin_notes = ?");
      values.push(body.admin_notes == null ? null : String(body.admin_notes).slice(0, 8000));
    }

    if (!fields.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);
    const [result] = await pool.execute(`UPDATE print_requests SET ${fields.join(", ")} WHERE id = ?`, values);
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/print-requests/:id/archive", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const [result] = await pool.execute(
      "UPDATE print_requests SET status = 'archived', archived_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'",
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Not found or already archived" });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/print-requests/:id/restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const [result] = await pool.execute(
      "UPDATE print_requests SET status = 'active', archived_at = NULL WHERE id = ? AND status = 'archived'",
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Not found or not archived" });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/files/:storedName", requireAuth, requireAdmin, (req, res) => {
  const storedName = String(req.params.storedName || "");
  if (!/^[a-f0-9]{36}(\.[a-zA-Z0-9._-]{1,24})?$/i.test(storedName)) {
    return res.status(400).json({ error: "Invalid file name" });
  }
  const filePath = path.join(UPLOAD_DIR, path.basename(storedName));
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(400).json({ error: "Invalid path" });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Missing file" });
  }
  return res.sendFile(filePath);
});

/* ── Static site ────────────────────────────────────────────────── */
app.use("/uploads", express.static(path.join(ROOT, "uploads"), { fallthrough: true }));
app.use(express.static(ROOT, { extensions: ["html"] }));

ensureUploadDir();

app.listen(PORT, () => {
  console.log(`PrintUrge server http://localhost:${PORT}`);
});
