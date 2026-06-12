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

// dev 프리뷰: ?preview=1 + sessionStorage PIN 이면 draft 합본(dev) 엔드포인트로 라우팅.
function devPin() { try { return sessionStorage.getItem('devPin') || ''; } catch { return ''; } }
function devPreviewActive() {
  try { return new URLSearchParams(location.search).get('preview') === '1' && !!devPin(); } catch { return false; }
}
async function getJSONPin(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'x-admin-pin': devPin() } });
  if (!res.ok) { const err = new Error('REQUEST_FAILED'); err.status = res.status; throw err; }
  return res.json();
}

const API = {
  // 데이터가 있는 날짜 배열(desc)
  dates() {
    return getJSON('/api/dates');
  },
  // 특정 날짜 companies 배열 (dev 프리뷰면 draft 합본, 실패 시 공개로 폴백)
  report(date) {
    const pub = '/api/reports?date=' + encodeURIComponent(date);
    if (devPreviewActive()) return getJSONPin('/api/dev/reports?date=' + encodeURIComponent(date)).catch(() => getJSON(pub));
    return getJSON(pub);
  },
  // 전체 보고서 [{date, companies}] — 그래프/통계 누적용 (dev 프리뷰면 draft 합본)
  all() {
    if (devPreviewActive()) return getJSONPin('/api/dev/reports-all').catch(() => getJSON('/api/reports/all'));
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
  // 기간 종합 (공개). { summary } — 다건 기업의 기간 동향 1~2문장 종합
  async periodSummary(payload) {
    const res = await fetch('/api/period-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { summary: null };
    return res.json();
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
  // AI 태그 추천 (관리자, PIN). { tags: [...] } 반환
  async suggestTags(payload, pin) {
    const res = await fetch('/api/suggest-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || '' },
      body: JSON.stringify(payload),
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

  // ===== dev 검수·배포 (PIN, sessionStorage devPin) =====
  isDevPreview() { return devPreviewActive(); },
  async devVerifyPin(pin) {
    const res = await fetch('/api/dev/drafts', { headers: { Accept: 'application/json', 'x-admin-pin': pin || '' } });
    return res.ok;
  },
  async devImport(url) {
    const res = await fetch('/api/dev/import', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify({ url }) });
    let data = {}; try { data = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
  async devImportDaily(url) {
    const res = await fetch('/api/dev/import-daily', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify({ url }) });
    let data = {}; try { data = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
  async devDrafts() {
    const res = await fetch('/api/dev/drafts', { headers: { Accept: 'application/json', 'x-admin-pin': devPin() } });
    if (!res.ok) { const err = new Error('REQUEST_FAILED'); err.status = res.status; throw err; }
    return res.json();
  },
  async devCreateDrafts(date, items) {
    const res = await fetch('/api/dev/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify({ action: 'create', date, items }) });
    let d = {}; try { d = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(d.error || 'REQUEST_FAILED'); err.status = res.status; throw err; }
    return d;
  },
  async devUpdateDraft(id, data) {
    const res = await fetch('/api/dev/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify({ id, action: 'update', data }) });
    let d = {}; try { d = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(d.error || 'REQUEST_FAILED'); err.status = res.status; throw err; }
    return d;
  },
  async devDeleteDraft(id) {
    const res = await fetch('/api/dev/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify({ id, action: 'delete' }) });
    let data = {}; try { data = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; throw err; }
    return data;
  },
  async devPublish(payload) {
    const res = await fetch('/api/dev/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify(payload || {}) });
    let data = {}; try { data = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
};
