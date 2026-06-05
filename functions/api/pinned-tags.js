// /api/pinned-tags
//   GET  (공개)  → 지식그래프 고정 핀 태그 배열 (그래프 렌더 시 사용)
//   POST (PIN)   → { tags: [...] } 저장. 최대 50개, 각 40자.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'pinned_tags'").first();
    let tags = [];
    if (row && row.value) { try { tags = JSON.parse(row.value); } catch { tags = []; } }
    return Response.json(Array.isArray(tags) ? tags : []);
  } catch (err) {
    console.error('GET /api/pinned-tags', err);
    return Response.json([]);
  }
}

export async function onRequestPost({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const raw = Array.isArray(body?.tags) ? body.tags : [];
  const tags = [...new Set(raw.map((t) => String(t == null ? '' : t).trim().slice(0, 40)).filter(Boolean))].slice(0, 50);
  try {
    await env.DB
      .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('pinned_tags', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
      .bind(JSON.stringify(tags))
      .run();
    return Response.json({ ok: true, tags });
  } catch (err) {
    console.error('POST /api/pinned-tags', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
