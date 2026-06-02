// /api/suggestions
//   POST                 → 의견 접수 (공개). 허니팟 + 검증 + 길이 상한.
//   GET                  → 접수 목록 (관리자). 헤더 x-admin-pin 서버 검증.

const MAX_BODY_BYTES = 200_000;
const MAX_CONTENT = 4000;
const MAX_SHORT = 200;
const TYPES = ['기업 추가 요청', '내용 추가/수정', '오류 제보', '기타'];

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
const short = (v) => String(v == null ? '' : v).trim().slice(0, MAX_SHORT);

export async function onRequestPost({ request, env }) {
  const contentLength = +(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  // 허니팟: 봇이 채우는 숨김 필드. 채워져 있으면 저장하지 않고 성공처럼 응답.
  if (body && String(body.hp || '').trim()) {
    return Response.json({ ok: true });
  }

  const content = String(body?.content || '').trim().slice(0, MAX_CONTENT);
  if (!content) {
    return Response.json({ error: 'EMPTY_CONTENT' }, { status: 400 });
  }
  let type = short(body?.type);
  if (!TYPES.includes(type)) type = '기타';
  const company = short(body?.company);
  const team = short(body?.team);
  const name = short(body?.name);

  try {
    await env.DB
      .prepare('INSERT INTO suggestions (type, company, content, team, name) VALUES (?, ?, ?, ?, ?)')
      .bind(type, company, content, team, name)
      .run();
    return Response.json({ ok: true });
  } catch (err) {
    console.error('POST /api/suggestions', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

export async function onRequestGet({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  try {
    const { results } = await env.DB
      .prepare('SELECT id, created_at, type, company, content, team, name, status FROM suggestions ORDER BY id DESC LIMIT 500')
      .all();
    return Response.json(results || []);
  } catch (err) {
    console.error('GET /api/suggestions', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
