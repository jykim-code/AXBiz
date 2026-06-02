# AX Biz Radar — 고도화 로드맵

> 고도화 항목을 여기서 추적한다. 새 아이디어가 나오면 **예정**에 추가하고,
> 작업을 시작하면 **진행 중**, 끝나면 **완료**로 옮기고 완료일을 적는다.
>
> 상태 표기: `⬜ 예정` · `🟡 진행 중` · `✅ 완료`
> 체크박스: `- [ ]` 미완료 / `- [x]` 완료. 세부 작업은 항목 아래 하위 체크리스트로.

---

## 🟡 진행 중
_(없음)_

---

## ⬜ 예정

### 소개(About) 페이지  ⬜
- [ ] 서비스 소개·데이터 출처·갱신 주기 안내 (사이드바 "소개" 항목 + 페이지). **보류 — 추후 추가**.

### 지식그래프 LLM 보강 (후속)  ⬜
- [ ] 키포인트→후보 태그/관계 LLM 추출(Workers AI/Claude API) → `/admin` 검증(source/status 필드)

### 의견함 고도화 (후속)  ⬜
- [ ] 의견 상태 변경(handled)·알림 / 공개 폼 Cloudflare Turnstile

### (이후 아이디어 적재용)
- [ ] …

---

## ✅ 완료

### 사이드바 IA + 탐색/기업상세/의견폼 + 지식그래프  ✅  _(2026-06-02)_
- [x] 공유 사이드바(`sidebar.js`): 기본 닫힘 드로어, 이모지 없음, `/admin` 미노출
- [x] 탐색(`/explore`): 전체 필드 검색 + 태그 필터(`?tag=`)
- [x] 기업 상세(`/company`): 목록 + `?name=` 날짜별 타임라인 + 연관 기업
- [x] 의견(`/feedback`): 별도 페이지(유형/기업/내용/소속팀/이름) + 작성 예시 + 문의 채널(김정연·손아영)
- [x] 백엔드: D1 `suggestions` + `/api/suggestions`(POST 공개·허니팟 / GET PIN) + 관리자 의견함 탭
- [x] 지식그래프: 홈 레이더 **Cytoscape(concentric)** 온톨로지 허브, 노드 클릭→기업/탐색, SVG 폴백, CSP에 jsdelivr 허용
- [x] 내부 링크 확장자 없는 canonical 경로 통일, 라이브 배포·검증

### E2. Hancom CI 적용  ✅  _(2026-06-02)_
- [x] nav 브랜드에 한컴 로고(`/assets/HANCOM.png`) 적용 — 브랜드 텍스트 앞 + 구분선 (`index.html`, `admin/index.html`)
- [x] 파비콘(`/assets/hancom_favicon.png`) 추가
- [ ] (선택, 보류) 푸터/로딩 등 추가 브랜드 요소

### B0. 베이스라인 (대시보드 + 관리자 + 배포)  ✅  _(2026-06-02)_
- [x] 메인 대시보드: 전체 누적 지식 그래프, 분류별 세로 스윔레인 카드, 월 캘린더 + 선택일 브리핑, 자동 반응형
- [x] 관리자(`/admin`): PIN 게이트, 동적 기업/불릿 입력, 기존일 로드, upsert 저장
- [x] REST(Pages Functions): `/api/health` `/api/dates` `/api/reports`(GET/POST) `/api/reports/all`
- [x] Cloudflare D1 연결 + 원격 스키마
- [x] 보안: PIN 상수시간 검증, escapeHtml/safeUrl, `_headers`(CSP·X-Frame-Options), 입력 상한
- [x] 배포 분리: 정적은 `public/`, 내부 문서 비서빙
- [x] GitHub(Private) `jykim-code/AXBiz` + Cloudflare Pages 배포(`https://ax-biz-radar.pages.dev`)
- [x] GitHub Actions 자동배포 워크플로 추가(secret 등록 시 활성)
