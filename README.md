# PrintUrge
Ordering System for Printing Shops

## PHP API + External Database

The browser now calls PHP endpoints in `api/` for login, signup, print requests, and admin request management.

Use an external PostgreSQL database such as Supabase. Run `database/printurge.postgres.sql` in that database, then set these Vercel environment variables:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
PRINTURGE_JWT_SECRET=use-a-long-random-secret
```

If `DATABASE_URL` is not set, `database/db.php` uses the existing Supabase connection string as a fallback.

Vercel uses the PHP community runtime configured in `vercel.json`. Uploaded files are stored in the external PostgreSQL database so Vercel does not need persistent local storage.

The admin page is available at `/pages/admin.html` and `/admin`.

Before deploying:

1. Run `database/printurge.postgres.sql` in Supabase or your PostgreSQL database.
2. Add `DATABASE_URL` and `PRINTURGE_JWT_SECRET` in Vercel Project Settings > Environment Variables.
3. Create at least one admin user by setting that user's `role_id` to `1`.
