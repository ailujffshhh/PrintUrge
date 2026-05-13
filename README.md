# PrintUrge
Ordering System for Printing Shops

## PHP API + External Database

The browser now calls PHP endpoints in `api/` for login, signup, print requests, and admin request management.

Use an external PostgreSQL database such as Supabase. Run `database/printurge.postgres.sql` in that database, then set `DATABASE_URL` on the PHP host when possible:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

If `DATABASE_URL` is not set, `database/db.php` uses the existing Supabase connection string as a fallback.
