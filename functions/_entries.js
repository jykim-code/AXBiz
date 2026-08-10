// functions/_entries.js — company_entries(기업별 타임라인 파생 테이블) 동기화 공용.
//   reports 의 한 날짜가 바뀔 때 그 날짜의 행들을 재구축한다(날짜 기준 delete→insert).
//   원본은 reports — 이 테이블은 언제든 백필로 재생성 가능.
//   같은 (기업, 날짜)에 동향이 둘 이상 올 수 있으므로 seq 로 구분한다(PK 3열).
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
