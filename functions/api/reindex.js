// /api/reindex
//   POST → Vectorize 재색인. PIN 검증.
//     {}                          → 처음부터 기본 묶음(REINDEX_CHUNK)만 처리, nextFrom 반환
//     { from:'YYYY-MM-DD' }       → 그 날짜부터 이어서 (nextFrom 을 그대로 넘기면 됨)
//     { dates:['YYYY-MM-DD',…] }  → 지정 날짜만 (데이터 수정 후 부분 재색인)
//     { limit:n }                 → 이번 호출에서 처리할 날짜 수 (상한 MAX_CHUNK)
//     { prune:true }              → 항목이 줄어든 날짜의 고아 벡터까지 정리
//
//   전량을 한 호출로 돌리면 Workers 서브리퀘스트 상한에 걸려 뒤쪽 날짜가 통째로 실패한다
//   (실측: 95개 날짜 요청 시 앞 50개만 성공, 45개가 'Too many subrequests'). 그래서
//   묶음으로 끊어 처리하고, 남은 시작점을 nextFrom 으로 돌려준다.
//   평소 색인은 /api/reports POST 가 날짜별로 증분 처리한다.

import { upsertReport, deleteReportVectors } from '../_rag.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REINDEX_CHUNK = 15; // 한 호출 기본 날짜 수 — 서브리퀘스트 상한에 여유를 둔 값
const MAX_CHUNK = 40;
const MAX_DATES = 200; // dates 배열 상한
const PRUNE_SLACK = 10; // 고아 벡터 정리 시 현재 개수보다 넉넉히 지울 여유분

// reports.js 와 동일한 상수시간 비교(중복 최소화를 위해 작은 헬퍼만 복제).
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!env.AI || !env.VECTORIZE) {
    return Response.json({ error: 'RAG_NOT_CONFIGURED' }, { status: 503 });
  }

  // 본문은 선택 — 없으면 처음부터 기본 묶음.
  const body = await request.json().catch(() => ({}));
  const only = Array.isArray(body?.dates)
    ? [...new Set(body.dates.filter((d) => typeof d === 'string' && DATE_RE.test(d)))].slice(0, MAX_DATES)
    : null;
  if (only && !only.length) return Response.json({ error: 'INVALID_DATES' }, { status: 400 });
  const from = typeof body?.from === 'string' && DATE_RE.test(body.from) ? body.from : null;
  const limit = Number.isInteger(body?.limit) && body.limit > 0 ? Math.min(body.limit, MAX_CHUNK) : REINDEX_CHUNK;
  const prune = body?.prune === true;

  let rows;
  try {
    if (only) {
      const marks = only.map(() => '?').join(',');
      const r = await env.DB
        .prepare(`SELECT date, companies FROM reports WHERE date IN (${marks}) ORDER BY date ASC`)
        .bind(...only)
        .all();
      rows = r.results || [];
    } else {
      // limit+1 을 읽어 다음 시작점(nextFrom)을 알아낸다.
      const r = from
        ? await env.DB.prepare('SELECT date, companies FROM reports WHERE date >= ? ORDER BY date ASC LIMIT ?').bind(from, limit + 1).all()
        : await env.DB.prepare('SELECT date, companies FROM reports ORDER BY date ASC LIMIT ?').bind(limit + 1).all();
      rows = r.results || [];
    }
  } catch (err) {
    console.error('reindex: DB read', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  let nextFrom = null;
  if (!only && rows.length > limit) {
    nextFrom = rows[limit].date; // 이번 묶음에 넣지 않고 다음 호출로 넘긴다
    rows = rows.slice(0, limit);
  }

  const report = { dates: 0, vectors: 0, errors: [] };
  for (const row of rows) {
    let companies = [];
    try {
      companies = JSON.parse(row.companies || '[]');
    } catch {
      companies = [];
    }
    if (!Array.isArray(companies) || !companies.length) continue;
    try {
      // 항목이 줄어든 날짜는 뒤쪽 id 가 고아로 남는다(upsert 는 지우지 않음).
      if (prune) await deleteReportVectors(env, row.date, companies.length + PRUNE_SLACK);
      const n = await upsertReport(env, row.date, companies);
      report.dates += 1;
      report.vectors += n;
    } catch (err) {
      console.error('reindex: upsert', row.date, err);
      report.errors.push({ date: row.date, error: String((err && err.message) || err) });
    }
  }

  return Response.json({ ok: report.errors.length === 0, ...report, nextFrom, done: !nextFrom });
}
