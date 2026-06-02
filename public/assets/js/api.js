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
};
