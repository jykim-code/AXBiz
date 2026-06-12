// 라이브 reports 병합 저장 공용 — import-confluence·dev/publish 공용.
import { reindexDate } from './_rag.js';
import { syncCompanyEntries } from './_entries.js';

const CATEGORIES = ['대기업', '중견기업', '스타트업·중소'];
const MAX_ARR = 50, MAX_STR = 2000, MAX_NAME = 200, MAX_URL = 1000;

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_ARR).map((x) => String(x == null ? '' : x).trim().slice(0, MAX_STR)).filter(Boolean);
}

// reports 저장용 정규화(reports.js sanitizeCompany 와 동일 규칙 + summary).
export function sanitizeCompany(c) {
  if (!c || typeof c !== 'object') return null;
  const name = String(c.name || '').trim();
  const category = String(c.category || '').trim();
  if (!name || !CATEGORIES.includes(category)) return null;
  return {
    name: name.slice(0, MAX_NAME),
    category,
    summary: String(c.summary || '').trim().slice(0, 300),
    sourceUrl: String(c.sourceUrl || '').trim().slice(0, MAX_URL),
    confluenceUrl: String(c.confluenceUrl || '').trim().slice(0, MAX_URL),
    keyPoints: asStringArray(c.keyPoints),
    implications: asStringArray(c.implications),
    hancomInsight: asStringArray(c.hancomInsight),
    tags: asStringArray(c.tags),
  };
}

// 한 날짜에 newCompanies(기업별 항목)를 병합 저장: 같은 이름은 교체, 나머지 유지.
//   + company_entries 동기화 + (AI 바인딩 있으면) 증분 재색인. best-effort.
// 반환: 저장된 companies 배열.
export async function mergeAndPublishDate(env, date, newCompanies) {
  const clean = (newCompanies || []).map(sanitizeCompany).filter(Boolean);
  const row = await env.DB.prepare('SELECT companies FROM reports WHERE date = ?').bind(date).first();
  let existing = [];
  if (row) { try { existing = JSON.parse(row.companies || '[]'); } catch { existing = []; } }
  if (!Array.isArray(existing)) existing = [];
  const oldCount = existing.length;
  const names = new Set(clean.map((c) => c.name));
  const companies = existing.filter((c) => c && !names.has(c.name)).concat(clean); // 새 항목=진실원

  await env.DB
    .prepare(`INSERT INTO reports (date, companies, updated_at) VALUES (?, ?, datetime('now'))
              ON CONFLICT(date) DO UPDATE SET companies = excluded.companies, updated_at = datetime('now')`)
    .bind(date, JSON.stringify(companies)).run();

  try { await syncCompanyEntries(env, date, companies); } catch (err) { console.error('publish: entries', date, err); }
  if (env.AI && env.VECTORIZE) {
    try { await reindexDate(env, date, oldCount, companies); } catch (err) { console.error('publish: reindex', date, err); }
  }
  return companies;
}
