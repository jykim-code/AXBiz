// GET /api/dev/reports?date=YYYY-MM-DD  (관리자 PIN)
//   해당 날짜의 published 기업 + draft 합본(같은 기업 교체/추가, _draft 표시) → companies 배열.
//   공개 /api/reports?date= 와 동일 형태.
import { pinOk, forbidden } from '../../_auth.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestGet({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date || !DATE_RE.test(date)) return Response.json({ error: 'INVALID_DATE' }, { status: 400 });
  try {
    const row = await env.DB.prepare('SELECT companies FROM reports WHERE date = ?').bind(date).first();
    const m = {};
    if (row) {
      let cs = []; try { cs = JSON.parse(row.companies || '[]'); } catch { cs = []; }
      (Array.isArray(cs) ? cs : []).forEach((c) => { if (c && c.name) m[c.name] = c; });
    }
    const drafts = await env.DB.prepare("SELECT data FROM draft_entries WHERE status = 'draft' AND date = ?").bind(date).all();
    for (const d of (drafts.results || [])) {
      let data; try { data = JSON.parse(d.data || '{}'); } catch { continue; }
      if (data && data.name) m[data.name] = Object.assign({}, data, { _draft: true });
    }
    return Response.json(Object.values(m));
  } catch (err) {
    console.error('GET /api/dev/reports', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
