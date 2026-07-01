# WTL66998 — Supabase + Vercel Setup Guide

This turns your existing single-file site (`index.html`) into a site where
the "edit" form saves to a real database (Supabase), so every visitor sees
the same up-to-date content, permanently — not just in one browser.

Everything below uses **free tiers only** (Supabase Free + Vercel Hobby).

---

## Part 1 — Create the Supabase project

1. Go to https://supabase.com → **Start your project** → sign in (GitHub works).
2. Click **New project**.
   - Name: anything, e.g. `wtl66998`
   - Database password: pick a strong one and save it somewhere (you won't need it for this app, but keep it).
   - Region: pick the one closest to your users (e.g. `Mumbai` / `Singapore` for India).
3. Wait ~1–2 minutes while the project is provisioned.

## Part 2 — Create the table

1. In the left sidebar, click **SQL Editor** → **New query**.
2. Open `supabase_schema.sql` (included in this folder), copy its entire contents,
   paste into the query editor, and click **Run**.
3. You should see "Success. No rows returned." That means the table
   `site_content`, its security policies, and two starter rows
   (`rules_ta`, `rules_en`) were created.
4. Optional check: click **Table Editor** in the sidebar → you should see
   `site_content` with 2 rows.

## Part 3 — Get your URL and Anon Key

1. In the left sidebar, click the **gear icon** → **Project Settings** → **API**.
2. Copy these two values:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`
3. Open `index.html` in a text editor and find this block (near the top of
   the big `<script>` tag, search for `SUPABASE_URL`):

   ```js
   const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```

4. Replace the two placeholder strings with the values you copied, e.g.:

   ```js
   const SUPABASE_URL = 'https://abcdefghij.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```

5. Save the file. **This anon key is meant to be public** — Supabase is
   designed so this key can safely live in client-side code. Real
   protection comes from the RLS policies in the SQL file, not from hiding
   this key.

## Part 4 — Test it locally

1. Just double-click `index.html` to open it in a browser (or use any
   local web server). Open the browser console (F12) — you should NOT see
   "Supabase init failed" errors.
2. Open the edit entry point in the app, enter the admin password
   (`Adithya@0303` by default — change this in the code if you want),
   edit a rule, and click **Save**.
3. You should see "✅ Guidelines saved!". Refresh the page — your edit
   should still be there (it's now in the database, not just your browser).
4. Open the page in a second browser (or incognito window) — you should
   see the same edited content.

## Part 5 — Deploy to Vercel (so it's publicly accessible)

You only have one static file, so this is quick. Pick **either** option:

### Option A — Vercel dashboard (no command line)

1. Go to https://vercel.com → sign up / log in (GitHub login is easiest).
2. Click **Add New...** → **Project**.
3. If your code is on GitHub: push this folder (`index.html` +
   `supabase_schema.sql` is fine to include, it's just reference SQL) to a
   new GitHub repo, then **Import** that repo in Vercel.
   - Framework preset: choose **Other** (it's a static site).
   - Build command: leave empty.
   - Output directory: leave empty (Vercel will serve `index.html` as-is).
4. Click **Deploy**. After ~30 seconds you'll get a live URL like
   `https://wtl66998.vercel.app`.

### Option B — Vercel CLI (faster if you're comfortable with a terminal)

```bash
npm install -g vercel        # one-time install
cd path/to/this/folder       # the folder containing index.html
vercel login                 # follow the browser prompt
vercel --prod                # deploy straight to production
```

Vercel will print your live URL at the end, e.g.
`https://wtl66998.vercel.app`.

That's it — anyone who visits that URL now sees the live content from
Supabase, and any edit made through the password-protected edit form is
saved permanently and shown to every visitor.

---

## How the CRUD works in the code

All database access goes through four small helper functions in
`index.html` (search for `GENERIC CRUD HELPERS`):

| Function                  | SQL equivalent                          | Used for |
|----------------------------|------------------------------------------|----------|
| `dbInsert(key, value)`     | `INSERT INTO site_content ...`           | Creating a brand-new content key |
| `dbSelect(key)`            | `SELECT * FROM site_content WHERE ...`   | Loading content when the page opens |
| `dbUpsert(key, value)`     | `INSERT ... ON CONFLICT ... UPDATE`      | What the **Save** button calls — creates the row the first time, updates it every time after |
| `dbDelete(key)`            | `DELETE FROM site_content WHERE ...`     | Removing a content key entirely (not wired to any button by default, but ready to use) |

The page loads all rows once (`loadContentFromSupabase`) and also opens a
realtime subscription (`subscribeToContentChanges`) so other open tabs
update live when someone else saves a change.

---

## Important security note (please read)

The admin password in the page (`Adithya@0303`) only hides the **edit UI**.
It is **not** real authentication — because the Supabase anon key in the
HTML can write to the table directly via the API, a technically inclined
visitor could bypass the password and edit the data anyway. For a low-stakes
community rules page this is usually an acceptable trade-off for
simplicity and zero backend cost. If you later want real protection:

- Add Supabase Auth (email/password or magic link) and change the RLS
  write policies to `using (auth.uid() is not null)` instead of `true`, or
- Move writes behind a Supabase Edge Function / Vercel Serverless
  Function that checks a secret server-side before writing.

Both of these are bigger changes than what's in this guide — ask if you'd
like help setting either one up.
