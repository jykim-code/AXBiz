// GET /api/health
//   공개: { ok, db } — 인증 설정 상태는 노출하지 않는다.
//   x-admin-pin 이 맞으면 바인딩·시크릿의 "설정 여부(true/false)"만 덧붙인다.
//   값은 어떤 경우에도 반환하지 않는다. 배포 환경(운영/스테이징)별로 무엇이
//   실제 런타임 env 에 들어왔는지 확인하는 용도 — 시크릿은 등록돼 있어도
//   배포 시점에 주입되지 않으면 여기서 false 로 보인다.
import { pinOk } from '../_auth.js';

const SECRET_KEYS = ['ADMIN_PIN', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'DART_API_KEY'];

export function onRequestGet({ env, request }) {
  const base = { ok: true, db: !!env.DB };
  if (!pinOk(env, request)) return Response.json(base);

  const secrets = {};
  for (const k of SECRET_KEYS) secrets[k] = !!env[k];
  return Response.json({
    ...base,
    bindings: { DB: !!env.DB, AI: !!env.AI, VECTORIZE: !!env.VECTORIZE, RL: !!env.RL },
    secrets,
  });
}
