// /api/reindex
//   POST  → 전체 백필. D1 의 모든 reports 를 읽어 Vectorize 에 (재)색인. PIN 검증.
//   자동화/최초 1회용. 평소 색인은 /api/reports POST 가 증분 처리한다.

import { upsertReport } from '../_rag.js';

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

  let rows;
  try {
    const r = await env.DB
      .prepare('SELECT date, companies FROM reports ORDER BY date ASC')
      .all();
    rows = r.results || [];
  } catch (err) {
    console.error('reindex: DB read', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
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
      const n = await upsertReport(env, row.date, companies);
      report.dates += 1;
      report.vectors += n;
    } catch (err) {
      console.error('reindex: upsert', row.date, err);
      report.errors.push({ date: row.date, error: String(err && err.message || err) });
    }
  }

  return Response.json({ ok: report.errors.length === 0, ...report });
}
