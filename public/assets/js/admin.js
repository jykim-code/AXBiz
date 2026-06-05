/* 관리자 입력 — PIN 게이트, 동적 폼, 기존일 로드, upsert 저장 */

const CATEGORIES = ['대기업', '중견기업', '스타트업·중소'];
const BULLET_FIELDS = [
  { key: 'keyPoints', label: '주요 내용' },
  { key: 'implications', label: '시사점' },
  { key: 'hancomInsight', label: '한컴 인사이트' },
];

let adminPin = '';

/* ===== DOM 헬퍼 ===== */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function')
        node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
  }
  (children || []).forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function toast(msg, ok) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok === false ? '#dc2626' : '#111';
  t.style.opacity = '1';
  setTimeout(() => (t.style.opacity = '0'), 2600);
}

/* ===== 불릿 그룹 ===== */
function bulletRow(value) {
  const input = el('input', { class: 'field bullet-input', type: 'text', value: value || '' });
  const remove = el('button', {
    type: 'button',
    class: 'btn flex-none w-9 h-9 border border-ink/15 hover:bg-red-500 hover:text-white hover:border-red-500',
    text: '×',
    onclick: () => row.remove(),
  });
  const row = el('div', { class: 'flex gap-2 items-center' }, [input, remove]);
  return row;
}

function bulletGroup(field, label, items) {
  const list = el('div', { class: 'space-y-2', 'data-field': field.key });
  (items && items.length ? items : ['']).forEach((v) => list.appendChild(bulletRow(v)));
  const add = el('button', {
    type: 'button',
    class: 'text-xs font-semibold text-lime-600 hover:text-ink mt-1',
    text: '+ ' + label + ' 추가',
    onclick: () => list.appendChild(bulletRow('')),
  });
  return el('div', { class: 'space-y-1.5' }, [
    el('div', { class: 'label', text: label }),
    list,
    add,
  ]);
}

/* ===== 기업 블록 ===== */
function companyBlock(data) {
  data = data || {};
  const name = el('input', { class: 'field c-name', type: 'text', placeholder: '기업명', value: data.name || '' });

  const category = el('select', { class: 'field c-category' });
  CATEGORIES.forEach((c) => {
    const opt = el('option', { value: c, text: c });
    if (data.category === c) opt.selected = true;
    category.appendChild(opt);
  });

  const source = el('input', { class: 'field c-source', type: 'url', placeholder: '출처 기사 URL (https://...)', value: data.sourceUrl || '' });
  const confluence = el('input', { class: 'field c-confluence', type: 'url', placeholder: 'Confluence URL (https://...)', value: data.confluenceUrl || '' });
  const tags = el('input', { class: 'field c-tags', type: 'text', placeholder: '태그 (쉼표로 구분)', value: (data.tags || []).join(', ') });

  const removeBtn = el('button', {
    type: 'button',
    class: 'btn text-xs border border-ink/15 px-3 py-1.5 hover:bg-red-500 hover:text-white hover:border-red-500',
    text: '기업 삭제',
    onclick: () => block.remove(),
  });

  const head = el('div', { class: 'flex items-center justify-between mb-4' }, [
    el('div', { class: 'label', text: '기업' }),
    removeBtn,
  ]);

  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4' }, [
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: '기업명' }), name]),
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: '분류' }), category]),
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: '출처 링크' }), source]),
    el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: 'Confluence 링크' }), confluence]),
  ]);

  const bulletWrap = el('div', { class: 'space-y-4 mb-4' });
  BULLET_FIELDS.forEach((f) => bulletWrap.appendChild(bulletGroup(f, f.label, data[f.key])));

  const tagsWrap = el('div', { class: 'space-y-1.5' }, [el('div', { class: 'label', text: '태그' }), tags]);

  const block = el('div', { class: 'company-block bg-white rounded-[20px] border border-ink/5 shadow-xl shadow-ink/5 p-6' }, [
    head,
    grid,
    bulletWrap,
    tagsWrap,
  ]);
  return block;
}

