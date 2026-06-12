// /api/dev/drafts  (관리자 PIN)
//   GET            → draft 목록(+ 라이브 대비 diff: 'new'|'replace') desc
//   POST {id, action:'delete'} → draft 삭제
import { pinOk, forbidden } from '../../_auth.js';

// 내용 비교용 시그니처(요약 제외 — 실질 콘텐츠만). 같으면 '동일'.
const norm = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).join('||') : String(v == null ? '' : v).trim());
const sig = (e) => { e = e || {}; return [norm(e.category), norm(e.keyPoints), norm(e.implications), norm(e.hancomInsight), norm(e.tags), norm(e.sourceUrl), norm(e.confluenceUrl)].join('@@'); };

export async function onRequestGet({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  try {
    const rows = await env.DB.prepare(
      "SELECT id, date, company, category, data, source, created_at FROM draft_entries WHERE status = 'draft' ORDER BY date DESC, company ASC"
    ).all();
    // DART 연결 여부(기업명 기준) — 검수 화면에서 미연결 새 기업 안내용
    let dartSet = new Set();
    try {
      const meta = await env.DB.prepare('SELECT name, corp_code FROM company_meta').all();
      dartSet = new Set((meta.results || []).filter((m) => m.corp_code).map((m) => m.name));
    } catch { /* 배지 생략 */ }
    const list = [];
    for (const r of (rows.results || [])) {
      let data; try { data = JSON.parse(r.data || '{}'); } catch { data = {}; }
      // diff: 해당 날짜 라이브에 같은 기업이 있으면 replace, 없으면 new
      let diff = 'new';
      try {
        const live = await env.DB.prepare('SELECT companies FROM reports WHERE date = ?').bind(r.date).first();
        if (live) {
          const cs = JSON.parse(live.companies || '[]');
          const match = Array.isArray(cs) ? cs.find((c) => c && c.name === r.company) : null;
          if (match) diff = (sig(match) === sig(data)) ? 'same' : 'replace';
        }
      } catch { /* 기본 new */ }
      list.push({ id: r.id, date: r.date, company: r.company, category: r.category, source: r.source, created_at: r.created_at, data, diff, dartLinked: dartSet.has(r.company) });
    }
    return Response.json({ drafts: list, count: list.length });
  } catch (err) {
    console.error('GET /api/dev/drafts', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

const CATEGORIES = ['대기업', '중견기업', '스타트업·중소'];
const arr = (v, fb) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : fb);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const action = String(body?.action || '');

  // 수동 입력 → draft 일괄 생성 (같은 (date,company,'manual') draft 는 갱신)
  if (action === 'create') {
    const date = String(body?.date || '').trim();
    if (!DATE_RE.test(date)) return Response.json({ error: 'INVALID_DATE' }, { status: 400 });
    const items = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
    let count = 0;
    for (const it of items) {
      const name = String(it?.name || '').trim().slice(0, 200);
      if (!name) continue;
      const category = CATEGORIES.includes(it?.category) ? it.category : '대기업';
      const data = JSON.stringify({
        name, category,
        summary: String(it?.summary || '').trim().slice(0, 300),
        sourceUrl: String(it?.sourceUrl || '').trim().slice(0, 1000),
        confluenceUrl: String(it?.confluenceUrl || '').trim().slice(0, 1000),
        keyPoints: arr(it?.keyPoints, []), implications: arr(it?.implications, []),
        hancomInsight: arr(it?.hancomInsight, []), tags: arr(it?.tags, []),
      });
      try {
        await env.DB.prepare("DELETE FROM draft_entries WHERE date = ? AND company = ? AND source = 'manual' AND status = 'draft'").bind(date, name).run();
        await env.DB.prepare(
          `INSERT INTO draft_entries (date, company, category, data, source, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'manual', 'draft', datetime('now'), datetime('now'))`
        ).bind(date, name, category, data).run();
        count++;
      } catch (err) { console.error('drafts create', name, err); }
    }
    return Response.json({ ok: true, count, date });
  }

  const id = +body?.id;
  if (!id) return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });

  try {
    if (action === 'delete') {
      await env.DB.prepare("DELETE FROM draft_entries WHERE id = ? AND status = 'draft'").bind(id).run();
      return Response.json({ ok: true });
    }
    if (action === 'update') {
      const row = await env.DB.prepare("SELECT data, category FROM draft_entries WHERE id = ? AND status = 'draft'").bind(id).first();
      if (!row) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      let cur = {}; try { cur = JSON.parse(row.data || '{}'); } catch { cur = {}; }
      const d = body.data || {};
      const merged = Object.assign({}, cur, {
        summary: d.summary != null ? String(d.summary).trim().slice(0, 300) : (cur.summary || ''),
        keyPoints: arr(d.keyPoints, cur.keyPoints || []),
        implications: arr(d.implications, cur.implications || []),
        hancomInsight: arr(d.hancomInsight, cur.hancomInsight || []),
        tags: arr(d.tags, cur.tags || []),
        category: CATEGORIES.includes(d.category) ? d.category : (cur.category || row.category),
        sourceUrl: d.sourceUrl != null ? String(d.sourceUrl).trim() : (cur.sourceUrl || ''),
        confluenceUrl: d.confluenceUrl != null ? String(d.confluenceUrl).trim() : (cur.confluenceUrl || ''),
      });
      await env.DB.prepare("UPDATE draft_entries SET data = ?, category = ?, updated_at = datetime('now') WHERE id = ? AND status = 'draft'")
        .bind(JSON.stringify(merged), merged.category, id).run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/dev/drafts', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
