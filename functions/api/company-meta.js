// /api/company-meta  (관리자 PIN)
//   GET  → 전체 매핑 목록 [{name, corp_code, overrides}]
//   POST {name, corpCode, overrides} → 기업 ↔ DART corp_code 매핑/보정 upsert
//   corpCode '' → 매핑 해제(NULL). overrides 객체 → JSON 저장(예: {ceo:'...'}).
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
function forbid() {
  return new Promise((r) => setTimeout(r, 500)).then(() => Response.json({ error: 'FORBIDDEN' }, { status: 403 }));
}

export async function onRequestGet({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) return forbid();
  try {
    const r = await env.DB.prepare('SELECT name, corp_code, overrides FROM company_meta ORDER BY name').all();
    return Response.json(r.results || []);
  } catch (err) {
    console.error('GET /api/company-meta', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) return forbid();

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const name = String(body?.name || '').trim().slice(0, 200);
  if (!name) return Response.json({ error: 'INVALID_NAME' }, { status: 400 });

  let corpCode = String(body?.corpCode || '').trim();
  if (corpCode && !/^\d{6,8}$/.test(corpCode)) return Response.json({ error: 'INVALID_CORP_CODE' }, { status: 400 });
  const corpVal = corpCode || null;

  // overrides: 객체만 허용, 빈 객체/없음은 NULL
  let overridesVal = null;
  const ov = body?.overrides;
  if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
    const clean = {};
    for (const k of ['ceo', 'homepage', 'address', 'industryCode']) {
      const v = String(ov[k] == null ? '' : ov[k]).trim().slice(0, 300);
      if (v) clean[k] = v;
    }
    if (Object.keys(clean).length) overridesVal = JSON.stringify(clean);
  }

  try {
    await env.DB
      .prepare(
        `INSERT INTO company_meta (name, corp_code, overrides, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(name) DO UPDATE SET
           corp_code = excluded.corp_code, overrides = excluded.overrides, updated_at = datetime('now')`
      )
      .bind(name, corpVal, overridesVal)
      .run();
    return Response.json({ ok: true, name, corpCode: corpVal });
  } catch (err) {
    console.error('POST /api/company-meta', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
