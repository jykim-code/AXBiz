// POST /api/dev/import  (관리자 PIN)
//   { url, nameOverride?, categoryOverride? } → 컨플 파싱 → draft_entries(status=draft) 적재.
//   라이브 reports 는 건드리지 않음. 같은 (date,company,source='confluence') 는 갱신(삭제 후 삽입).
import { pinOk, forbidden } from '../../_auth.js';
import { parseConfluencePage, rowsToEntries, failureResponse } from '../../_confluence.js';

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const res = await parseConfluencePage(env, body || {});
  if (!res.ok) return failureResponse(res);

  const { name, category, confUrl, pageId, rows } = res;
  const entries = rowsToEntries(name, category, confUrl, rows);

  let upserted = 0;
  for (let i = 0; i < rows.length; i++) {
    const date = rows[i].date;
    const data = JSON.stringify(Object.assign({ summary: '' }, entries[i]));
    try {
      // 같은 페이지에서 다시 가져오면 그 건만 갱신. 다른 페이지가 같은 (날짜,기업)을
      // 다루면 별개 동향으로 공존한다(source_ref = pageId).
      await env.DB.prepare("DELETE FROM draft_entries WHERE date = ? AND company = ? AND source = 'confluence' AND source_ref = ? AND status = 'draft'")
        .bind(date, name, String(pageId)).run();
      await env.DB.prepare(
        `INSERT INTO draft_entries (date, company, category, data, source, source_ref, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'confluence', ?, 'draft', datetime('now'), datetime('now'))`
      ).bind(date, name, category, data, String(pageId)).run();
      upserted++;
    } catch (err) { console.error('dev/import', date, err); }
  }

  return Response.json({ ok: true, name, category, count: upserted, dates: rows.map((r) => r.date) });
}
