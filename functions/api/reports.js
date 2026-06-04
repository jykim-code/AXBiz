// /api/reports
//   GET  ?date=YYYY-MM-DD  → 해당 날짜 companies 배열(없으면 [])  (공개)
//   POST                   → upsert. 헤더 x-admin-pin 서버 검증 (자동화 진입점)
//                            저장 성공 후 Vectorize 증분 재색인(old 삭제→new upsert).

import { reindexDate } from '../_rag.js';

const CATEGORIES = ['대기업', '중견기업', '스타트업·중소'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 입력 상한 (DoS / 저장 비대 방지)
const MAX_BODY_BYTES = 1_000_000; // 1MB
const MAX_COMPANIES = 200;
const MAX_ARR = 50; // bullets/tags 개수
const MAX_NAME = 200;
const MAX_URL = 1000;
const MAX_STR = 2000; // bullet 1개 길이

// 형태(정규식) + 실제 달력 유효성까지 검증 (2026-13-40 같은 값 거부)
function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const dt = new Date(s + 'T00:00:00Z');
  return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === s;
}

// 타이밍 공격 완화용 상수시간 문자열 비교
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, MAX_ARR)
    .map((x) => String(x == null ? '' : x).trim().slice(0, MAX_STR))
    .filter(Boolean);
}

// 입력을 신뢰 가능한 형태로 정규화. 필수값(name/유효 category) 없으면 null로 버림.
function sanitizeCompany(c) {
  if (!c || typeof c !== 'object') return null;
  const name = String(c.name || '').trim();
  const category = String(c.category || '').trim();
  if (!name || !CATEGORIES.includes(category)) return null;
  return {
    name: name.slice(0, MAX_NAME),
    category,
    sourceUrl: String(c.sourceUrl || '').trim().slice(0, MAX_URL),
    confluenceUrl: String(c.confluenceUrl || '').trim().slice(0, MAX_URL),
    keyPoints: asStringArray(c.keyPoints),
    implications: asStringArray(c.implications),
    hancomInsight: asStringArray(c.hancomInsight),
    tags: asStringArray(c.tags),
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date || !isValidDate(date)) {
    return Response.json({ error: 'INVALID_DATE' }, { status: 400 });
  }
  try {
    const row = await env.DB
      .prepare('SELECT companies FROM reports WHERE date = ?')
      .bind(date)
      .first();
    let companies = [];
    if (row) {
      try {
        companies = JSON.parse(row.companies || '[]');
      } catch {
        companies = [];
      }
    }
    return Response.json(companies);
  } catch (err) {
    console.error('GET /api/reports', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) {
    // 무차별 대입 완화(best-effort). 운영에서는 Cloudflare Rate Limiting 규칙 병행 권장.
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

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

  const date = String(body?.date || '').trim();
  if (!isValidDate(date)) {
    return Response.json({ error: 'INVALID_DATE' }, { status: 400 });
  }
  if (!Array.isArray(body?.companies)) {
    return Response.json({ error: 'INVALID_COMPANIES' }, { status: 400 });
  }
  if (body.companies.length > MAX_COMPANIES) {
    return Response.json({ error: 'TOO_MANY_COMPANIES', max: MAX_COMPANIES }, { status: 413 });
  }

  const companies = body.companies.map(sanitizeCompany).filter(Boolean);
  const json = JSON.stringify(companies);

  // 증분 재색인을 위해, 덮어쓰기 전 그 날짜의 기존 기업 수를 읽어 둔다.
  let oldCount = 0;
  try {
    const prev = await env.DB
      .prepare('SELECT companies FROM reports WHERE date = ?')
      .bind(date)
      .first();
    if (prev) {
      const arr = JSON.parse(prev.companies || '[]');
      if (Array.isArray(arr)) oldCount = arr.length;
    }
  } catch {
    oldCount = 0; // 실패해도 저장은 진행(색인은 best-effort)
  }

  try {
    await env.DB
      .prepare(
        `INSERT INTO reports (date, companies, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           companies = excluded.companies,
           updated_at = datetime('now')`
      )
      .bind(date, json)
      .run();
  } catch (err) {
    console.error('POST /api/reports', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  // D1(원본)은 저장됐다. Vectorize 증분 재색인은 best-effort —
  // 실패해도 저장 자체는 성공으로 보고하되 indexWarning 으로 알린다.
  let indexWarning;
  if (env.AI && env.VECTORIZE) {
    try {
      await reindexDate(env, date, oldCount, companies);
    } catch (err) {
      console.error('POST /api/reports: reindex', err);
      indexWarning = String((err && err.message) || err);
    }
  }

  return Response.json({ ok: true, date, count: companies.length, ...(indexWarning ? { indexWarning } : {}) });
}
