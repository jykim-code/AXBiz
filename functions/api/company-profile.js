// /api/company-profile?name=  (공개)
//   기업 표시명 → company_meta.corp_code → DART 회사개황 + 최신 4분기 매출/영업이익(캐시).
//   매핑 없음/해외/미설정이면 { available:false } 로 우아하게 응답.
import { getCompanyData } from '../_dart.js';

export async function onRequestGet({ request, env }) {
  if (!env.DART_API_KEY) return Response.json({ available: false, reason: 'NOT_CONFIGURED' });
  const name = new URL(request.url).searchParams.get('name');
  if (!name) return Response.json({ error: 'INVALID_NAME' }, { status: 400 });

  let corpCode = null;
  let overrides = null; // company_meta.overrides: DART 오류·관리자 수정 보정(JSON)
  try {
    const row = await env.DB.prepare('SELECT corp_code, overrides FROM company_meta WHERE name = ?').bind(name).first();
    corpCode = row && row.corp_code ? String(row.corp_code).trim() : null;
    if (row && row.overrides) { try { overrides = JSON.parse(row.overrides); } catch { /* 무시 */ } }
  } catch (err) {
    console.error('/api/company-profile: meta', err);
  }
  if (!corpCode) return Response.json({ available: false, reason: 'NO_MAPPING' });

  try {
    const data = await getCompanyData(env, corpCode);
    let company = data.company;
    if (company && overrides && typeof overrides === 'object') company = { ...company, ...overrides };
    if (!company && !data.financials) {
      return Response.json({ available: false, reason: 'NO_DATA', corpCode });
    }
    return Response.json({ available: true, corpCode, company, financials: data.financials });
  } catch (err) {
    console.error('/api/company-profile', err);
    return Response.json({ available: false, reason: 'ERROR' }, { status: 502 });
  }
}
