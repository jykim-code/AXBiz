// 공용 관리자 PIN 검증 (x-admin-pin). 상수시간 비교.
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export function pinOk(env, request) {
  const pin = request.headers.get('x-admin-pin') || '';
  return !!env.ADMIN_PIN && timingSafeEqual(pin, env.ADMIN_PIN);
}

// 403 응답(무차별 대입 완화용 지연 포함)
export async function forbidden() {
  await new Promise((r) => setTimeout(r, 500));
  return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
}
