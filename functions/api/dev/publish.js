// POST /api/dev/publish  (관리자 PIN)
//   { ids?:[..], dates?:[..], all?:bool } → 선택 draft 를 라이브 reports 로 병합 발행.
//   날짜별 그룹 → mergeAndPublishDate(병합·재색인) → 발행한 기업 AI 요약 재생성 → draft status='published'.
//
// 배포는 병합만 한다 — draft 에 없는 라이브 항목은 손대지 않는다. 수동 입력의 「이 항목 빼기」는
// 입력 목록에서만 빼는 것이고 라이브 삭제가 아니다(2026-09-02 사용자 확정). 라이브에서 지우는
// 것은 /api/dev/live 의 삭제뿐이다.
import { pinOk, forbidden } from '../../_auth.js';
import { mergeAndPublishDate } from '../../_publish.js';
import { generateAndStore } from '../../_summary.js';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!pinOk(env, request)) return forbidden();
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const ids = Array.isArray(body?.ids) ? body.ids.map((x) => +x).filter(Boolean) : [];
  const dates = Array.isArray(body?.dates) ? body.dates.map(String) : [];
  const all = !!body?.all;

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

  const publishedDates = [], publishedIds = [], failed = [];
  const companies = new Set();
  for (const date of Object.keys(byDate).sort()) {
    try {
      await mergeAndPublishDate(env, date, byDate[date]);
      byDate[date].forEach((c) => c && c.name && companies.add(c.name));
      // draft 들을 published 로 표시
      const idp = idsByDate[date];
      const ph = idp.map(() => '?').join(',');
      await env.DB.prepare(`UPDATE draft_entries SET status='published', updated_at=datetime('now') WHERE id IN (${ph})`).bind(...idp).run();
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

  return Response.json({ ok: true, publishedDates, publishedIds, failed });
}
