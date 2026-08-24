// /api/pick-image — 위클리 픽 이미지
//   POST (관리자 PIN)  body = 이미지 바이트, Content-Type = image/*  → { key }
//   GET  ?k=<key>      (공개)                                        → 이미지
//
// 관리자가 직접 올린 파일만 들어간다. 기사 사진을 자동으로 받아 오지 않는다(2026-08-24 결정).
// 우리 도메인으로 내보내므로 _headers 의 CSP(img-src 'self')를 손대지 않아도 뜬다.
// 키는 내용 해시라 같은 파일을 두 번 올려도 하나만 쌓이고, 내용이 바뀌면 키가 바뀐다.
// 그래서 응답을 영구 캐시로 둘 수 있다 — 회차를 다시 열어도 Function 을 다시 타지 않는다.
import { pinOk, forbidden } from '../_auth.js';

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_BYTES = 5 * 1024 * 1024;

// 키 형식을 좁게 고정한다. 이걸 안 하면 ?k= 로 버킷의 다른 객체를 읽어 갈 수 있다.
const KEY_RE = /^[0-9a-f]{32}\.(jpg|png|webp)$/;

const sha256hex = async (buf) => {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('k') || '';
  if (!KEY_RE.test(key)) return new Response('BAD_KEY', { status: 400 });
  if (!env.IMG) return new Response('NO_BUCKET', { status: 500 });

  const obj = await env.IMG.get(key);
  if (!obj) return new Response('NOT_FOUND', { status: 404 });

  const type = (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream';
  return new Response(obj.body, {
    headers: {
      'Content-Type': type,
      // 키가 내용 해시라 같은 키의 내용은 절대 바뀌지 않는다 → 영구 캐시가 안전하다.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!pinOk(env, request)) return forbidden();
  if (!env.IMG) return Response.json({ error: 'NO_BUCKET' }, { status: 500 });

  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return Response.json({ error: 'TYPE_NOT_ALLOWED', type, allow: Object.keys(TYPES) }, { status: 415 });

  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return Response.json({ error: 'EMPTY' }, { status: 400 });
  if (buf.byteLength > MAX_BYTES) {
    return Response.json({ error: 'TOO_LARGE', bytes: buf.byteLength, max: MAX_BYTES }, { status: 413 });
  }

  // Content-Type 은 보내는 쪽 말이라 그대로 믿지 않는다. 파일 앞부분(매직 넘버)으로 확인한다.
  const b = new Uint8Array(buf);
  const isJpg = b[0] === 0xFF && b[1] === 0xD8;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  const isWebp = b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (!(isJpg || isPng || isWebp)) return Response.json({ error: 'NOT_AN_IMAGE' }, { status: 415 });

  const key = (await sha256hex(buf)).slice(0, 32) + '.' + ext;
  await env.IMG.put(key, buf, { httpMetadata: { contentType: type } });

  // 실제 크기는 서버에서 재지 않는다 — 관리자 화면이 브라우저에서 재서 경고를 띄운다
  // (Workers 에는 이미지 처리가 없고 Cloudflare Images 는 유료다).
  return Response.json({ ok: true, key, bytes: buf.byteLength, type });
}
