/* REST 래퍼 — 단일 표면(/api/*)으로 D1 접근 */

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error('REQUEST_FAILED');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const API = {
  // 데이터가 있는 날짜 배열(desc)
  dates() {
    return getJSON('/api/dates');
  },
  // 특정 날짜 companies 배열
  report(date) {
    return getJSON('/api/reports?date=' + encodeURIComponent(date));
  },
  // 전체 보고서 [{date, companies}] — 그래프/통계 누적용
  all() {
    return getJSON('/api/reports/all');
  },
  health() {
    return getJSON('/api/health');
  },
  // upsert (관리자). 실패 시 status/data 를 가진 Error throw.
  async save(date, companies, pin) {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || '' },
      body: JSON.stringify({ date, companies }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* no body */
    }
    if (!res.ok) {
      const err = new Error(data.error || 'REQUEST_FAILED');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
  // 자연어 질문 RAG (공개). { answer, sources[] } 반환. 실패 시 status 를 가진 Error throw.
  async ask(question) {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const err = new Error(data.error || 'REQUEST_FAILED');
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  },
  // 기업 회사정보+재무 (공개). { available, company?, financials? }
  companyProfile(name) {
    return getJSON('/api/company-profile?name=' + encodeURIComponent(name));
  },
  // 기업 AI 요약 (공개). { available, flow[], insight[], dataDate }
  companySummary(name) {
    return getJSON('/api/company-summary?name=' + encodeURIComponent(name));
  },
  // 의견 제출 (공개)
  async sendSuggestion(payload) {
    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const err = new Error(data.error || 'REQUEST_FAILED');
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  },
  // 접수 의견 목록 (관리자, PIN)
  async suggestions(pin) {
    const res = await fetch('/api/suggestions', { headers: { Accept: 'application/json', 'x-admin-pin': pin || '' } });
    if (!res.ok) {
      const err = new Error('REQUEST_FAILED');
      err.status = res.status;
      throw err;
    }
    return res.json();
  },
  // 기업 DART 매핑 목록 (관리자, PIN)
  async companyMetaList(pin) {
    const res = await fetch('/api/company-meta', { headers: { Accept: 'application/json', 'x-admin-pin': pin || '' } });
    if (!res.ok) { const err = new Error('REQUEST_FAILED'); err.status = res.status; throw err; }
    return res.json();
  },
  // 컨플 페이지 가져오기 (관리자, PIN): {url, dryRun?, nameOverride?, categoryOverride?}
  async importConfluence(payload, pin) {
    const res = await fetch('/api/import-confluence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || '' },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
  // 태그 데이터 변경 (관리자, PIN): {name?, remove?, add?} → {ok, affectedDates}
  async manageTags(payload, pin) {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || '' },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
  // 지식그래프 핀 태그 (GET 공개)
  pinnedTags() {
    return getJSON('/api/pinned-tags');
  },
  // 지식그래프 핀 태그 저장 (관리자, PIN)
  async savePinnedTags(tags, pin) {
    const res = await fetch('/api/pinned-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || '' },
      body: JSON.stringify({ tags }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
  // 기업 DART 매핑/보정 저장 (관리자, PIN)
  async saveCompanyMeta(payload, pin) {
    const res = await fetch('/api/company-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || '' },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
};
