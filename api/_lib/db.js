// Shared helpers for the serverless API. Files under api/_lib are NOT routed
// as endpoints (the leading underscore tells Vercel to skip them).
import { neon } from '@neondatabase/serverless';

let _sql;
// Lazily create the Neon client. Throws if DATABASE_URL is missing so callers
// can return a clean "cloud not configured" response.
export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

export const cloudConfigured = () => !!process.env.DATABASE_URL;

let _schemaReady = false;
// Idempotent — safe to call on every cold start. CREATE TABLE IF NOT EXISTS is
// cheap and means there's no separate migration step to run by hand.
export async function ensureSchema() {
  if (_schemaReady) return;
  const sql = getSql();
  await sql`
    create table if not exists projects (
      id           text primary key,
      name         text not null default 'Untitled',
      image_url    text,
      image_width  integer,
      image_height integer,
      shapes       jsonb not null default '[]'::jsonb,
      pieces       jsonb not null default '[]'::jsonb,
      updated_at   timestamptz not null default now()
    )
  `;
  _schemaReady = true;
}

// Light auth: a single shared passphrase. If APP_TOKEN is unset the API is
// open (fine for a private deployment you keep to yourself). If it's set, the
// client must echo it back in the x-app-token header.
export function checkAuth(req) {
  const required = process.env.APP_TOKEN;
  if (!required) return true;
  const got = req.headers['x-app-token'];
  return typeof got === 'string' && got === required;
}

// When Blob storage is configured, offload large image data URLs to Vercel
// Blob and store just the URL in Postgres (keeps the DB small + fast). Without
// the token, or for small/already-URL images, the image is returned unchanged
// and stored inline as before.
export async function maybeOffloadImage(image) {
  if (!image || !image.url) return image;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return image;
  if (!image.url.startsWith('data:')) return image; // already a hosted URL
  if (image.url.length < 1_000_000) return image;    // small enough to keep inline
  try {
    const { put } = await import('@vercel/blob');
    const [meta, b64] = image.url.split(',');
    const contentType = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/png';
    const ext = (contentType.split('/')[1] || 'png').replace('+xml', '');
    const buf = Buffer.from(b64, 'base64');
    const key = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blob = await put(key, buf, { access: 'public', contentType, token: process.env.BLOB_READ_WRITE_TOKEN });
    return { url: blob.url, width: image.width, height: image.height };
  } catch {
    // Upload failed → fall back to inline storage so the save still succeeds.
    return image;
  }
}

// Shape a DB row into the client's project format.
export function rowToProject(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image_url
      ? { url: row.image_url, width: row.image_width, height: row.image_height }
      : null,
    shapes: row.shapes ?? [],
    pieces: row.pieces ?? [],
    updatedAt: row.updated_at,
  };
}
