// GET /api/health — 공개 점검용. 인증 설정 상태(ADMIN_PIN)는 노출하지 않는다.
export function onRequestGet({ env }) {
  return Response.json({ ok: true, db: !!env.DB });
}
