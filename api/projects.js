// /api/projects — single endpoint for the whole project CRUD.
//   GET    /api/projects           → list (no image payload, stays light)
//   GET    /api/projects?id=...     → one full project (with image)
//   PUT    /api/projects?id=...     → upsert (image only rewritten when sent)
//   DELETE /api/projects?id=...     → delete
//
// All gated by the shared passphrase (x-app-token) when APP_TOKEN is set.
import { getSql, ensureSchema, checkAuth, cloudConfigured, rowToProject, maybeOffloadImage } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    if (!cloudConfigured()) {
      return res.status(503).json({ error: 'cloud-not-configured' });
    }
    if (!checkAuth(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    await ensureSchema();
    const sql = getSql();
    const id = typeof req.query.id === 'string' ? req.query.id : undefined;

    if (req.method === 'GET') {
      if (id) {
        const rows = await sql`select * from projects where id = ${id}`;
        if (!rows.length) return res.status(404).json({ error: 'not-found' });
        return res.status(200).json(rowToProject(rows[0]));
      }
      const rows = await sql`
        select id, name, image_width, image_height, updated_at
        from projects order by updated_at desc
      `;
      return res.status(200).json(rows.map((r) => ({
        id: r.id, name: r.name,
        width: r.image_width, height: r.image_height,
        updatedAt: r.updated_at,
      })));
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = req.body || {};
      const pid = id || body.id;
      if (!pid) return res.status(400).json({ error: 'id-required' });

      const name = body.name ?? 'Untitled';
      const shapes = JSON.stringify(body.shapes ?? []);
      const pieces = JSON.stringify(body.pieces ?? []);

      // Only touch the image columns when the client actually sends an image
      // key — lets routine shape edits sync without re-uploading the picture.
      if ('image' in body) {
        const img = (await maybeOffloadImage(body.image)) || {};
        await sql`
          insert into projects (id, name, image_url, image_width, image_height, shapes, pieces, updated_at)
          values (${pid}, ${name}, ${img.url ?? null}, ${img.width ?? null}, ${img.height ?? null}, ${shapes}::jsonb, ${pieces}::jsonb, now())
          on conflict (id) do update set
            name = excluded.name,
            image_url = excluded.image_url,
            image_width = excluded.image_width,
            image_height = excluded.image_height,
            shapes = excluded.shapes,
            pieces = excluded.pieces,
            updated_at = now()
        `;
      } else {
        await sql`
          insert into projects (id, name, shapes, pieces, updated_at)
          values (${pid}, ${name}, ${shapes}::jsonb, ${pieces}::jsonb, now())
          on conflict (id) do update set
            name = excluded.name,
            shapes = excluded.shapes,
            pieces = excluded.pieces,
            updated_at = now()
        `;
      }
      const rows = await sql`select id, name, updated_at from projects where id = ${pid}`;
      return res.status(200).json({ id: rows[0].id, name: rows[0].name, updatedAt: rows[0].updated_at });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id-required' });
      await sql`delete from projects where id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    return res.status(405).json({ error: 'method-not-allowed' });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
