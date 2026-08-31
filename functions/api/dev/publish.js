// POST /api/dev/publish  (관리자 PIN)
//   { ids?:[..], dates?:[..], all?:bool } → 선택 draft 를 라이브 reports 로 병합 발행.
//   날짜별 그룹 → mergeAndPublishDate(병합·재색인) → 발행한 기업 AI 요약 재생성 → draft status='published'.
//
// 「불러오기로 시작한 수동 입력」은 그 날짜의 전체 목록이므로 폼에서 뺀 항목을 라이브에서도 지운다
// (기준선은 _publish.js writeManualBase 가 남긴다, 2026-08-31 사용자 지시). 삭제가 걸린 날짜는
// 그 사이 내용이 바뀌었는지 먼저 확인하고, 바뀌었으면 그 날짜만 건너뛰고 409 로 알린다.
import { pinOk, forbidden } from '../../_auth.js';
import { mergeAndPublishDate, readManualBase, clearManualBase, planRemovals } from '../../_publish.js';
import { generateAndStore } from '../../_summary.js';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!pinOk(env, request)) return forbidden();
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const ids = Array.isArray(body?.ids) ? body.ids.map((x) => +x).filter(Boolean) : [];
  const dates = Array.isArray(body?.dates) ? body.dates.map(String) : [];
  const all = !!body?.all;
  // dryRun — 배포하지 않고 「지워질 것」만 계산해 돌려준다. 확인창에서 먼저 보여주기 위한 것.
  const dryRun = !!body?.dryRun;

  // 대상 draft 조회
  let rows;
  try {
    if (all) {
      rows = (await env.DB.prepare("SELECT id, date, company, data FROM draft_entries WHERE status='draft'").all()).results || [];
    } else if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      rows = (await env.DB.prepare(`SELECT id, date, company, data FROM draft_entries WHERE status='draft' AND id IN (${ph})`).bind(...ids).all()).results || [];
    } else if (dates.length) {
      const ph = dates.map(() => '?').join(',');
      rows = (await env.DB.prepare(`SELECT id, date, company, data FROM draft_entries WHERE status='draft' AND date IN (${ph})`).bind(...dates).all()).results || [];
    } else {
      return Response.json({ error: 'NO_SELECTION' }, { status: 400 });
    }
  } catch (err) {
    console.error('dev/publish select', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
  if (!rows.length) return Response.json({ ok: true, publishedDates: [], publishedIds: [], note: 'no drafts' });

  // 날짜별 그룹
  const byDate = {};
  const idsByDate = {};
  for (const r of rows) {
    let data; try { data = JSON.parse(r.data || '{}'); } catch { continue; }
    (byDate[r.date] = byDate[r.date] || []).push(data);
    (idsByDate[r.date] = idsByDate[r.date] || []).push(r.id);
  }

  // dryRun — 날짜별 삭제 예정만 계산하고 아무것도 쓰지 않는다.
  if (dryRun) {
    const plan = [];
    for (const date of Object.keys(byDate).sort()) {
      try {
        const base = await readManualBase(env, date);
        if (!base) continue;
        if (!(await isWholeDate(env, date, idsByDate[date]))) continue;
        const p = await planRemovals(env, date, base, byDate[date]);
        if (p.remove.length || p.stale.length) plan.push({ date, remove: p.remove, stale: p.stale });
      } catch (err) { console.error('dev/publish dryRun', date, err); }
    }
    return Response.json({ ok: true, dryRun: true, plan });
  }

  const publishedDates = [], publishedIds = [], failed = [];
  const removedByDate = {}, staleDates = [], datesRemoved = [];
  const companies = new Set();
  for (const date of Object.keys(byDate).sort()) {
    try {
      /* 「불러와서 고친」 날짜면 폼에서 빠진 항목을 지운다. 단 부분 배포(ids 로 그 날짜의 일부만
         고른 경우)에는 적용하지 않는다 — 고르지 않은 draft 가 「빠진 것」으로 오인돼 지워진다. */
      let remove = [];
      const base = await readManualBase(env, date);
      if (base) {
        const wholeDate = await isWholeDate(env, date, idsByDate[date]);
        if (wholeDate) {
          const plan = await planRemovals(env, date, base, byDate[date]);
          if (plan.stale.length) {
            // 불러온 뒤 남이 고친 항목이 삭제 대상에 있다 — 지우면 그 수정이 사라진다.
            staleDates.push({ date, stale: plan.stale });
            continue;
          }
          remove = plan.remove;
        }
      }

      const res = await mergeAndPublishDate(env, date, byDate[date], { remove });
      if (res.removed.length) removedByDate[date] = res.removed;
      if (res.dateRemoved) datesRemoved.push(date);
      byDate[date].forEach((c) => c && c.name && companies.add(c.name));
      // draft 들을 published 로 표시
      const idp = idsByDate[date];
      const ph = idp.map(() => '?').join(',');
      await env.DB.prepare(`UPDATE draft_entries SET status='published', updated_at=datetime('now') WHERE id IN (${ph})`).bind(...idp).run();
      // 기준선은 한 번 쓰고 버린다 — 남기면 다음 배포가 물려받아 엉뚱한 항목을 지운다.
      if (base) { try { await clearManualBase(env, date); } catch { /* best-effort */ } }
      publishedDates.push(date);
      publishedIds.push(...idp);
    } catch (err) {
      console.error('dev/publish date', date, err);
      failed.push(date);
    }
  }

  // 발행 기업 AI 요약 백그라운드 재생성
  if (env.OPENROUTER_API_KEY && companies.size && typeof waitUntil === 'function') {
    waitUntil((async () => { for (const n of companies) { try { await generateAndStore(env, n); } catch { /* 계속 */ } } })());
  }

  const out = { ok: true, publishedDates, publishedIds, failed, removedByDate, datesRemoved };
  if (staleDates.length) {
    // 일부 날짜를 건너뛴 것이라 200 이 아니다. 화면은 이 목록을 보여 주고 다시 불러오게 한다.
    return Response.json({ ...out, ok: false, error: 'STALE_BASE', staleDates,
      note: '불러온 뒤 그 항목이 바뀌었습니다 — 수동 입력에서 다시 불러오세요' }, { status: 409 });
  }
  return Response.json(out);
}

/* 그 날짜의 draft 를 **전부** 고른 배포인지 확인한다.
   기준선의 삭제는 「폼에 있던 전체」를 전제로 하므로, 그 날짜 draft 중 일부만 골라 배포하면
   고르지 않은 draft 가 「빠진 것」으로 오인돼 지워진다. 그때는 삭제를 적용하지 않는다. */
async function isWholeDate(env, date, selectedIds) {
  try {
    const rows = await env.DB.prepare("SELECT id FROM draft_entries WHERE status='draft' AND date = ?").bind(date).all();
    const all = (rows.results || []).map((r) => +r.id);
    const sel = new Set((selectedIds || []).map((x) => +x));
    return all.length > 0 && all.every((id) => sel.has(id));
  } catch (err) {
    console.error('dev/publish isWholeDate', date, err);
    return false; // 알 수 없으면 지우지 않는다
  }
}
