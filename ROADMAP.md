# AX Biz Radar — 완료 이력

> **이 파일은 끝난 작업의 기록이다.** 앞으로 할 일은 `TODO.md`에 있다.
> 작업이 끝나면 `TODO.md`에서 항목을 지우고 여기에 완료일과 함께 옮긴다.
>
> 최신 완료가 위로 오도록 유지한다. 체크박스 `- [x]`는 그 묶음의 세부 작업이다.

---

## ✅ 완료

### 다크 모드 토큰 전환 · 읽기 제스처 정리 · 문서 현행화  ✅  _(2026-09-01)_
> 다크 모드를 넣고 나서 드러난 것들을 정리한 날. 공통점은 「읽으려는 동작」이 조작으로
> 오인되던 문제(드래그·스와이프)와, 색을 하나씩 덮어 새로 쓰는 곳마다 누락되던 문제다.
- [x] **라이트·다크를 토큰으로 갈아탄다** — Tailwind 색을 `rgb(var(--c-ink) / <alpha-value>)` 로 두고
  `dark.css` 에서 변수만 뒤집는다. 유틸리티 클래스를 하나씩 덮던 방식은 투명도 34종을 매번
  빠뜨려 본문이 어두운 바탕에 어두운 글자로 깔렸다. 예외는 라임 판 안쪽과 `bg-ink`·`bg-white` 솔리드 판 (PR #42)
- [x] **본문을 드래그해 선택하면 카드가 닫히던 문제** — 누른 지점·뗀 지점의 거리와 카드 안에 남은
  선택 영역으로 「읽으려는 드래그」를 걸러낸다 (PR #41)
- [x] **뉴스레터 넘기기를 관성에 맡기지 않는다** — `overflow:hidden` + `touch-action:pan-y` 로 native
  가로 스크롤과 그 관성을 끊고 `scrollLeft` 를 코드가 정한다. 손가락은 거리(판 폭 18%)·속도(0.35px/ms)로,
  트랙패드는 wheel 을 140ms 간격으로 한 제스처로 묶어 **한 제스처 = 한 칸**을 보장 (PR #45)
  - `scroll-snap` 만으로는 막을 수 없었다: 스냅은 멈출 자리만 정하고 관성이 스냅 지점 여러 개를
    지나친다. 손 뗀 뒤 되돌리는 보정은 트랙패드에 걸리지 않았다(터치 이벤트가 없다)
- [x] **뉴스레터 픽 판에서 한컴 로고 제거** — 판 안의 그림 위에 우리 로고가 오면 출처로 읽힐 여지가 있다.
  제호는 표지·마무리 장과 겹쳐 띄우기 썸네일에만 남긴다 (PR #43)
- [x] **캘린더를 고정폭에서 유동으로** — 좁은 화면에서 잘리던 문제. 기준은 `design-preview.html` (PR #44)
- [x] **정부·부처·공공기관은 항목 주체로 쓰지 않는다** — 참여 기업으로 나눠 등재하고 `공공·기관`
  4번째 분류는 만들지 않는다. `CLAUDE.md` 지침 로그 + `프롬프트.MD` 절 (PR #40)
- [x] 문서 현행화: 08-31 머지분(로고·방문 통계·수동 입력 삭제)을 ROADMAP·TODO 에 반영,
  README 에 헤더·푸터·다크 모드 절과 파일 구조 보강, ARCHITECTURE 에 CSP 외부 출처·방문 통계 절 추가 (PR #40)

### 로고 판 분리 · 방문 통계 · 수동 입력 삭제 동선  ✅  _(2026-08-31)_
> 다크 모드 도입으로 드러난 로고 문제와, 「빼기」가 라이브까지 닿지 않던 나머지 절반을 정리.
- [x] 로고를 CSS 필터 대신 **바탕에 맞는 파일**로 교체 — `HANCOM.png`(검정 글자) / `HANCOM-w.png`(흰 글자).
  `filter: invert(1)` 이 H 자 강조색까지 뒤집어 `#ef5222` → `#10addd` 로 바뀌던 문제.
  판형 716×158·잉크 위치를 맞춰 오차 0px, 배경 6종 픽셀 검증(강조색 오차 0~2, 글자 대비 6.3~21:1) (PR #37)
- [x] 갈아끼우는 규칙 분리: 바탕이 바뀌는 자리(nav·footer)는 `util.js syncHancomLogos()`,
  바탕이 정해진 판(뉴스레터 슬라이드·위클리 커버·발행 예정)은 `data-logo-fixed` 로 제외
- [x] **Cloudflare Web Analytics** 비콘을 공개 페이지 6곳에 삽입, `/admin`·`/preview`·`/dev` 는 제외.
  `_headers` CSP 2곳 허용(`static.cloudflareinsights.com` · `cloudflareinsights.com`) (PR #39)
- [x] **불러와서 고친 수동 입력은 「빼기 = 삭제」로 동작** — 불러온 시점의 신원·내용 해시를 기준선으로
  남기고 배포 때 draft 에 없는 항목을 라이브에서 지운다. 신규 입력·컨플 가져오기는 기준선이 없어 병합 그대로 (PR #38)
- [x] 지우지 않는 조건 4가지(재입력분 제외 / 부분 배포 시 미적용 / 남이 고쳤으면 409 STALE_BASE / 기준선은 1회 소비),
  저장 직후·배포 확인창에서 지워질 항목 먼저 표시(dryRun), 항목이 0이면 `reports` 행 삭제
- [x] 검증: 로컬 `wrangler pages dev` + D1 로 6개 시나리오 23개 단정 통과

### UI 개선 — header·footer 재구성 + 다크 모드 + 캘린더 카드 리디자인  ✅  _(2026-08-28)_
- [x] header/footer 재구성 + 다크 모드 지원
- [x] 캘린더 카드 리디자인
- [x] 위클리픽 링크 + 주차 계산 개선
- [x] 디자인 시안 임시 파일 제거

### 위클리 픽 Phase 1 + 뉴스레터  ✅  _(2026-08-24)_
> 주 1회 발행물(위클리 픽) 전 기능과 슬라이드 뉴스레터(/news) 완료.
- [x] `/weekly` 회차 썸네일 그리드(활자·색 자동 커버, 배색 3종 순환) + `/weekly?w=` 상세(F안 매거진 조판)
- [x] `/news` 뉴스레터 슬라이드 — 같은 데이터를 다크 620px 캐러셀로. 사이드바 미노출, 상세 표지 썸네일로 겹쳐 띄우기
- [x] 관리자 [위클리 픽] 탭 — 후보 체크(건별) · Pick 이유 작성 · AI 초안 · 이미지 업로드(R2) · 발행
- [x] 후보 정렬 신호 실측 기반 4종으로 교체(신규기업·새영역·공통주제·신규주제), 수량 제한 폐기
- [x] 발행 예정 커버 자리(점선 베이지 + 도형 텍스처)
- [x] 메시지 발송 2단계(1차 리허설→테스트 방 / 2차 전사→전사 라운지), SHA-256 문구 지문 검증
- [x] 픽 이미지 R2 업로드(`/api/pick-image`) — 관리자 직접 업로드만, 출처·권리 근거 필수
- [x] `_weekly-message.js` 서버 문구 생성(dryRun으로 관리자 화면 미리보기와 동일 보장)
- [x] 발행본 스냅샷 고정(payload 통째 복사), `stats.picks` 실제 픽 수로 수정

### 2026-08 품질·기능 묶음  ✅  _(2026-08-14)_
> 2026-08-10~08-14 사이 머지된 버그픽스·기능 개선 묶음.
- [x] 대시보드 기본 기간 월간 → 주간 변경
- [x] 같은 날 같은 기업 동향 여러 건 허용(뒤 배포가 앞 동향을 덮어쓰던 문제 수정)
- [x] 태그 40자 초과 삭제 불가 버그 수정
- [x] 기간 종합 중복 표시 정리
- [x] 지식그래프 태그 공유 기준으로 재선정(236개 → 62개)
- [x] 지식그래프 호버 확대(약 3배) + 라임 헤일로 + 250ms 체류 후 이웃 줌인
- [x] 기업 주요 동향 건별 접이식 카드 + 핵심 흐름 기간 라벨 원장형
- [x] 재색인 서브리퀘스트 상한 분할 처리 + DART 일시 장애 6시간 캐시 분리
- [x] 시사점·한컴 인사이트 불릿 다개 기준 전환(`style/insight-bullets`)
- [x] 발행 시 끝 온점 자동 제거(`_style.js`)
- [x] 기간 종합·기업 요약 문체 기준 적용(체언 종결·em dash 치환)
- [x] 기업 검색 별칭 사전 적용 + D1 관리·관리자 편집 탭(`feat/company-alias-admin`)
- [x] 기업 목록 10개·주요 동향 5건 페이지네이션
- [x] OpenRouter `reasoning: {enabled: false}` 추가(추론 모델 토큰 낭비 방지)

### 라이브 항목 삭제 + 관리자 명칭 정리  ✅  _(2026-08-27)_
> 배포가 병합이라 draft 에서 항목을 빼도 라이브가 지워지지 않았고, 그 경로 자체가 없었다.
> 「기업 삭제」라는 이름이 기업 전체 데이터를 지우는 것으로 읽힌 문제도 함께 정리.
- [x] `GET/POST /api/dev/live` — 날짜별 라이브 항목 조회 + **동향 1건 삭제**. 신원은 배열 인덱스 + `(name, entryKey)` 대조(어긋나면 409 STALE)
- [x] 삭제 시 파생 데이터 동기화: `company_entries` 재구축 + Vectorize 재색인(고아 벡터 정리). 항목이 0이면 `reports` 행 자체 삭제(캘린더에 빈 날짜 방지)
- [x] 검수·배포 탭 하단 **[🗑 라이브 항목 삭제]** 섹션 — 날짜 → 불러오기 → 건별 삭제, 확인 창에 기업명·날짜와 「남는 것」 명시
- [x] 명칭: 「기업 삭제」→**이 항목 빼기**, 「기업 목록/추가」→**동향 항목/+ 항목 추가**, 검수 카드 「삭제」→**초안 삭제**
- [x] `ADMIN-GUIDE.md` 5-1절·FAQ 2건 추가, `/admin` 사용 가이드 ⑤ 추가
- [x] 데이터 정리: 오해로 남아 있던 2026-08-24 3건(SK텔레콤·Anthropic·업스테이지)·2026-08-25 2건(LG CNS·IBM) 제거

### 검수 워크플로 정착 + 통합 콘솔 마감 + 운영 가이드  ✅  _(2026-06-12)_
> dev/admin/preview 혼선 해소, "넣기→검수→미리보기→배포" 단일 흐름 확립.
- [x] 가져오기 탭 최우선 + **수동 입력도 draft→검수→배포** 동일 파이프라인(직접 라이브 제거)
- [x] `설정`→`태그 관리` 명칭, 상단 `Published 보기`+`검수 미리보기 ↗` 링크
- [x] **동일(변경 없음) diff** 실판정(내용 시그니처) + 배지 아이콘 제거·색 구분(신규/교체/동일) + "동일 N건 정리"
- [x] **미리보기 안정화**: `/preview` PIN 게이트 · PIN을 localStorage(탭 간 공유) · **미리보기 모드 탭 고정(sticky)** — 사이드바·링크 이동해도 draft 유지(홈만 되던 버그 해결)
- [x] **stg 도메인 = 통합 검수 창구**(새 코드 + draft 데이터 함께), `/dev`→`/admin` 리다이렉트
- [x] **배포 워크플로 확정**(CLAUDE.md): 코드=stg 선배포→확인→main, 데이터=draft 파이프라인
- [x] OpenRouter 모델 **`qwen/qwen3.7-plus`**(유료)로 전환 — env 기반(코드 무수정), 표기 갱신
- [x] **관리자 운영 가이드** — `ADMIN-GUIDE.md` + `/admin` "📖 사용 가이드" 탭

### E-2. dev/admin 통합 콘솔 + 데일리(LLM)/히스토리 가져오기  ✅  _(2026-06-12)_
> dev/admin 혼용 해소. **/admin 단일 콘솔**(검수·배포 기본 탭) + **/preview**(실사이트 draft 합본). /dev → /admin 리다이렉트.
- [x] 가져오기 2종: **데일리**(섹션 A LLM 구조화, `/api/dev/import-daily`, 기업명 정규화) / **히스토리**(6열 표 파서)
- [x] /admin 탭 재구성: 검수·배포(draft 배지) · 가져오기 · DART · 의견함 · 수동 입력(직접 반영 경고) · 설정
- [x] 검수 카드 **DART 미연결 배지**(클릭 → DART 탭) — 새 기업 매핑 유도
- [x] 검증: 데일리 실페이지 LLM 추출(올거나이즈·금융망분리) 정상, 공개 무누수, 리다이렉트

### E. dev 검수 → 1-click 배포 파이프라인 (실사이트 dev 프리뷰)  ✅  _(2026-06-12)_
> 플랜: `.omc/plans/dev-staging-publish-pipeline.md`. Claude 앱(생성) → 컨플 → `/dev` 검수 → 배포. 생성은 Claude 앱 유지(품질·비용).
- [x] `draft_entries` 테이블(draft/published, `(date,company,source)` 유니크) — 원격 D1 적용
- [x] 공용 모듈: `_auth.js`(PIN), `_confluence.js`(파싱·`parseConfluencePage`), `_publish.js`(`mergeAndPublishDate` 병합+재색인+요약). `import-confluence` 리팩터로 공용화
- [x] dev 엔드포인트(PIN): `/api/dev/import`(컨플→draft) · `reports-all`·`reports`(draft 합본 프리뷰) · `drafts`(목록·삭제) · `publish`(draft→reports 승격)
- [x] `api.js` 프리뷰 라우팅(`?preview=1`+PIN→dev 합본, 403 시 공개 폴백) + dev 래퍼
- [x] `/dev`(PIN 게이트) → `?preview=1` 진입 / `dev-toolbar.js`(상단 배너·가져오기·검수 드로어·배포, 비프리뷰 시 no-op) — index·company·explore에 포함
- [x] 끝단 검증: 격리 날짜로 draft→프리뷰(_draft)→**공개 무누수**→배포→**라이브 반영**→published 전환, PIN 403, 정리까지 확인

### 상단 Hero 검색 + 월간 기본 (상사 피드백 A·C 일부)  ✅  _(2026-06-12)_
- [x] 대시보드 기본 기간 **월간**으로 변경
- [x] nav 아래 **Hero 검색 바** + 빠른 칩, Enter/검색 시 `/api/ask` **인앱 인라인 답변**(출처·`[n]`)으로 **이탈 방지**, "탐색에서 더 보기"로 `/explore?q=` 연결

### AI 태그 추천 (지식그래프 LLM 보강 1단계)  ✅  _(2026-06-05)_
- [x] `POST /api/suggest-tags`(PIN): 기업 본문(주요내용/시사점/한컴인사이트)→OpenRouter(JSON)로 한국어 태그 4~8개 추출
- [x] 보고서 입력 탭 각 기업 블록 **'AI 태그 추천' 버튼** + 후보 칩(기존 태그 제외, 클릭 시 태그칸 추가) — 자동확정 아닌 관리자 채택

### 재무 그래프·그리드 정렬·관리자 UX 다듬기  ✅  _(2026-06-05)_
- [x] 재무 분기 그래프: **0 기준선**(플러스 위/마이너스 아래) + **√(제곱근) 스케일**(조~억 단위 공존) + 라벨 충돌 방지
- [x] 기업 그리드 **국내 우선 고정 순서**(삼성SDS→SK텔레콤→LG유플러스→네이버→LG CNS→KT DS→현대오토에버→야놀자→이스트소프트→업스테이지), 목록 외(해외 등)는 정렬 토글로 뒤에
- [x] 관리자 **PIN 게이트 즉시 검증**(틀린 PIN 입장 차단) · **DART 연결 탭 미연결 업체 우선 정렬**
- [x] 탐색 출처 카드에서 기업 카테고리 칩 제거(정리)

### 🕒 에픽: 1년치 데이터 + 최신/히스토리 정확성 (Phase 2)  ✅  _(2026-06-05)_
> 증분(뉴스) 모델에서 기업의 "현재 상태"를 정확히 — **타임라인 인지(timeline-aware) RAG** + 파생 테이블.
- [x] `company_entries(company,date,category,data)` 파생 테이블 + 인덱스 — 원격 D1 생성 + 전체 백필
- [x] `reports` POST·컨플 가져오기에서 `company_entries` 동기화(`_entries.js`, 날짜별 delete→insert, best-effort)
- [x] `/api/ask` 타임라인 인지 — 벡터 매치는 **기업 식별용**(상위 3곳), 컨텍스트는 `company_entries`에서 기업당 최근 6건 연대기. "최신=현재 상태·과거는 변화 이력" 프롬프트 + 오늘 날짜 주입, 인용 필터·폴백 유지, max_tokens 1200
- [x] 실데이터 모순 검증 — LG CNS(최신 기준 "AX 플랫폼 있음") / 삼성SDS 패브릭스(과거→현재 변화 이력 구분 서술) ✓
- [x] **히스토리 본삽입** — 컨플 국내 10곳 42건(2026-01~05) 자동 ingest (해외 5곳 보류). Vectorize ~52/4,880
- [x] **컨플 가져오기 탭(자동화 2단계)** — 링크→미리보기→실행. `POST /api/import-confluence`(PIN, Confluence REST), 단축링크·엔티티·한글명 매핑·병합 업서트·재색인·요약 재생성
- 후속 과제(`GET /api/companies` 서버화, 일괄 동기화·정기 실행)는 `TODO.md`로 이관

### 기업 AI 요약 (핵심 흐름 + 종합 한컴 인사이트)  ✅  _(2026-06-05)_
- [x] `GET /api/company-summary` — 기업 전체 타임라인(출처 불문)→LLM(JSON 강제) 생성, `company_summary` D1 캐시
- [x] `source_hash` 변경 감지 → 데이터 추가 시 다음 조회 때 자동 재생성 / LLM 실패 시 stale 캐시 폴백 / 2건 미만 미표시
- [x] 기업 상세 헤더 아래 요약 밴드: 흐름(흰 카드+기간 칩) + 인사이트(다크+라임) — 첫 생성 ~15s(스피너), 이후 캐시 0.1s

### 관리자 태그 관리 + 그래프/탐색 태그 큐레이션  ✅  _(2026-06-05)_
- [x] 그래프·탐색 태그 = 핀(관리자) ∪ 공유(2기업↑) ∪ 기업별 대표 3, 중요도순 (`selectCuratedTags` 공용)
- [x] admin 설정 탭: 핀 태그 / 기업별 태그 수정·추가 / 전역 삭제(`POST /api/tags`, 원본 수정+자동 재색인)
- [x] 유형 파생 태그 10종 전역 삭제(31개 날짜 재색인), ingest 의 유형→태그 변환 제거

### 컨플 히스토리 자동 ingest (1단계)  ✅  _(2026-06-05)_
- [x] 컨플 "AX 동향 히스토리(기업별·2026)" 국내 10곳 42건(2026-01~05) 병합 업서트 + RAG 색인 (해외 5곳 보류)
- [x] admin DART 연결 탭 / PIN 게이트 즉시 검증 / 지식그래프 상위태그·main 폭 등 안정화

### 기업 회사정보 + 재무 (DART 연동)  ✅  _(2026-06-04)_
> 출처: Open DART. 기업 상세 2단(좌 주요동향 / 우 위 회사정보 · 우 아래 재무).
- [x] `functions/_dart.js`: 회사개황 + 연도 요약(3개년+전년비 YoY) + 분기 추이(누적 차분 4분기) + D1 7일 캐시 + **User-Agent 필수**(CF Workers fetch 시 DART 비-JSON 방지)
- [x] `GET /api/company-profile?name=` : `company_meta.corp_code` → DART → 캐시. 미매핑/해외/비상장 우아한 폴백
- [x] `company_meta`(이름→corp_code 수동 매핑) + `company_profile` 캐시 테이블 / 시드: 네이버(00266961)·플래티어(01454341)·업스테이지(01786541)
- [x] 기업 상세 UI: 회사 정보 카드 + 재무 카드(연도 요약 행 + 매출·영업이익 묶음 막대그래프, 인라인 SVG)
- [x] **관리자 'DART 연결' 탭** — 검색→선택 자동완성(전체 11.8만 정적목록 `dart-corps.txt` 클라이언트 검색)으로 기업↔corp_code 매핑 + 대표자 등 overrides 보정. `/api/company-meta`(PIN)
- [x] (유지보수) `dart-corps.txt` 갱신 스크립트 — `scripts/refresh-dart-corps.mjs`. DART corpCode.xml 을 내려받아
      ZIP 해제·XML 파싱 후 `code\tname\tstock` 으로 덮어쓴다. 키는 `DART_API_KEY`(env 또는 `.dev.vars`).
      `--check` 는 신규·사명변경·종목코드변경만 출력하고 파일은 쓰지 않는다. 분기 1회 권장
- 후속 과제(업계평균 대비, 해외 기업 재무)는 `TODO.md`로 이관

### 기업 페이지 카드 그리드 (Phase 1)  ✅  _(2026-06-04)_
> 플랜: `.omc/plans/company-page-and-temporal-data-plan.md` (로컬 전용)
- [x] 첫 화면 버튼 목록 → **카드 그리드**(이름·카테고리·최신 분석일·대표태그·최신 요약·등장N)
- [x] 검색(이름·태그·요약) + 카테고리 필터 + 정렬(최신순 기본/등장순), 클릭→기존 상세 타임라인
- [x] `buildOntology`에 기업별 `latestDate`/최신 요약 집계 추가(기존 그래프·탐색 호환)
- [x] 에디토리얼 카드 디자인(Template 톤): `rounded-[28px]`·라임 eyebrow·대형 기업명·화살표 원·첫 카드 다크 + 대형 헤딩

### UI/UX·내비 다듬기 묶음  ✅  _(2026-06-04)_
- [x] 사이드바 **라임 틴트 글래스모피즘**(`bg-lime/20 backdrop-blur`), 구성 동일·오버레이 블러
- [x] 사이드바 중복 "태그" 메뉴 제거(전용 태그 페이지 폐기) + `?tag=` 진입 시 결과 섹션 자동 스크롤
- [x] 헤더 Hancom 로고 클릭 → 홈(대시보드) 이동 (index/explore/company/feedback)
- [x] `/explore`: 검색 전 결과 숨김 + 질문칸 **Enter 즉시 제출**(Shift+Enter 줄바꿈, 한글 IME 조합 Enter 무시)
- [x] 대시보드·기업·탐색 흐릿한 텍스트 가독성 상향(opacity 40/50→75, 60/70→80; 장식·상태값 보존)
- [x] 기업·탐색·의견 페이지 **에디토리얼 디자인 통일**(eyebrow + 대형 헤딩 + rounded-28 카드), 탐색 질문창 한 줄 검색바(버튼 "검색")
- [x] **한글 웹폰트 Pretendard** 적용(라틴은 Space Grotesk/Inter 유지, 한글만 폴백; CSP에 jsdelivr 허용; 그래프 라벨 포함)
- [x] 사이드바 상단 CI 클릭 시 닫기
- [x] 지식그래프 라벨(텍스트) 클릭도 노드와 동일 선택·이동(`text-events`)
- [x] **플로팅 질의응답(FAB)** 우하단 버튼 — RAG 질의 패널(`ask-fab.js`, feedback·admin 제외)

### 🔎 에픽: RAG 시맨틱 검색 (탐색 고도화)  ✅  _(2026-06-04)_
> 검색=Cloudflare Vectorize(`ax-biz-radar-idx`, 1024d/cosine) / 임베딩=Workers AI `@cf/baai/bge-m3`(1024d) /
> 생성=OpenRouter `OPENROUTER_MODEL`(현재 `qwen/qwen3.7-plus`) / `/explore` 자연어 질문 + **키워드 폴백·태그 목록 유지**.
> 프리뷰 배포에서 임베딩·검색·생성·인용까지 끝단 검증 완료. Vectorize는 계정 단일 인덱스(프리뷰·운영 공유).
- [x] RAG-1 인프라: Vectorize 인덱스 + `[ai]`·`[[vectorize]]`·`[[kv_namespaces]]`(RL) 바인딩 + `functions/_rag.js`(임베딩/청크/upsert/delete)
- [x] RAG-2 인덱싱: `POST /api/reindex`(PIN 백필) + `POST /api/reports` 증분 재색인(old delete→new upsert, best-effort)
- [x] RAG-3 질의: `POST /api/ask` — 질문 임베딩→Vectorize 검색(cosine≥0.35)→D1 원본 재조회→OpenRouter 생성→`{answer, sources[]}`, `[n]` 인용·인젝션 방지
- [x] RAG-4 프론트: `/explore` 자연어 질문 + 답변/출처 카드(→`/company`·원문), 인용 칩, 로딩/빈/오류, 키워드 폴백, `API.ask()`
- [x] RAG-5 운영: 질문 ≤500자 + KV 고정 윈도우 Rate Limiting(IP/분 10, Pages가 ratelimit 바인딩 미지원이라 KV로 구현)
- [x] 운영(main) 배포 + 라이브 검증 — 운영 시크릿·인덱스 준비, node(UTF-8) 끝단 질의 확인
- [x] (후속 개선) 출처를 **답변에 실제 인용된 `[n]`만** 반환(+순차 재번호) / 출처 카드에 **근거(주요내용) 접이식** 표시

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
- 푸터·로딩 등 추가 브랜드 요소는 보류(필요해지면 `TODO.md`에 추가)

### B0. 베이스라인 (대시보드 + 관리자 + 배포)  ✅  _(2026-06-02)_
- [x] 메인 대시보드: 전체 누적 지식 그래프, 분류별 세로 스윔레인 카드, 월 캘린더 + 선택일 브리핑, 자동 반응형
- [x] 관리자(`/admin`): PIN 게이트, 동적 기업/불릿 입력, 기존일 로드, upsert 저장
- [x] REST(Pages Functions): `/api/health` `/api/dates` `/api/reports`(GET/POST) `/api/reports/all`
- [x] Cloudflare D1 연결 + 원격 스키마
- [x] 보안: PIN 상수시간 검증, escapeHtml/safeUrl, `_headers`(CSP·X-Frame-Options), 입력 상한
- [x] 배포 분리: 정적은 `public/`, 내부 문서 비서빙
- [x] GitHub(Private) `jykim-code/AXBiz` + Cloudflare Pages 배포(`https://ax-biz-radar.pages.dev`)
- [x] GitHub Actions 자동배포 워크플로 추가(secret 등록 시 활성)
