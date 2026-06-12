// GET /api/dev/reports-all  (관리자 PIN)
//   published(reports) + draft(draft_entries) 합본 → [{date, companies:[...]}] desc.
//   draft 로 들어온 기업 항목은 같은 (date,company) 를 교체(없으면 추가)하고 _draft:true 표시.
//   공개 /api/reports/all 과 동일 형태 → 대시보드가 그대로 렌더.
import { pinOk, forbidden } from '../../_auth.js';

export async function onRequestGet({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  try {
    const pub = await env.DB.prepare('SELECT date, companies FROM reports').all();
    const map = {}; // date -> { name -> company }
    for (const r of (pub.results || [])) {
      let cs = [];
      try { cs = JSON.parse(r.companies || '[]'); } catch { cs = []; }
      const m = (map[r.date] = map[r.date] || {});
      (Array.isArray(cs) ? cs : []).forEach((c) => { if (c && c.name) m[c.name] = c; });
    }
    const drafts = await env.DB.prepare("SELECT date, company, data FROM draft_entries WHERE status = 'draft'").all();
    for (const d of (drafts.results || [])) {
      let data; try { data = JSON.parse(d.data || '{}'); } catch { continue; }
      if (!data || !data.name) continue;
      const m = (map[d.date] = map[d.date] || {});
      m[data.name] = Object.assign({}, data, { _draft: true });
    }
    const reports = Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({ date, companies: Object.values(map[date]) }));
    return Response.json(reports);
  } catch (err) {
    console.error('GET /api/dev/reports-all', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
