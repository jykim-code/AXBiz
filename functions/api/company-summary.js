// /api/company-summary?name=  (공개, 읽기 전용)
//   저장된 요약(company_summary)만 반환 — 읽기 경로에서 LLM 동기 호출 없음.
//   캐시가 데이터보다 낡았으면 일단 반환하고 백그라운드(waitUntil)로 재생성(SWR).
//   캐시가 아예 없으면 백그라운드 생성만 예약하고 available:false (다음 방문 때 표시).
//   ※ 주 생성 시점은 관리자 저장(POST /api/reports)의 백그라운드 훅.
import { collectEntries, generateAndStore } from '../_summary.js';

export async function onRequestGet({ request, env, waitUntil }) {
  const name = new URL(request.url).searchParams.get('name');
  if (!name) return Response.json({ error: 'INVALID_NAME' }, { status: 400 });

  let collected;
  try {
    collected = await collectEntries(env, name);
  } catch (err) {
    console.error('/api/company-summary: read', err);
    return Response.json({ available: false, reason: 'DB_ERROR' }, { status: 500 });
  }
  const { entries, latestDate, hash } = collected;
  if (entries.length < 2) return Response.json({ available: false, reason: 'NOT_ENOUGH_DATA' });

  let cached = null;
  try {
    cached = await env.DB.prepare('SELECT flow, insight, source_hash, generated_at FROM company_summary WHERE name = ?').bind(name).first();
  } catch { /* 무시 */ }

  if (cached && cached.flow) {
    const fresh = cached.source_hash === hash;
    if (!fresh) waitUntil(generateAndStore(env, name)); // 낡았으면 백그라운드 갱신(다음 조회에 반영)
    try {
      return Response.json({
        available: true,
        flow: JSON.parse(cached.flow),
        insight: JSON.parse(cached.insight || '[]'),
        dataDate: latestDate,
        stale: !fresh,
      });
    } catch { /* 파싱 실패 → 아래 생성 예약 */ }
  }

  // 저장본 없음 → 백그라운드 생성만 예약 (방문자는 기다리지 않음)
  waitUntil(generateAndStore(env, name));
  return Response.json({ available: false, reason: 'GENERATING' });
}
