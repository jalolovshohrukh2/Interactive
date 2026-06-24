# Cloud sync setup (Neon + Vercel)

The app is **local-first** — it works fully offline with no setup. Cloud sync is
optional and lets you reach your projects from any device. Turning it on takes
two accounts (both have free tiers): **Neon** (the database) and **Vercel**
(hosts the app + the API that talks to Neon).

## 1. Create the database (Neon)

1. Sign up at <https://neon.tech> and create a project.
2. In **Connection Details**, copy the **Pooled connection** string. It looks like:
   `postgres://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
3. That's it — the `projects` table is created automatically on first use.

## 2. Deploy the app (Vercel)

1. Push this repo to GitHub.
2. At <https://vercel.com> → **Add New… → Project** → import the repo.
   Vercel auto-detects Vite (build `vite build`, output `dist`) and turns the
   files in `/api` into serverless functions. No extra config needed.
3. In **Settings → Environment Variables**, add:
   - `DATABASE_URL` → the Neon pooled string from step 1.
   - `APP_TOKEN` → any long random string. This is your sync passphrase
     (leave it out to run with no auth — not recommended).
4. **Deploy.**

## 3. Connect from the app

1. Open your deployed URL.
2. Click the **cloud icon** (top-right) → enter your `APP_TOKEN` passphrase → **Connect**.
3. Edits now auto-save to the cloud. The status dot shows **green = synced**,
   **amber = saving/offline**, **red = error**.
4. On another device: open the URL, Connect, then **open your project** from the
   list in the cloud panel.

## Local development with cloud

Plain `npm run dev` runs the UI only — the cloud panel will say it can't reach
the API (that's expected; the app still works locally). To run the API locally:

```bash
npm i -g vercel
vercel link
# create .env.local from .env.example with your DATABASE_URL + APP_TOKEN
vercel dev          # serves the app AND /api together
```

## Notes / limits

- **Images** are stored inline as data URLs in a Postgres `text` column by
  default. For large renders, add **Vercel Blob**: in the Vercel dashboard go to
  **Storage → create a Blob store** (it injects `BLOB_READ_WRITE_TOKEN`
  automatically). Once that token is present, images over ~1MB are uploaded to
  Blob and only their URL is stored in Neon — no code changes needed.
- **Locally**, images are kept in **IndexedDB** (not localStorage), so large
  floor-plan images persist across refresh without hitting the ~5MB cap.
- **Sync model (v1):** edits push automatically; pulling another project is
  explicit (you open it from the cloud list) so local work is never silently
  overwritten. Conflicts resolve last-write-wins by `updated_at`.
- **Auth** is a single shared passphrase (`APP_TOKEN`) — right for a single
  user. Multi-user accounts would add a real auth provider.