/* ===== 수집 / 검증 ===== */
function collectBullets(block, field) {
  const list = block.querySelector('[data-field="' + field + '"]');
  return Array.from(list.querySelectorAll('.bullet-input'))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

function collect() {
  const blocks = Array.from(document.querySelectorAll('.company-block'));
  const companies = [];
  for (const b of blocks) {
    const name = b.querySelector('.c-name').value.trim();
    if (!name) continue; // 기업명 없으면 스킵
    companies.push({
      name,
      category: b.querySelector('.c-category').value,
      sourceUrl: b.querySelector('.c-source').value.trim(),
      confluenceUrl: b.querySelector('.c-confluence').value.trim(),
      keyPoints: collectBullets(b, 'keyPoints'),
      implications: collectBullets(b, 'implications'),
      hancomInsight: collectBullets(b, 'hancomInsight'),
      tags: b.querySelector('.c-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    });
  }
  return companies;
}

/* ===== 기존 데이터 로드 ===== */
async function loadExisting() {
  const date = document.getElementById('reportDate').value;
  const status = document.getElementById('loadStatus');
  const btn = document.getElementById('loadBtn');
  if (!date) {
    status.textContent = '날짜를 먼저 선택하세요.';
    return;
  }
  btn.disabled = true;
  status.textContent = '불러오는 중…';
  try {
    const companies = await API.report(date);
    const wrap = document.getElementById('companies');
    wrap.innerHTML = '';
    if (companies.length) {
      companies.forEach((c) => wrap.appendChild(companyBlock(c)));
      status.textContent = companies.length + '개 기업 불러옴 (수정 후 저장 시 덮어쓰기)';
    } else {
      wrap.appendChild(companyBlock());
      status.textContent = '해당 날짜 데이터 없음 (새로 입력)';
    }
  } catch (e) {
    status.textContent = '불러오기 실패: ' + (e.status || e.message);
  } finally {
    btn.disabled = false;
  }
}

/* ===== 저장 ===== */
async function save() {
  const date = document.getElementById('reportDate').value;
  const status = document.getElementById('saveStatus');
  const btn = document.getElementById('saveBtn');
  if (!date) {
    status.textContent = '날짜를 선택하세요.';
    status.style.color = '#dc2626';
    return;
  }
  const companies = collect();
  btn.disabled = true;
  status.style.color = '#111';
  status.textContent = '저장 중…';
  try {
    const res = await API.save(date, companies, adminPin);
    status.style.color = '#7ba500';
    status.textContent = '저장 완료 (' + res.count + '개 기업)';
    toast('저장 완료 — 대시보드에 즉시 반영됩니다', true);
  } catch (e) {
    if (e.status === 403) {
      // PIN 무효화 → 게이트 재노출
      adminPin = '';
      sessionStorage.removeItem('adminPin');
      showGate(true);
      return;
    }
    status.style.color = '#dc2626';
    status.textContent = '저장 실패: ' + (e.data && e.data.error ? e.data.error : e.status || e.message);
    toast('저장 실패', false);
  } finally {
    btn.disabled = false;
  }
}

/* ===== 게이트 / 초기화 ===== */
function showGate(err) {
  document.getElementById('editor').classList.add('hidden');
  document.getElementById('gate').classList.remove('hidden');
  document.getElementById('gateErr').classList.toggle('hidden', !err);
  document.getElementById('pinInput').value = '';
  document.getElementById('pinInput').focus();
}

function showEditor() {
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('editor').classList.remove('hidden');
  const dateInput = document.getElementById('reportDate');
  if (!dateInput.value) dateInput.value = todayYmd();
  const wrap = document.getElementById('companies');
  if (!wrap.children.length) wrap.appendChild(companyBlock());
}

function init() {
  // 게이트: 입력 → 메모리/세션 보관 후 에디터 노출 (검증은 저장 시 서버에서)
  document.getElementById('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('pinInput').value.trim();
    if (!pin) return;
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    // PIN 즉시 검증(PIN 보호 엔드포인트 호출) — 403이면 게이트 유지
    try {
      await API.companyMetaList(pin);
    } catch (err) {
      if (btn) btn.disabled = false;
      if (err.status === 403) { showGate(true); return; }
      // 기타(일시 오류 등)는 막지 않고 통과
    }
    if (btn) btn.disabled = false;
    adminPin = pin;
    sessionStorage.setItem('adminPin', pin);
    showEditor();
  });

  document.getElementById('addCompany').addEventListener('click', () =>
    document.getElementById('companies').appendChild(companyBlock())
  );
  document.getElementById('loadBtn').addEventListener('click', loadExisting);
  document.getElementById('saveBtn').addEventListener('click', save);

  // 탭: 보고서 입력 / 의견함
  document.getElementById('tabReportBtn').addEventListener('click', () => showTab('report'));
  document.getElementById('tabSuggBtn').addEventListener('click', () => showTab('sugg'));
  document.getElementById('tabDartBtn').addEventListener('click', () => showTab('dart'));
  document.getElementById('tabSetBtn').addEventListener('click', () => showTab('set'));
  document.getElementById('suggRefresh').addEventListener('click', loadSuggestions);
  document.getElementById('dartRefresh').addEventListener('click', loadDartMappings);
  document.getElementById('pinSave').addEventListener('click', savePinned);
  document.getElementById('tagCo').addEventListener('change', renderTagChips);
  document.getElementById('tagSave').addEventListener('click', saveCompanyTags);
  document.getElementById('tagGlobalBtn').addEventListener('click', deleteTagsGlobal);

  // 세션에 PIN이 있으면 바로 에디터로 (편의용; 서버 검증은 저장 시)
  const saved = sessionStorage.getItem('adminPin');
  if (saved) {
    adminPin = saved;
    showEditor();
  } else {
    showGate(false);
  }
}

/* ===== 탭 전환 (보고서 / 의견함 / DART 연결) ===== */
function showTab(which) {
  const tabs = { report: 'tab-report', sugg: 'tab-suggestions', dart: 'tab-dart', set: 'tab-settings' };
  const btns = { report: 'tabReportBtn', sugg: 'tabSuggBtn', dart: 'tabDartBtn', set: 'tabSetBtn' };
  for (const k in tabs) {
    document.getElementById(tabs[k]).classList.toggle('hidden', k !== which);
    document.getElementById(btns[k]).className = 'btn px-4 py-2 ' + (k === which ? 'bg-ink text-white' : 'border border-ink/15 hover:bg-ink hover:text-white');
  }
  if (which === 'sugg') loadSuggestions();
  if (which === 'dart') loadDartMappings();
  if (which === 'set') { loadPinned(); loadTagManager(); }
}

async function loadSuggestions() {
  const list = document.getElementById('suggList');
  list.innerHTML = '<div class="text-sm opacity-50">불러오는 중…</div>';
  try {
    const rows = await API.suggestions(adminPin);
    if (!rows.length) { list.innerHTML = '<div class="text-sm opacity-50">접수된 의견이 없습니다.</div>'; return; }
    list.innerHTML = rows.map((s) =>
      '<div class="bg-white rounded-2xl border border-ink/5 shadow p-4">' +
      '<div class="flex items-center gap-2 mb-1.5"><span class="text-[11px] bg-beige border border-ink/5 rounded-full px-2 py-0.5">' + escapeHtml(s.type) + '</span>' +
      (s.company ? '<span class="text-[11px] opacity-60">' + escapeHtml(s.company) + '</span>' : '') +
      '<span class="text-[11px] opacity-40 ml-auto">' + escapeHtml(s.created_at) + '</span></div>' +
      '<div class="text-sm whitespace-pre-wrap">' + escapeHtml(s.content) + '</div>' +
      '<div class="text-xs opacity-50 mt-1.5">' + escapeHtml([s.team, s.name].filter(Boolean).join(' · ')) + '</div></div>'
    ).join('');
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    list.innerHTML = '<div class="text-sm text-red-500">불러오기 실패: ' + (e.status || e.message) + '</div>';
  }
}

/* ===== DART 연결 탭 ===== */
let DART_CORPS = null; // [{code,name,stock}]
async function loadCorps() {
  if (DART_CORPS) return DART_CORPS;
  const txt = await (await fetch('/assets/dart-corps.txt')).text();
  DART_CORPS = txt.split('\n').filter(Boolean).map((l) => {
    const i = l.indexOf('\t'), j = l.indexOf('\t', i + 1);
    return { code: l.slice(0, i), name: l.slice(i + 1, j), stock: l.slice(j + 1) };
  });
  return DART_CORPS;
}
function searchCorps(q) {
  q = (q || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const exact = [], starts = [], contains = [];
  for (const c of DART_CORPS) {
    const n = c.name.toLowerCase();
    if (n === q) exact.push(c);
    else if (n.startsWith(q)) starts.push(c);
    else if (n.includes(q) || (c.stock && c.stock === q)) contains.push(c);
  }
  // 상장(stock 보유) 우선 정렬 보정
  const rank = (arr) => arr.sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0));
  return exact.concat(rank(starts), rank(contains)).slice(0, 12);
}

async function loadDartMappings() {
  const list = document.getElementById('dartList');
  list.innerHTML = '<div class="text-sm opacity-50">불러오는 중…</div>';
  try {
    await loadCorps();
    const [reports, metaRows] = await Promise.all([API.all().catch(() => []), API.companyMetaList(adminPin)]);
    const names = [...new Set(reports.flatMap((r) => (r.companies || []).map((c) => c.name)))].sort((a, b) => a.localeCompare(b));
    const metaMap = {};
    (metaRows || []).forEach((m) => (metaMap[m.name] = m));
    if (!names.length) { list.innerHTML = '<div class="text-sm opacity-50">등록된 기업이 없습니다.</div>'; return; }
    list.innerHTML = '';
    names.forEach((n) => list.appendChild(dartRow(n, metaMap[n])));
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    list.innerHTML = '<div class="text-sm text-red-500">불러오기 실패: ' + (e.status || e.message) + '</div>';
  }
}

function dartRow(name, meta) {
  let ovCeo = '';
  if (meta && meta.overrides) { try { ovCeo = JSON.parse(meta.overrides).ceo || ''; } catch { /* skip */ } }
  const search = el('input', { class: 'field dart-search', type: 'text', placeholder: 'DART 기업 검색 (이름/종목코드)…', autocomplete: 'off' });
  const dropdown = el('div', { class: 'dart-dd hidden absolute z-10 left-0 right-0 mt-1 bg-white border border-ink/10 rounded-xl shadow-xl max-h-56 overflow-auto' });
  const current = el('div', { class: 'text-xs mt-1' });
  const ceo = el('input', { class: 'field dart-ceo', type: 'text', placeholder: '대표자 보정(선택)', value: ovCeo });
  const status = el('span', { class: 'text-xs ml-1' });
  const saveBtn = el('button', { type: 'button', class: 'btn flex-none bg-ink text-white px-4 py-2 hover:bg-lime hover:text-ink', text: '저장' });

  const row = el('div', { class: 'bg-white rounded-2xl border border-ink/5 shadow p-4' }, [
    el('div', { class: 'font-display font-semibold mb-1', text: name }),
    current,
    el('div', { class: 'relative mt-2' }, [search, dropdown]),
    el('div', { class: 'flex items-center gap-2 mt-2' }, [ceo, saveBtn, status]),
  ]);
  row.dataset.corp = meta && meta.corp_code ? meta.corp_code : '';

  function renderCurrent() {
    const c = row.dataset.corp;
    if (c) {
      const hit = DART_CORPS.find((x) => x.code === c);
      current.innerHTML = '연결됨: <b>' + escapeHtml(hit ? hit.name : '') + '</b> <span class="opacity-50">' + escapeHtml(c) + (hit && hit.stock ? ' · ' + escapeHtml(hit.stock) : '') + '</span> <button type="button" class="dart-clear text-red-500 ml-1">해제</button>';
      const clr = current.querySelector('.dart-clear');
      if (clr) clr.onclick = () => { row.dataset.corp = ''; renderCurrent(); };
    } else {
      current.innerHTML = '<span class="opacity-50">미연결 — DART 정보 미표시</span>';
    }
  }
  renderCurrent();

  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const res = searchCorps(search.value);
      if (!res.length) { dropdown.classList.add('hidden'); dropdown.innerHTML = ''; return; }
      dropdown.innerHTML = '';
      res.forEach((c) => {
        const item = el('button', { type: 'button', class: 'block w-full text-left px-3 py-2 text-sm hover:bg-beige' });
        item.innerHTML = escapeHtml(c.name) + ' <span class="opacity-50 text-xs">' + escapeHtml(c.code) + (c.stock ? ' · ' + escapeHtml(c.stock) : '') + '</span>';
        item.onclick = () => { row.dataset.corp = c.code; search.value = ''; dropdown.classList.add('hidden'); renderCurrent(); };
        dropdown.appendChild(item);
      });
      dropdown.classList.remove('hidden');
    }, 180);
  });
  search.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 200));

  saveBtn.onclick = async () => {
    status.style.color = '#111';
    status.textContent = '저장 중…';
    try {
      await API.saveCompanyMeta({ name, corpCode: row.dataset.corp || '', overrides: { ceo: ceo.value.trim() } }, adminPin);
      status.style.color = '#7ba500';
      status.textContent = '저장됨';
      toast(name + ' 연결 저장', true);
    } catch (e) {
      if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
      status.style.color = '#dc2626';
      status.textContent = '실패: ' + ((e.data && e.data.error) || e.status || e.message);
    }
  };
  return row;
}

