// functions/_entries.js — company_entries(기업별 타임라인 파생 테이블) 동기화 공용.
//   reports 의 한 날짜가 바뀔 때 그 날짜의 행들을 재구축한다(날짜 기준 delete→insert).
//   원본은 reports — 이 테이블은 언제든 백필로 재생성 가능.
//   같은 (기업, 날짜)에 동향이 둘 이상 올 수 있으므로 seq 로 구분한다(PK 3열).
// 여러 날짜를 reports 원본에서 한 번에 재구축. seq 부여 규칙은 syncCompanyEntries 와 같다
// (그 날짜 배열 순서대로 같은 이름끼리 0,1,2…). 날짜 수와 무관하게 쿼리 2개라
// reports 를 직접 고치는 경로(예: /api/tags)에서 파생 테이블을 값싸게 맞출 수 있다.
export async function rebuildCompanyEntries(env, dates) {
  const list = [...new Set((dates || []).filter(Boolean))];
  if (!list.length) return 0;
  const marks = list.map(() => '?').join(',');
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM company_entries WHERE date IN (${marks})`).bind(...list),
    env.DB.prepare(
      `INSERT INTO company_entries (company, date, seq, category, data)
       SELECT json_extract(je.value, '$.name'), r.date,
              ROW_NUMBER() OVER (PARTITION BY r.date, json_extract(je.value, '$.name') ORDER BY je.key) - 1,
              COALESCE(json_extract(je.value, '$.category'), ''), je.value
       FROM reports r, json_each(r.companies) je
       WHERE r.date IN (${marks}) AND json_extract(je.value, '$.name') IS NOT NULL`
    ).bind(...list),
  ]);
  return list.length;
}

export async function syncCompanyEntries(env, date, companies) {
  const stmts = [env.DB.prepare('DELETE FROM company_entries WHERE date = ?').bind(date)];
  const seqOf = {};
  for (const c of companies || []) {
    if (!c || !c.name) continue;
    const seq = seqOf[c.name] = (seqOf[c.name] == null ? 0 : seqOf[c.name] + 1);
    stmts.push(
      env.DB
        .prepare('INSERT INTO company_entries (company, date, seq, category, data) VALUES (?, ?, ?, ?, ?)')
        .bind(c.name, date, seq, c.category || '', JSON.stringify(c))
    );
  }
  await env.DB.batch(stmts);
}
