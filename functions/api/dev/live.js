// /api/dev/live  (관리자 PIN) — 라이브(reports) 동향 1건 조회·삭제.
//   GET  ?date=YYYY-MM-DD           → { date, entries:[{ idx, key, name, category, … }] }
//   POST { action:'delete', date, idx, name, key } → 그 1건만 라이브에서 제거.
//
// 왜 별도 경로인가 — 배포(_publish.js mergeAndPublishDate)는 병합이다. draft 에 없는
// 라이브 항목은 손대지 않으므로, 수동 입력 폼에서 항목을 빼고 다시 배포해도 라이브에서는
// 지워지지 않는다. 지우는 경로가 아예 없어 매번 같은 오해가 생겼다(2026-08-27).
//
// 삭제 신원은 (name, entryKey) 가 아니라 배열 인덱스 + 그 둘의 대조로 정한다.
// 같은 (기업, 동향키)가 과거 데이터에 중복으로 남아 있을 수 있어 키만으로 지우면
// 의도한 1건이 아니라 여러 건이 함께 사라진다. 인덱스가 어긋나면(그 사이 데이터가
// 바뀜) 409 로 돌려보내 다시 불러오게 한다.
import { pinOk, forbidden } from '../../_auth.js';
import { entryKey } from '../../_publish.js';
import { syncCompanyEntries } from '../../_entries.js';
import { reindexDate } from '../../_rag.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function liveOf(env, date) {
  const row = await env.DB.prepare('SELECT companies FROM reports WHERE date = ?').bind(date).first();
  if (!row) return null;
  let cs = [];
  try { cs = JSON.parse(row.companies || '[]'); } catch { cs = []; }
  return Array.isArray(cs) ? cs : [];
}

export async function onRequestGet({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  const date = new URL(request.url).searchParams.get('date') || '';
  if (!DATE_RE.test(date)) return Response.json({ error: 'INVALID_DATE' }, { status: 400 });
  try {
    const cs = await liveOf(env, date);
    if (cs === null) return Response.json({ date, entries: [] });
    const entries = cs.map((c, idx) => ({
      idx,
      key: entryKey(c),
      name: String(c?.name || ''),
      category: String(c?.category || ''),
      summary: String(c?.summary || ''),
      sourceUrl: String(c?.sourceUrl || ''),
      confluenceUrl: String(c?.confluenceUrl || ''),
      keyPoints: Array.isArray(c?.keyPoints) ? c.keyPoints : [],
      tags: Array.isArray(c?.tags) ? c.tags : [],
    }));
    return Response.json({ date, entries });
  } catch (err) {
    console.error('GET /api/dev/live', date, err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  let body; try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  if (String(body?.action || '') !== 'delete') return Response.json({ error: 'BAD_REQUEST' }, { status: 400 });

  const date = String(body?.date || '').trim();
  if (!DATE_RE.test(date)) return Response.json({ error: 'INVALID_DATE' }, { status: 400 });
  const idx = Number.isInteger(body?.idx) ? body.idx : -1;
  const name = String(body?.name || '');
  const key = String(body?.key || '');

  try {
    const cs = await liveOf(env, date);
    if (cs === null || idx < 0 || idx >= cs.length) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    const target = cs[idx];
    if (!target || String(target.name || '') !== name || entryKey(target) !== key) {
      return Response.json({ error: 'STALE', note: '그 사이 데이터가 바뀌었습니다 — 다시 불러오세요' }, { status: 409 });
    }

    const oldCount = cs.length;
    const remaining = cs.filter((_, i) => i !== idx);
    if (remaining.length) {
      await env.DB.prepare("UPDATE reports SET companies = ?, updated_at = datetime('now') WHERE date = ?")
        .bind(JSON.stringify(remaining), date).run();
    } else {
      // 항목이 0이 되면 그 날짜 행 자체를 없앤다 — /api/dates 는 reports 의 날짜를 그대로
      // 돌려주므로 빈 행을 남기면 캘린더에 데이터 없는 날짜가 점으로 남는다.
      await env.DB.prepare('DELETE FROM reports WHERE date = ?').bind(date).run();
    }

    // 파생 데이터 동기화(best-effort — 원본은 reports 이고 백필로 재생성 가능).
    try { await syncCompanyEntries(env, date, remaining); } catch (err) { console.error('live delete: entries', date, err); }
    if (env.AI && env.VECTORIZE) {
      // oldCount 만큼 지우고 남은 것만 다시 넣으므로 줄어든 만큼의 고아 벡터도 정리된다.
      try { await reindexDate(env, date, oldCount, remaining); } catch (err) { console.error('live delete: reindex', date, err); }
    }

    return Response.json({ ok: true, date, deleted: { name, key }, remaining: remaining.length, dateRemoved: !remaining.length });
  } catch (err) {
    console.error('POST /api/dev/live', date, err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