/* ===== 설정 탭 (그래프 핀 태그) ===== */
async function loadPinned() {
  const input = document.getElementById('pinTags');
  const status = document.getElementById('pinStatus');
  status.textContent = '';
  try {
    const tags = await API.pinnedTags();
    input.value = (Array.isArray(tags) ? tags : []).join(', ');
  } catch {
    status.textContent = '핀 목록을 불러오지 못했습니다.';
    status.style.color = '#dc2626';
  }
}

async function savePinned() {
  const input = document.getElementById('pinTags');
  const status = document.getElementById('pinStatus');
  const tags = input.value.split(',').map((t) => t.trim()).filter(Boolean);
  status.style.color = '#111';
  status.textContent = '저장 중…';
  try {
    const res = await API.savePinnedTags(tags, adminPin);
    input.value = (res.tags || []).join(', ');
    status.style.color = '#7ba500';
    status.textContent = '저장됨 (' + (res.tags || []).length + '개)';
    toast('핀 태그 저장 — 홈 그래프에 즉시 반영', true);
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    status.style.color = '#dc2626';
    status.textContent = '저장 실패: ' + ((e.data && e.data.error) || e.status || e.message);
  }
}

/* ===== 설정 탭 (기업별/전역 태그 관리) ===== */
let TAG_UNION = {}; // 기업명 -> 태그 배열(전체 항목 합집합)
let tagRemoved = new Set(); // 현재 선택 기업에서 삭제 표시된 태그

