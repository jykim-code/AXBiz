/* dev 프리뷰 툴바 — ?preview=1 일 때만 활성(아니면 no-op).
   실사이트 위에 상단 배너 + 검수 드로어 + 배포. 의존: API (api.js).
   index/company/explore/(radar) 에 <script> 로 포함. */
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get('preview') !== '1') return;          // 프리뷰 모드에서만
  if (typeof API === 'undefined') return;

  function getPin() { try { return sessionStorage.getItem('devPin') || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m) { var t = document.getElementById('devToast'); if (!t) return; t.textContent = m; t.style.opacity = '1'; setTimeout(function () { t.style.opacity = '0'; }, 2400); }

  // 공통 요소(배너 + 드로어 + 토스트) 마운트
  var BAR_H = 44;
  function mountShell(innerRight) {
    document.body.style.paddingTop = BAR_H + 'px';
    var bar = document.createElement('div');
    bar.id = 'devBar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:' + BAR_H + 'px;z-index:60;background:#111;color:#fff;display:flex;align-items:center;gap:12px;padding:0 16px;font-family:Inter,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,.25)';
    bar.innerHTML =
      '<span style="font-weight:700;letter-spacing:.08em;font-size:10px;text-transform:uppercase;background:#c8f200;color:#111;border-radius:999px;padding:2px 8px">DEV 프리뷰</span>' +
      '<span id="devCount" style="opacity:.85"></span>' +
      '<span style="flex:1"></span>' + innerRight;
    document.body.appendChild(bar);

    var toastEl = document.createElement('div');
    toastEl.id = 'devToast';
    toastEl.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:13px;border-radius:999px;padding:10px 20px;opacity:0;transition:opacity .2s;z-index:70';
    document.body.appendChild(toastEl);
  }
  function btn(id, label, primary) {
    return '<button id="' + id + '" style="border:none;cursor:pointer;border-radius:999px;font-weight:600;font-size:12px;padding:6px 12px;' +
      (primary ? 'background:#c8f200;color:#111' : 'background:rgba(255,255,255,.12);color:#fff') + '">' + label + '</button>';
  }

  // PIN 없음 → 인증 안내만
  if (!getPin()) {
    mountShell('<a href="/dev" style="color:#c8f200;font-weight:600;text-decoration:none">PIN 입력 →</a>');
    document.getElementById('devCount').textContent = '인증이 필요합니다';
    return;
  }

  // 전체 툴바
  mountShell(
    btn('devImportBtn', '컨플 가져오기') +
    btn('devListBtn', '검수 목록') +
    btn('devPublishBtn', '배포 ▶', true) +
    '<a href="' + location.pathname + '" style="color:#fff;opacity:.7;font-size:12px;text-decoration:none;margin-left:4px">실서비스 보기</a>'
  );

  // 드로어
  var drawer = document.createElement('div');
  drawer.id = 'devDrawer';
  drawer.style.cssText = 'position:fixed;top:' + BAR_H + 'px;right:0;bottom:0;width:min(92vw,420px);z-index:65;background:#fff;border-left:1px solid rgba(17,17,17,.1);box-shadow:-8px 0 28px rgba(17,17,17,.12);transform:translateX(100%);transition:transform .25s;display:flex;flex-direction:column';
  drawer.innerHTML =
    '<div style="padding:14px 16px;border-bottom:1px solid rgba(17,17,17,.06);display:flex;align-items:center;gap:8px">' +
      '<b style="font-family:\'Space Grotesk\',sans-serif">검수 목록</b>' +
      '<span style="flex:1"></span>' +
      '<button id="devLogout" style="border:none;background:none;color:#7ba500;font-size:12px;font-weight:600;cursor:pointer">프리뷰 종료</button>' +
      '<button id="devDrawerClose" style="border:none;background:none;font-size:18px;cursor:pointer;opacity:.5">×</button>' +
    '</div>' +
    '<div id="devDrawerBody" style="flex:1;overflow-y:auto;padding:14px 16px"></div>';
  document.body.appendChild(drawer);
  function openDrawer(v) { drawer.style.transform = v ? 'translateX(0)' : 'translateX(100%)'; }

  var DIFF = { 'new': ['🆕 신규', '#c8f200', '#111'], 'replace': ['✏️ 교체', '#fde68a', '#92400e'] };

  async function refresh() {
    try {
      var res = await API.devDrafts();
      var n = (res && res.count) || 0;
      var cEl = document.getElementById('devCount');
      if (cEl) cEl.textContent = '미배포 ' + n + '건';
      return res;
    } catch (e) {
      if (e && e.status === 403) { try { sessionStorage.removeItem('devPin'); } catch (x) {} location.href = '/dev'; }
      return { drafts: [], count: 0 };
    }
  }

  function renderDrawer(res) {
    var body = document.getElementById('devDrawerBody');
    var drafts = (res && res.drafts) || [];
    if (!drafts.length) { body.innerHTML = '<div style="opacity:.5;font-size:13px;padding:24px 0;text-align:center">검수할 draft가 없습니다.<br>상단 "컨플 가져오기"로 불러오세요.</div>'; return; }
    body.innerHTML = drafts.map(function (d) {
      var dd = DIFF[d.diff] || DIFF['new'];
      var data = d.data || {};
      var kp = (data.keyPoints || [])[0] || data.summary || '';
      return '<div style="border:1px solid rgba(17,17,17,.08);border-radius:14px;padding:12px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">' +
          '<span style="font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;background:' + dd[1] + ';color:' + dd[2] + '">' + dd[0] + '</span>' +
          '<b style="font-family:\'Space Grotesk\',sans-serif;font-size:14px">' + esc(d.company) + '</b>' +
          '<span style="font-size:11px;opacity:.5;margin-left:auto">' + esc(d.date) + '</span>' +
        '</div>' +
        '<div style="font-size:13px;opacity:.85;line-height:1.5">' + esc(kp) + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px">' +
          '<button data-del="' + d.id + '" style="border:1px solid rgba(17,17,17,.15);background:none;border-radius:999px;font-size:11px;padding:4px 10px;cursor:pointer">삭제</button>' +
          '<button data-pub="' + d.id + '" style="border:none;background:#111;color:#c8f200;border-radius:999px;font-size:11px;font-weight:600;padding:4px 12px;cursor:pointer;margin-left:auto">이 건 배포</button>' +
        '</div></div>';
    }).join('') +
      '<div style="font-size:11px;opacity:.5;margin-top:8px;line-height:1.5">수정이 필요하면 컨플루언스에서 고친 뒤 다시 "컨플 가져오기" 하세요(컨플=진실원).</div>';

    body.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () { try { await API.devDeleteDraft(+b.getAttribute('data-del')); toast('draft 삭제'); renderDrawer(await refresh()); } catch (e) { toast('삭제 실패'); } };
    });
    body.querySelectorAll('[data-pub]').forEach(function (b) {
      b.onclick = function () { confirmPublish({ ids: [+b.getAttribute('data-pub')] }, '이 1건을'); };
    });
  }

  function confirmPublish(payload, label) {
    if (!window.confirm(label + ' 라이브에 배포할까요?\n배포하면 본 사이트에 즉시 반영되고 같은 (날짜·기업) 항목은 교체됩니다.')) return;
    API.devPublish(payload).then(function (r) {
      toast((r.publishedIds ? r.publishedIds.length : 0) + '건 배포됨 → 라이브 반영');
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) { toast('배포 실패: ' + (e.status || e.message)); });
  }

  // 버튼 배선
  document.getElementById('devImportBtn').onclick = async function () {
    var url = window.prompt('컨플 페이지 URL (/pages/<id> 또는 /wiki/x/ 단축링크)');
    if (!url) return;
    toast('가져오는 중…');
    try { var r = await API.devImport(url.trim()); toast(r.name + ' · draft ' + r.count + '건 가져옴'); setTimeout(function(){ location.reload(); }, 900); }
    catch (e) { toast('가져오기 실패: ' + ((e.data && e.data.error) || e.status || e.message)); }
  };
  document.getElementById('devListBtn').onclick = async function () { renderDrawer(await refresh()); openDrawer(true); };
  document.getElementById('devPublishBtn').onclick = function () { confirmPublish({ all: true }, '검수 목록 전체를'); };
  document.getElementById('devDrawerClose').onclick = function () { openDrawer(false); };
  document.getElementById('devLogout').onclick = function () { try { sessionStorage.removeItem('devPin'); } catch (e) {} location.href = location.pathname; };

  refresh();
})();
