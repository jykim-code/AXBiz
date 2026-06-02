// GET /api/dates — 데이터가 있는 날짜 배열(desc). 캘린더 하이라이트 + 최신 기본값 산출용.
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare('SELECT date FROM reports ORDER BY date DESC')
      .all();
    return Response.json((results || []).map((r) => r.date));
  } catch (err) {
    console.error('GET /api/dates', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
