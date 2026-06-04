// functions/_dart.js — DART(opendart) 회사개황 + 재무(연도 요약 + 분기 추이) + D1 캐시.
//   키: env.DART_API_KEY. 호출은 서버(Function)에서만.
//   - 연도 요약: 사업보고서(11011) 1콜 → 당기/전기/전전기(3개년) + 전년비(YoY)
//   - 분기 추이: 1Q/반기/3Q/사업보고서는 "누적값" → 분기값은 차분으로 계산(최신 4분기)
const DART = 'https://opendart.fss.or.kr/api';
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // 재무는 분기 갱신 → 7일 캐시
const REPRT = { 1: '11013', 2: '11012', 3: '11014', 4: '11011' };

function num(s) {
  if (s == null) return null;
  const v = String(s).replace(/[,\s]/g, '');
  if (v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function dartJson(env, path, params) {
  const qs = new URLSearchParams({ crtfc_key: env.DART_API_KEY, ...params });
  const r = await fetch(`${DART}/${path}?${qs}`, { headers: { 'User-Agent': 'AXBizRadar/1.0', Accept: 'application/json' } });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error('DART_NON_JSON ' + r.status + ' ' + t.slice(0, 60)); }
}

// 회사개황. status!=='000'(데이터 없음/오류)면 null.
export async function fetchCompany(env, corpCode) {
  const d = await dartJson(env, 'company.json', { corp_code: corpCode });
  if (d.status !== '000') return null;
  const est = (d.est_dt || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  const clsMap = { Y: '유가증권(KOSPI)', K: '코스닥', N: '코넥스', E: '기타' };
  return {
    name: d.corp_name,
    ceo: d.ceo_nm || '',
    stockCode: (d.stock_code || '').trim() || null,
    corpClass: clsMap[d.corp_cls] || '',
    established: est,
    address: d.adres || '',
    homepage: (d.hm_url || '').trim(),
    industryCode: d.induty_code || '',
  };
}

// 연결(CFS) 우선·없으면 별도(OFS) 행에서 계정 조회 헬퍼
function pickRows(list) {
  const cfs = list.filter((x) => x.fs_div === 'CFS');
  return cfs.length ? { rows: cfs, fs: '연결' } : { rows: list.filter((x) => x.fs_div === 'OFS'), fs: '별도' };
}

// 연도 요약: 최근 3개년 매출/영업이익 + 전년비. 사업보고서(11011) 최신 연도부터 시도.
export async function fetchAnnual(env, corpCode) {
  for (const year of [2025, 2024, 2023]) {
    const d = await dartJson(env, 'fnlttSinglAcnt.json', { corp_code: corpCode, bsns_year: String(year), reprt_code: '11011' });
    if (d.status !== '000' || !Array.isArray(d.list) || !d.list.length) continue;
    const { rows, fs } = pickRows(d.list);
    if (!rows.length) continue;
    const grab = (nm) => {
      const r = rows.find((x) => (x.account_nm || '').trim() === nm);
      return r ? { cur: num(r.thstrm_amount), prev: num(r.frmtrm_amount), prev2: num(r.bfefrmtrm_amount) } : null;
    };
    const rev = grab('매출액');
    const op = grab('영업이익');
    if (!rev && !op) continue;
    const series = (g) => (g ? [
      { year: year - 2, value: g.prev2 },
      { year: year - 1, value: g.prev },
      { year, value: g.cur },
    ] : null);
    const yoy = (g) => (g && g.cur != null && g.prev != null && g.prev !== 0 ? (g.cur - g.prev) / Math.abs(g.prev) : null);
    return {
      baseYear: year,
      fs,
      revenue: series(rev),
      revenueYoY: yoy(rev),
      operatingProfit: series(op),
      operatingProfitYoY: yoy(op),
    };
  }
  return null;
}

// 특정 연도·분기 보고서의 누적 매출/영업이익.
async function cumAccounts(env, corpCode, year, q) {
  const d = await dartJson(env, 'fnlttSinglAcnt.json', { corp_code: corpCode, bsns_year: String(year), reprt_code: REPRT[q] });
  if (d.status !== '000' || !Array.isArray(d.list) || !d.list.length) return null;
  const { rows } = pickRows(d.list);
  const get = (nm) => {
    const r = rows.find((x) => (x.account_nm || '').trim() === nm);
    return r ? num(r.thstrm_amount) : null;
  };
  const rev = get('매출액');
  const op = get('영업이익');
  if (rev == null && op == null) return null;
  return { rev, op };
}

// 분기 추이: 최신 4분기 매출/영업이익. 누적 → 차분.
export async function fetchQuarterly(env, corpCode) {
  const nowY = new Date().getUTCFullYear();
  const series = [];
  for (const y of [nowY - 1, nowY]) {
    const cum = {};
    for (const q of [1, 2, 3, 4]) cum[q] = await cumAccounts(env, corpCode, y, q);
    for (const q of [1, 2, 3, 4]) {
      const c = cum[q];
      if (!c) continue;
      let revenue = c.rev;
      let operatingProfit = c.op;
      if (q > 1) {
        const p = cum[q - 1];
        if (!p) continue;
        revenue = c.rev != null && p.rev != null ? c.rev - p.rev : null;
        operatingProfit = c.op != null && p.op != null ? c.op - p.op : null;
      }
      series.push({ period: `${String(y).slice(2)}Q${q}`, revenue, operatingProfit });
    }
  }
  const valid = series.filter((x) => x.revenue != null || x.operatingProfit != null);
  return valid.length ? valid.slice(-4) : null;
}

// 회사개황 + 재무(연도 요약 + 분기 추이) (D1 캐시). 7일 이내 캐시 재사용.
export async function getCompanyData(env, corpCode) {
  try {
    const row = await env.DB.prepare('SELECT profile, financials, fetched_at FROM company_profile WHERE corp_code = ?').bind(corpCode).first();
    if (row && row.fetched_at) {
      const age = Date.now() - Date.parse(row.fetched_at.replace(' ', 'T') + 'Z'); // D1 datetime('now')=UTC
      if (Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS) {
        return {
          company: row.profile ? JSON.parse(row.profile) : null,
          financials: row.financials ? JSON.parse(row.financials) : null,
          cached: true,
        };
      }
    }
  } catch { /* 캐시 미스 → 신규 조회 */ }

  const company = await fetchCompany(env, corpCode);
  const annual = await fetchAnnual(env, corpCode);
  const quarterly = await fetchQuarterly(env, corpCode);
  const financials = annual || quarterly ? { annual, quarterly } : null;
  try {
    await env.DB
      .prepare(
        `INSERT INTO company_profile (corp_code, profile, financials, fetched_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(corp_code) DO UPDATE SET
           profile = excluded.profile, financials = excluded.financials, fetched_at = datetime('now')`
      )
      .bind(corpCode, company ? JSON.stringify(company) : null, financials ? JSON.stringify(financials) : null)
      .run();
  } catch { /* 캐시 쓰기 실패 무시 */ }
  return { company, financials, cached: false };
}