async function loadTagManager() {
  const sel = document.getElementById('tagCo');
  try {
    const reports = await API.all();
    TAG_UNION = {};
    reports.forEach((r) => (r.companies || []).forEach((c) => {
      if (!c || !c.name) return;
      const s = (TAG_UNION[c.name] = TAG_UNION[c.name] || new Set());
      (c.tags || []).forEach((t) => s.add(t));
    }));
    const names = Object.keys(TAG_UNION).sort((a, b) => a.localeCompare(b));
    const cur = sel.value;
    sel.innerHTML = names.map((n) => '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>').join('');
    if (cur && names.includes(cur)) sel.value = cur;
    renderTagChips();
  } catch {
    sel.innerHTML = '<option>불러오기 실패</option>';
  }
}

function renderTagChips() {
  tagRemoved = new Set();
  document.getElementById('tagAdd').value = '';
  document.getElementById('tagStatus').textContent = '';
  drawTagChips();
}

function drawTagChips() {
  const name = document.getElementById('tagCo').value;
  const box = document.getElementById('tagChips');
  const tags = TAG_UNION[name] ? [...TAG_UNION[name]].sort((a, b) => a.localeCompare(b)) : [];
  if (!tags.length) { box.innerHTML = '<span class="text-xs opacity-50">태그 없음</span>'; return; }
  box.innerHTML = tags.map((t) => {
    const off = tagRemoved.has(t);
    return '<button type="button" data-t="' + escapeHtml(t) + '" class="tagm text-xs rounded-full px-2.5 py-1 border ' +
      (off ? 'line-through bg-red-50 border-red-300 text-red-500' : 'bg-beige border-ink/5 hover:border-red-300') + '">#' + escapeHtml(t) + (off ? ' ✕' : '') + '</button>';
  }).join('');
  box.querySelectorAll('.tagm').forEach((b) => b.onclick = () => {
    const t = b.dataset.t;
    if (tagRemoved.has(t)) tagRemoved.delete(t); else tagRemoved.add(t);
    drawTagChips();
  });
}

