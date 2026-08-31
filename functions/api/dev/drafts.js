// /api/dev/drafts  (관리자 PIN)
//   GET            → draft 목록(+ 라이브 대비 diff: 'new'|'replace') desc
//   POST {id, action:'delete'} → draft 삭제
import { pinOk, forbidden } from '../../_auth.js';
import { entryKey, writeManualBase, clearManualBase, readManualBase, planRemovals } from '../../_publish.js';

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
      // diff: 라이브에 같은 (기업, 동향키)가 있으면 replace, 없으면 new.
      //   기업명만으로 비교하면 같은 날 두 번째 동향이 'replace' 로 보여
      //   기존 동향을 덮어쓰는 것처럼 오해된다(실제 배포는 동향키 기준으로 추가됨).
      let diff = 'new';
      try {
        const live = await env.DB.prepare('SELECT companies FROM reports WHERE date = ?').bind(r.date).first();
        if (live) {
          const cs = JSON.parse(live.companies || '[]');
          const key = entryKey(data);
          const match = Array.isArray(cs) ? cs.find((c) => c && c.name === r.company && entryKey(c) === key) : null;
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

    /* base — [기존 데이터 불러오기]로 띄운 라이브 목록. 있으면 이 draft 묶음은 그 날짜의
       **전체 목록**이라는 뜻이고, 여기서 빠진 항목은 배포 때 라이브에서 삭제된다.
       없으면(신규 입력) 예전 기준선을 지운다 — 남겨 두면 관계없는 다음 배포가 그것을 물려받아
       엉뚱한 항목을 지운다. */
    const base = Array.isArray(body?.base) ? body.base.slice(0, 200) : null;
    let baseCount = 0;
    try {
      if (base) baseCount = await writeManualBase(env, date, base);
      else await clearManualBase(env, date);
    } catch (err) { console.error('drafts create: base', date, err); }
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
      // source_ref = 동향 신원(출처 URL). 같은 날 같은 기업의 다른 동향은 별개 draft 로
      // 공존하고, 같은 동향을 다시 넣으면 그 건만 갱신된다.
      const ref = entryKey(JSON.parse(data));
      try {
        await env.DB.prepare("DELETE FROM draft_entries WHERE date = ? AND company = ? AND source = 'manual' AND source_ref = ? AND status = 'draft'").bind(date, name, ref).run();
        await env.DB.prepare(
          `INSERT INTO draft_entries (date, company, category, data, source, source_ref, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'manual', ?, 'draft', datetime('now'), datetime('now'))`
        ).bind(date, name, category, data, ref).run();
        count++;
      } catch (err) { console.error('drafts create', name, err); }
    }

    // 배포 때 몇 건이 지워질지 저장 직후에 알려 준다 — 되돌릴 수 없는 일이라 배포 전에 보여야 한다.
    let willRemove = [];
    if (base) {
      try {
        const plan = await planRemovals(env, date, await readManualBase(env, date), items);
        willRemove = plan.remove;
      } catch (err) { console.error('drafts create: plan', date, err); }
    }
    return Response.json({ ok: true, count, date, baseCount, willRemove });
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
