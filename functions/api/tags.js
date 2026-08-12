// /api/tags  (관리자 PIN)
//   POST { name?, remove?: [], add?: [] }
//   - name 있음: 해당 기업의 모든 항목에서 remove 태그 제거 + add 태그 추가
//   - name 없음: 전역 — 모든 기업·날짜에서 remove 태그 제거 (전역 add 는 불허)
//   reports 원본을 직접 수정하고, 파생 테이블(company_entries)까지 맞춘 뒤 영향 날짜를 반환한다.
//   Vectorize 재색인만 호출 측(admin)이 날짜별로 수행한다(요청당 서브요청 한도 회피).
import { rebuildCompanyEntries } from '../_entries.js';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// 삭제 대상은 "이미 저장된 값"과 맞춰야 하므로 길이를 자르지 않는다.
//   reports.js 는 태그를 2000자까지 저장하므로 40자로 자르면 그보다 긴 태그는
//   영원히 일치하지 않아 조용히 삭제 실패했다
//   (LLM 이 전각 쉼표 '，' 로 이어붙여 만든 45자 태그 등).
const MAX_TAG = 2000;
const norm = (t) => String(t == null ? '' : t).trim().slice(0, MAX_TAG);
const uniq = (arr, cap) => [...new Set((Array.isArray(arr) ? arr : []).map(norm).filter(Boolean))].slice(0, cap);

export async function onRequestPost({ request, env }) {
  const pin = request.headers.get('x-admin-pin') || '';
  if (!env.ADMIN_PIN || !timingSafeEqual(pin, env.ADMIN_PIN)) {
    await new Promise((r) => setTimeout(r, 500));
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const name = body?.name ? String(body.name).trim().slice(0, 200) : '';
  const removeSet = new Set(uniq(body?.remove, 50));
  // 새로 붙이는 태그만 짧게 유지(입력 실수로 문장이 태그가 되는 것 방지).
  const add = name ? uniq(body?.add, 50).map((t) => t.slice(0, 40)) : []; // 전역 추가는 의미 없음
  if (!removeSet.size && !add.length) return Response.json({ error: 'NO_OP' }, { status: 400 });

  let rows;
  try {
    rows = (await env.DB.prepare('SELECT date, companies FROM reports').all()).results || [];
  } catch (err) {
    console.error('POST /api/tags: read', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  const stmts = [];
  const affected = [];
  let removed = 0;
  let added = 0;
  let matchedCompany = 0;
  for (const row of rows) {
    let companies;
    try { companies = JSON.parse(row.companies || '[]'); } catch { continue; }
    if (!Array.isArray(companies)) continue;
    let changed = false;
    for (const c of companies) {
      if (!c || (name && c.name !== name)) continue;
      matchedCompany++;
      const before = Array.isArray(c.tags) ? c.tags : [];
      // 저장된 값에 앞뒤 공백이 섞여 있어도 지워지도록 정규화해서 비교한다.
      let tags = removeSet.size ? before.filter((t) => !removeSet.has(norm(t))) : before.slice();
      removed += before.length - tags.length;
      if (add.length) {
        const s = new Set(tags);
        const n0 = s.size;
        add.forEach((t) => s.add(t));
        added += s.size - n0;
        tags = [...s];
      }
      if (tags.join('\0') !== before.join('\0')) { c.tags = tags; changed = true; }
    }
    if (changed) {
      affected.push(row.date);
      stmts.push(env.DB.prepare("UPDATE reports SET companies = ?, updated_at = datetime('now') WHERE date = ?").bind(JSON.stringify(companies), row.date));
    }
  }

  try {
    if (stmts.length) await env.DB.batch(stmts);
  } catch (err) {
    console.error('POST /api/tags: write', err);
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  // reports 만 고치고 끝내면 기업별 페이지가 읽는 company_entries 가 낡은 태그를 계속 보여준다.
  // 호출자(admin)가 영향 날짜를 재저장하지 않거나 중간에 실패하면 그대로 어긋난 채 남는다
  // (실측: 95개 날짜 중 50개가 이 경로로 어긋나 있었다). 여기서 직접 맞춘다.
  let entriesWarning;
  try {
    await rebuildCompanyEntries(env, affected);
  } catch (err) {
    console.error('POST /api/tags: entries', err);
    entriesWarning = String((err && err.message) || err);
  }

  // removed/added 를 함께 돌려줘 admin 이 "0건 변경"을 성공으로 오해하지 않게 한다.
  return Response.json({ ok: true, affectedDates: affected.sort(), removed, added, matchedCompany, entriesWarning });
}