// 변경된 날짜들을 순차 재색인(기존 저장 API 재사용: GET→그대로 POST)
async function reindexDates(dates, statusEl) {
  for (let i = 0; i < dates.length; i++) {
    statusEl.textContent = '재색인 중 ' + (i + 1) + '/' + dates.length + '…';
    try {
      const companies = await API.report(dates[i]);
      await API.save(dates[i], companies, adminPin);
    } catch { /* 한 날짜 실패해도 계속 */ }
  }
}

async function saveCompanyTags() {
  const name = document.getElementById('tagCo').value;
  const status = document.getElementById('tagStatus');
  const add = document.getElementById('tagAdd').value.split(',').map((t) => t.trim()).filter(Boolean);
  const remove = [...tagRemoved];
  if (!name || (!add.length && !remove.length)) { status.textContent = '변경 없음'; return; }
  status.style.color = '#111';
  status.textContent = '저장 중…';
  try {
    const res = await API.manageTags({ name, remove, add }, adminPin);
    await reindexDates(res.affectedDates || [], status);
    status.style.color = '#7ba500';
    status.textContent = '완료 (' + (res.affectedDates || []).length + '개 날짜 반영)';
    toast(name + ' 태그 변경 완료', true);
    await loadTagManager();
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    status.style.color = '#dc2626';
    status.textContent = '실패: ' + ((e.data && e.data.error) || e.status || e.message);
  }
}

async function deleteTagsGlobal() {
  const input = document.getElementById('tagGlobalDel');
  const status = document.getElementById('tagGlobalStatus');
  const remove = input.value.split(',').map((t) => t.trim()).filter(Boolean);
  if (!remove.length) { status.textContent = '태그를 입력하세요'; return; }
  if (!confirm('태그 [' + remove.join(', ') + '] 를 모든 기업·날짜 데이터에서 삭제합니다. 계속할까요?')) return;
  status.style.color = '#111';
  status.textContent = '삭제 중…';
  try {
    const res = await API.manageTags({ remove }, adminPin);
    await reindexDates(res.affectedDates || [], status);
    status.style.color = '#7ba500';
    status.textContent = '완료 (' + (res.affectedDates || []).length + '개 날짜 반영)';
    input.value = '';
    toast('태그 전역 삭제 완료', true);
    await loadTagManager();
  } catch (e) {
    if (e.status === 403) { adminPin = ''; sessionStorage.removeItem('adminPin'); showGate(true); return; }
    status.style.color = '#dc2626';
    status.textContent = '실패: ' + ((e.data && e.data.error) || e.status || e.message);
  }
}

document.addEventListener('DOMContentLoaded', init);
