/* dev 프리뷰 배너 — ?preview=1 일 때만 활성(아니면 no-op).
   실사이트를 draft 합본으로 보는 중임을 표시 + 검수 콘솔/배포 진입. 의존: API (api.js).
   index/company/explore/(radar) 에 <script> 로 포함. 검수·편집은 /admin 검수·배포 탭에서. */
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get('preview') !== '1') return;            // 프리뷰 모드에서만
  if (typeof API === 'undefined') return;
  function getPin() { try { return localStorage.getItem('devPin') || sessionStorage.getItem('devPin') || ''; } catch (e) { return ''; } }

  var BAR_H = 44;
  document.body.style.paddingTop = BAR_H + 'px';
  var bar = document.createElement('div');
  bar.id = 'devBar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:' + BAR_H + 'px;z-index:60;background:#111;color:#fff;display:flex;align-items:center;gap:12px;padding:0 16px;font-family:Inter,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,.25)';
  document.body.appendChild(bar);

  var toastEl = document.createElement('div');
  toastEl.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:13px;border-radius:999px;padding:10px 20px;opacity:0;transition:opacity .2s;z-index:70';
  document.body.appendChild(toastEl);
  function toast(m) { toastEl.textContent = m; toastEl.style.opacity = '1'; setTimeout(function () { toastEl.style.opacity = '0'; }, 2400); }

  function btn(label, primary) {
    return 'border:none;cursor:pointer;border-radius:999px;font-weight:600;font-size:12px;padding:6px 12px;' + (primary ? 'background:#c8f200;color:#111' : 'background:rgba(255,255,255,.12);color:#fff');
  }

  if (!getPin()) {
    // 미인증 ?preview=1 직접 진입 → /preview 게이트로 (PIN 입력 화면)
    location.replace('/preview');
    return;
  }

  bar.innerHTML = '<span style="font-weight:700;letter-spacing:.08em;font-size:10px;text-transform:uppercase;background:#c8f200;color:#111;border-radius:999px;padding:2px 8px">DEV 프리뷰</span>' +
    '<span id="devCount" style="opacity:.85">미배포 …</span>' +
    '<span style="opacity:.55;font-size:12px">실사이트를 draft 합본으로 보는 중</span>' +
    '<span style="flex:1"></span>' +
    '<a href="/admin/" style="' + btn('') + ';text-decoration:none">검수 콘솔</a>' +
    '<button id="devPub" style="' + btn('p') + '">전체 배포 ▶</button>' +
    '<a href="' + location.pathname + '" style="color:#fff;opacity:.7;font-size:12px;text-decoration:none;margin-left:4px">실서비스 보기</a>';

  function refreshCount() {
    API.devDrafts().then(function (r) {
      var el = document.getElementById('devCount'); if (el) el.textContent = '미배포 ' + ((r && r.count) || 0) + '건';
    }).catch(function (e) { if (e && e.status === 403) { try { localStorage.removeItem('devPin'); sessionStorage.removeItem('devPin'); } catch (x) {} location.href = '/preview'; } });
  }
  document.getElementById('devPub').onclick = function () {
    if (!window.confirm('미배포 draft 전체를 라이브에 배포할까요?\n본 사이트에 즉시 반영되고 같은 (날짜·기업) 항목은 교체됩니다.')) return;
    API.devPublish({ all: true }).then(function (r) {
      toast((r.publishedIds ? r.publishedIds.length : 0) + '건 배포됨 → 라이브 반영');
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) { toast('배포 실패: ' + (e.status || e.message)); });
  };
  refreshCount();
})();
