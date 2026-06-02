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
  document.getElementById('gateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('pinInput').value.trim();
    if (!pin) return;
    adminPin = pin;
    sessionStorage.setItem('adminPin', pin);
    showEditor();
  });

  document.getElementById('addCompany').addEventListener('click', () =>
    document.getElementById('companies').appendChild(companyBlock())
  );
  document.getElementById('loadBtn').addEventListener('click', loadExisting);
  document.getElementById('saveBtn').addEventListener('click', save);

  // 세션에 PIN이 있으면 바로 에디터로 (편의용; 서버 검증은 저장 시)
  const saved = sessionStorage.getItem('adminPin');
  if (saved) {
    adminPin = saved;
    showEditor();
  } else {
    showGate(false);
  }
}

document.addEventListener('DOMContentLoaded', init);
