// /api/company-meta  (관리자 PIN)
//   GET  → 전체 매핑 목록 [{name, corp_code, overrides}]
//   POST {name, corpCode, overrides} → 기업 ↔ DART corp_code 매핑/보정 upsert
//   corpCode '' → 매핑 해제(NULL). overrides 객체 → JSON 저장(예: {ceo:'...'}).
//
//   DART 에는 동명 법인이 여럿 있어(예: '케이티' 2건 — 상장 030200 / 비상장) 코드만 받고
//   저장하면 껍데기 법인에 연결돼도 알 수 없다. 저장 전 개황을 조회해 실체를 확인하고,
//   확인된 법인명·종목코드를 응답으로 돌려준다. 확인 불가 코드는 저장하지 않는다.
import { fetchCompany, invalidateCompanyCache } from '../_dart.js';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
function forbid() {
  return new Promise((r) => setTimeout(r, 500)).then(() => Response.json({ error: 'FORBIDDEN' }, { status: 403 }));
}

export async function onRequestGet({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) return forbid();
  try {
    const r = await env.DB.prepare('SELECT name, corp_code, overrides FROM company_meta ORDER BY name').all();
    return Response.json(r.results || []);
  } catch (err) {
    console.error('GET /api/company-meta', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) return forbid();

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const name = String(body?.name || '').trim().slice(0, 200);
  if (!name) return Response.json({ error: 'INVALID_NAME' }, { status: 400 });

  // DART corp_code 는 항상 8자리. 6~7자리를 허용하면 종목코드 오입력이 그대로 저장된다.
  const corpCode = String(body?.corpCode || '').trim();
  if (corpCode && !/^\d{8}$/.test(corpCode)) return Response.json({ error: 'INVALID_CORP_CODE' }, { status: 400 });
  const corpVal = corpCode || null;

  // 저장 전 실체 확인. 개황이 안 나오는 코드(폐업·오입력)는 거부한다.
  let verified = null;
  if (corpVal && env.DART_API_KEY) {
    let profile;
    try {
      profile = await fetchCompany(env, corpVal);
    } catch (err) {
      console.error('POST /api/company-meta: DART', err);
      return Response.json({ error: 'DART_UNAVAILABLE' }, { status: 502 });
    }
    if (!profile) return Response.json({ error: 'CORP_NOT_FOUND', corpCode: corpVal }, { status: 400 });
    verified = { name: profile.name, stockCode: profile.stockCode, corpClass: profile.corpClass, listed: !!profile.stockCode };
  }

  // overrides: 객체만 허용, 빈 객체/없음은 NULL
  let overridesVal = null;
  const ov = body?.overrides;
  if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
    const clean = {};
    for (const k of ['ceo', 'homepage', 'address', 'industryCode']) {
      const v = String(ov[k] == null ? '' : ov[k]).trim().slice(0, 300);
      if (v) clean[k] = v;
    }
    if (Object.keys(clean).length) overridesVal = JSON.stringify(clean);
  }

  try {
    // 직전 매핑을 함께 조회 — 연결이 바뀌면 옛 코드 캐시도 버려야 한다.
    let prevCode = null;
    try {
      const prev = await env.DB.prepare('SELECT corp_code FROM company_meta WHERE name = ?').bind(name).first();
      prevCode = prev && prev.corp_code ? String(prev.corp_code).trim() : null;
    } catch { /* 조회 실패는 캐시 정리만 건너뜀 */ }

    await env.DB
      .prepare(
        `INSERT INTO company_meta (name, corp_code, overrides, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(name) DO UPDATE SET
           corp_code = excluded.corp_code, overrides = excluded.overrides, updated_at = datetime('now')`
      )
      .bind(name, corpVal, overridesVal)
      .run();

    // 연결이 실제로 바뀐 경우만 정리한다(대표자 보정만 저장할 때는 캐시 유지).
    if (prevCode !== corpVal) {
      if (prevCode) await invalidateCompanyCache(env, prevCode);
      if (corpVal) await invalidateCompanyCache(env, corpVal);
    }

    return Response.json({ ok: true, name, corpCode: corpVal, verified });
  } catch (err) {
    console.error('POST /api/company-meta', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
