// GET /api/reports/all — 전체 보고서 [{date, companies:[...]}] (desc)
// 용도: 좌측 지식 그래프 + 하단 통계의 "전체 기간 누적" 집계.
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare('SELECT date, companies FROM reports ORDER BY date DESC')
      .all();
    const reports = (results || []).map((r) => {
      let companies = [];
      try {
        companies = JSON.parse(r.companies || '[]');
      } catch {
        companies = [];
      }
      return { date: r.date, companies };
    });
    return Response.json(reports);
  } catch (err) {
    console.error('GET /api/reports/all', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
