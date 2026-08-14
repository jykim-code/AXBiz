// /api/company-aliases  (공개 GET)
//   → { "NVIDIA": ["엔비디아"], "피씨엔": ["PCN"], ... }
//
//   기업 검색 별칭. 관리자가 /admin 에서 편집하고(POST /api/company-meta) 여기로 읽어 간다.
//   화면에 노출되는 값이 아니라 검색어 매칭에만 쓰이므로 PIN 없이 공개한다.
//   aliases 가 NULL 인 기업은 응답에 넣지 않는다 — 클라이언트가 코드의 시드 사전을 쓴다.
//   '[]' 로 저장된 기업은 빈 배열로 내려보내 "별칭 없음"을 명시한다(시드 사전을 덮는다).

export async function onRequestGet({ env }) {
  try {
    const r = await env.DB
      .prepare('SELECT name, aliases FROM company_meta WHERE aliases IS NOT NULL')
      .all();
    const out = {};
    (r.results || []).forEach((row) => {
      let list;
      try { list = JSON.parse(row.aliases); } catch { return; }
      if (Array.isArray(list)) out[row.name] = list.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim());
    });
    return Response.json(out, {
      // 별칭은 자주 바뀌지 않는다. 관리자가 저장한 뒤 최대 5분 뒤 반영되는 정도는 감수한다.
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('GET /api/company-aliases', err);
    // 검색은 시드 사전으로도 동작해야 하므로 빈 객체로 응답한다(500 으로 화면을 막지 않는다).
    return Response.json({}, { headers: { 'Cache-Control': 'no-store' } });
  }
}
