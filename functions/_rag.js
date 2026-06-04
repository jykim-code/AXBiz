// functions/_rag.js — RAG 공용 모듈 (임베딩 / 청크 / Vectorize upsert·delete)
//
// 설계 메모
//  - 벡터 1개 = 기업 1개. id = `<date>#<companyIdx>` (날짜+배열 인덱스로 결정적 생성·삭제).
//  - 임베딩: Workers AI `@cf/baai/bge-m3` (1024d). env.AI 바인딩, 키 불필요.
//  - 검색 저장소: Vectorize `ax-biz-radar-idx` (1024d/cosine). env.VECTORIZE 바인딩.
//  - metadata 는 가볍게(≤10KiB) — 답변 생성에 필요한 풀 텍스트는 검색 후 D1 에서 재조회한다.
//  - `_` 접두 파일이라 Pages 라우터가 무시하지만, 다른 Function 에서 import 가능.

export const EMBED_MODEL = '@cf/baai/bge-m3';
export const EMBED_DIM = 1024;

// 검색 유사도 컷오프(cosine, 1=동일). 이 미만 매치는 "정보 없음"으로 버린다.
export const SIM_THRESHOLD = 0.35;
// 질의 시 가져올 최대 매치 수.
export const TOP_K = 8;
// 임베딩 배치 상한(요청당 텍스트 개수).
const EMBED_BATCH = 100;

const META_SNIPPET_MAX = 400; // metadata.snippet 길이 상한(비대 방지)

// 기업 1건 → 임베딩 대상 텍스트. 검색 가능한 모든 의미 필드를 합친다.
export function companyToText(c) {
  const kp = (c.keyPoints || []).join(' / ');
  const im = (c.implications || []).join(' / ');
  const hi = (c.hancomInsight || []).join(' / ');
  const tg = (c.tags || []).join(', ');
  return [
    `${c.name || ''} (${c.category || ''})`,
    kp && `주요내용: ${kp}`,
    im && `시사점: ${im}`,
    hi && `한컴인사이트: ${hi}`,
    tg && `태그: ${tg}`,
  ].filter(Boolean).join('\n');
}

// 결정적 벡터 id. 같은 날짜·인덱스면 항상 같은 id → upsert/delete 가 멱등.
export function vectorId(date, idx) {
  return `${date}#${idx}`;
}

// 텍스트 배열 → 임베딩 벡터 배열. bge-m3 응답 구조 차이를 방어적으로 흡수.
export async function embed(env, texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const res = await env.AI.run(EMBED_MODEL, { text: batch });
    const vecs = res?.data || res?.response?.data || res?.response || res?.embeddings;
    if (!Array.isArray(vecs)) {
      throw new Error('EMBED_BAD_RESPONSE');
    }
    out.push(...vecs);
  }
  return out;
}

// 질문 1건 임베딩(단일 벡터 반환).
export async function embedQuery(env, text) {
  const [v] = await embed(env, [text]);
  if (!Array.isArray(v) || v.length !== EMBED_DIM) {
    throw new Error('EMBED_DIM_MISMATCH');
  }
  return v;
}

// 한 날짜의 companies 전체를 임베딩→upsert. 반환: upsert 한 개수.
export async function upsertReport(env, date, companies) {
  if (!companies.length) return 0;
  const texts = companies.map(companyToText);
  const vecs = await embed(env, texts);
  const vectors = companies.map((c, idx) => ({
    id: vectorId(date, idx),
    values: vecs[idx],
    metadata: {
      date,
      idx,
      name: String(c.name || '').slice(0, 200),
      category: String(c.category || '').slice(0, 40),
      snippet: String((c.keyPoints || [])[0] || '').slice(0, META_SNIPPET_MAX),
    },
  }));
  await env.VECTORIZE.upsert(vectors);
  return vectors.length;
}

// 한 날짜의 기존 벡터 삭제. count = 그 날짜에 있던 기업 수(기존행 기준).
// 존재하지 않는 id 삭제는 no-op 이므로 약간 넉넉히 지워도 안전하다.
export async function deleteReportVectors(env, date, count) {
  if (!count || count <= 0) return 0;
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(vectorId(date, i));
  await env.VECTORIZE.deleteByIds(ids);
  return ids.length;
}

// 증분 재인덱싱: 기존 벡터 삭제 후 새 companies upsert.
// oldCount = 재인덱싱 전 그 날짜의 기업 수(없으면 0).
export async function reindexDate(env, date, oldCount, companies) {
  await deleteReportVectors(env, date, oldCount);
  return upsertReport(env, date, companies);
}
