# PrintUrge
Ordering System for Printing Shops

## PHP API + External Database

The browser now calls PHP endpoints in `api/` for login, signup, print requests, and admin request management.

Use an external PostgreSQL database such as Supabase. The app is configured for the Supabase transaction pooler. Run `database/printurge.postgres.sql` in that database, then set these Vercel environment variables:

```text
DATABASE_URL=postgresql://postgres.uyqgehcwduzafpdexpag:YOUR-PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
PRINTURGE_JWT_SECRET=use-a-long-random-secret
```

If you do not want to set the full `DATABASE_URL`, set `SUPABASE_DB_PASSWORD` instead. `database/db.php` already has these transaction pooler defaults:

```text
SUPABASE_DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
SUPABASE_DB_PORT=6543
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.uyqgehcwduzafpdexpag
```

Vercel uses the PHP community runtime configured in `vercel.json`. Uploaded files are stored in the external PostgreSQL database so Vercel does not need persistent local storage.

The admin page is available at `/pages/admin.html` and `/admin`.

Before deploying:

1. Run `database/printurge.postgres.sql` in Supabase or your PostgreSQL database.
2. Add `DATABASE_URL` and `PRINTURGE_JWT_SECRET` in Vercel Project Settings > Environment Variables.
3. Create at least one admin user by setting that user's `role_id` to `1`.
