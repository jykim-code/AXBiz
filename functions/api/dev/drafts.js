// /api/dev/drafts  (관리자 PIN)
//   GET            → draft 목록(+ 라이브 대비 diff: 'new'|'replace') desc
//   POST {id, action:'delete'} → draft 삭제
import { pinOk, forbidden } from '../../_auth.js';

export async function onRequestGet({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  try {
    const rows = await env.DB.prepare(
      "SELECT id, date, company, category, data, source, created_at FROM draft_entries WHERE status = 'draft' ORDER BY date DESC, company ASC"
    ).all();
    const list = [];
    for (const r of (rows.results || [])) {
      let data; try { data = JSON.parse(r.data || '{}'); } catch { data = {}; }
      // diff: 해당 날짜 라이브에 같은 기업이 있으면 replace, 없으면 new
      let diff = 'new';
      try {
        const live = await env.DB.prepare('SELECT companies FROM reports WHERE date = ?').bind(r.date).first();
        if (live) {
          const cs = JSON.parse(live.companies || '[]');
          if (Array.isArray(cs) && cs.some((c) => c && c.name === r.company)) diff = 'replace';
        }
      } catch { /* 기본 new */ }
      list.push({ id: r.id, date: r.date, company: r.company, category: r.category, source: r.source, created_at: r.created_at, data, diff });
    }
    return Response.json({ drafts: list, count: list.length });
  } catch (err) {
    console.error('GET /api/dev/drafts', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const id = +body?.id;
  const action = String(body?.action || '');
  if (!id || action !== 'delete') return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });
  try {
    await env.DB.prepare("DELETE FROM draft_entries WHERE id = ? AND status = 'draft'").bind(id).run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error('POST /api/dev/drafts', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
