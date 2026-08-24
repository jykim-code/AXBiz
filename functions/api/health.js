// GET /api/health
//   공개: { ok, db } — 인증 설정 상태는 노출하지 않는다.
//   x-admin-pin 이 맞으면 바인딩·시크릿의 "설정 여부(true/false)"만 덧붙인다.
//   값은 어떤 경우에도 반환하지 않는다. 배포 환경(운영/스테이징)별로 무엇이
//   실제 런타임 env 에 들어왔는지 확인하는 용도 — 시크릿은 등록돼 있어도
//   배포 시점에 주입되지 않으면 여기서 false 로 보인다.
import { pinOk } from '../_auth.js';

// WEEKLY_WEBHOOK_URL·SITE_ORIGIN 은 회차를 메신저로 보낼 때 쓴다(2026-08-24).
// 환경변수는 배포 시점에 묶이므로 「대시보드에 넣었는데 왜 안 되나」를 여기서 가른다 —
// 값을 넣은 뒤 재배포하지 않았으면 등록돼 있어도 false 로 보인다.
// WEEKLY_WEBHOOK_LABEL 도 같이 본다 — 이 값이 비면 발송 확인창에 「보낼 곳」 줄이 사라져
// 전사 라운지로 나가는지 테스트 방으로 나가는지 모르는 채 확인을 누르게 된다.
const SECRET_KEYS = ['ADMIN_PIN', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'DART_API_KEY',
  'WEEKLY_WEBHOOK_URL', 'WEEKLY_WEBHOOK_LABEL', 'SITE_ORIGIN'];

export function onRequestGet({ env, request }) {
  const base = { ok: true, db: !!env.DB };
  if (!pinOk(env, request)) return Response.json(base);

  const secrets = {};
  for (const k of SECRET_KEYS) secrets[k] = !!env[k];
  return Response.json({
    ...base,
    // IMG = 픽 이미지 R2 버킷(2026-08-24). 없으면 이미지 업로드·서빙이 500 으로 떨어진다.
    bindings: { DB: !!env.DB, AI: !!env.AI, VECTORIZE: !!env.VECTORIZE, RL: !!env.RL, IMG: !!env.IMG },
    secrets,
  });
}
