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

// dev 프리뷰: 저장된 PIN + 미리보기 모드면 draft 합본(dev) 엔드포인트로 라우팅.
// PIN 은 localStorage(탭 간 공유 — admin 인증 후 새 탭 미리보기 허용). 403 시 제거됨.
// 미리보기 모드는 sessionStorage(탭 고정): ?preview=1 로 한번 진입하면 그 탭 내 모든 페이지 이동에서 유지
// (사이드바·카드 링크로 옮겨도 draft 유지). "실서비스 보기"가 플래그를 지워 빠져나감.
function devPin() {
  try { return localStorage.getItem('devPin') || sessionStorage.getItem('devPin') || ''; } catch { return ''; }
}
function devPreviewActive() {
  try {
    if (!devPin()) return false;
    if (new URLSearchParams(location.search).get('preview') === '1') { sessionStorage.setItem('previewMode', '1'); return true; }
    return sessionStorage.getItem('previewMode') === '1';
  } catch { return false; }
}
async function getJSONPin(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'x-admin-pin': devPin() } });
  if (!res.ok) { const err = new Error('REQUEST_FAILED'); err.status = res.status; throw err; }
  return res.json();
}

// 관리자 POST 공용 — 실패 시 서버가 준 error 코드를 담은 Error throw (호출부가 분기할 수 있게).
async function postPin(url, payload, pin) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || '' },
    body: JSON.stringify(payload || {}),
  });
  let data = {};
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(data.error || 'REQUEST_FAILED');
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
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
  // 기업 검색 별칭 (GET 공개) → { 기업명: [별칭...] }. 관리자가 /admin 에서 편집한 값.
  companyAliases() {
    return getJSON('/api/company-aliases');
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

  // ===== 위클리 픽 =====
  // 발행본 조회 (공개). w 없으면 최신 회차. { available, week, issueNo, label, stats, payload, prev[] }
  // n = 회차 번호로 조회. w·n 모두 없으면 최신 회차.
  weekly(w, n) {
    const q = w ? '?w=' + encodeURIComponent(w) : (n ? '?n=' + encodeURIComponent(n) : '');
    return getJSON('/api/weekly' + q);
  },
  // 발행 회차 목록 (공개). `/weekly` 썸네일 목록용 — 커버가 쓰는 값만 담긴 가벼운 응답.
  // { editions: [{week, issueNo, label, overview, total, picks, companies, topTags[]}],
  //   upcoming: {week, label, start, end} | null }  ← 「발행 예정」 자리. 오늘 주가 이미 발행됐으면 null
  weeklyList() {
    return getJSON('/api/weekly?list=1');
  },
  // 초안 + 그 주 후보 목록 (관리자, PIN). 주차('2026-W34') 또는 그 주의 아무 날짜('2026-08-19') 모두 받는다
  // — 주차 계산은 서버에 두고 화면은 서버가 준 week 값을 그대로 쓴다.
  async weeklyDraft(weekOrDate, pin) {
    const key = /^\d{4}-\d{2}-\d{2}$/.test(weekOrDate) ? 'date' : 'w';
    const res = await fetch('/api/weekly?draft=1&' + key + '=' + encodeURIComponent(weekOrDate), { headers: { Accept: 'application/json', 'x-admin-pin': pin || '' } });
    if (!res.ok) { const err = new Error('REQUEST_FAILED'); err.status = res.status; throw err; }
    return res.json();
  },
  // 발행 전 미리보기 (저장된 devPin 사용 — /preview 와 같은 방식)
  weeklyPreview(week) {
    return getJSONPin('/api/weekly?draft=1&w=' + encodeURIComponent(week));
  },
  // 초안 저장 / LLM 초안 / 발행 / 회수 (관리자, PIN)
  weeklyAction(payload, pin) {
    return postPin('/api/weekly', payload, pin);
  },
  // 픽 이미지 업로드 (관리자, PIN). JSON 이 아니라 파일 바이트를 그대로 보낸다 —
  // multipart 를 쓰면 Function 쪽에 파싱이 붙는데 파일이 하나라 그럴 이유가 없다.
  // 응답의 key 를 픽에 저장하고, 화면에서는 /api/pick-image?k=<key> 로 불러온다.
  async uploadPickImage(file, pin) {
    const res = await fetch('/api/pick-image', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-admin-pin': pin || '' },
      body: file,
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const err = new Error(data.error || 'UPLOAD_FAILED');
      err.status = res.status; err.data = data;
      throw err;
    }
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
    const body = { action: 'create', date, items };
    const res = await fetch('/api/dev/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify(body) });
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
  // ===== 라이브 항목 삭제 (배포는 병합이라 draft 에서 빼는 것으로는 지워지지 않는다) =====
  async devLive(date) {
    const res = await fetch('/api/dev/live?date=' + encodeURIComponent(date), { headers: { Accept: 'application/json', 'x-admin-pin': devPin() } });
    let data = {}; try { data = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
  async devDeleteLive(date, idx, name, key) {
    const res = await fetch('/api/dev/live', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': devPin() }, body: JSON.stringify({ action: 'delete', date, idx, name, key }) });
    let data = {}; try { data = await res.json(); } catch { /* */ }
    if (!res.ok) { const err = new Error(data.error || 'REQUEST_FAILED'); err.status = res.status; err.data = data; throw err; }
    return data;
  },
};
