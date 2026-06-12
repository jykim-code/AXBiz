// /api/import-confluence  (관리자 PIN)
//   POST { url, dryRun?, nameOverride?, categoryOverride? }
//   컨플 "AX 동향 히스토리 - {기업}" 페이지를 읽어 타임라인 표를 reports 로 병합 업서트(직접 라이브).
//   - dryRun: 파싱 미리보기만 반환(저장 안 함)
//   파싱=_confluence.js / 저장=_publish.js / AI 요약=_summary.js 공용.
//   시크릿: CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN
import { pinOk, forbidden } from '../_auth.js';
import { parseConfluencePage, rowsToEntries } from '../_confluence.js';
import { mergeAndPublishDate } from '../_publish.js';
import { generateAndStore } from '../_summary.js';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!pinOk(env, request)) return forbidden();

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const res = await parseConfluencePage(env, body || {});
  if (!res.ok) return Response.json({ error: res.error, ...(res.hint ? { hint: res.hint } : {}) }, { status: res.status || 400 });

  const { name, category, confUrl, title, rows } = res;
  const preview = {
    name, category, pageTitle: title, count: rows.length,
    dates: rows.map((r) => r.date),
    sample: { date: rows[0].date, keyPoint: rows[0].keyPoint.slice(0, 120), tags: rows[0].tags },
  };
  if (body?.dryRun) return Response.json({ ok: true, dryRun: true, ...preview });

  // ===== 실행: 날짜별 병합 업서트 + 재색인 =====
  // rows 와 entries 는 같은 인덱스 → 날짜는 rows 에서 취득해 그룹화.
  const entries = rowsToEntries(name, category, confUrl, rows);
  const byDate = {};
  rows.forEach((r, i) => { (byDate[r.date] = byDate[r.date] || []).push(entries[i]); });

  const dates = Object.keys(byDate).sort();
  const saved = [];
  for (const d of dates) {
    try { await mergeAndPublishDate(env, d, byDate[d]); saved.push(d); }
    catch (err) { console.error('import: save', d, err); }
  }

  if (typeof waitUntil === 'function') waitUntil(generateAndStore(env, name));
  return Response.json({ ok: true, name, category, count: rows.length, savedDates: saved, failedDates: dates.filter((d) => !saved.includes(d)) });
}
