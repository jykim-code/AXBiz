# AX Biz Radar — 고도화 로드맵

> 고도화 항목을 여기서 추적한다. 새 아이디어가 나오면 **예정**에 추가하고,
> 작업을 시작하면 **진행 중**, 끝나면 **완료**로 옮기고 완료일을 적는다.
>
> 상태 표기: `⬜ 예정` · `🟡 진행 중` · `✅ 완료`
> 체크박스: `- [ ]` 미완료 / `- [x]` 완료. 세부 작업은 항목 아래 하위 체크리스트로.

---

## 🟡 진행 중
_(없음 — Phase 2 완료. 아래 ✅ 참고)_

---

## ⬜ 예정

> 고도화 백로그 — 우선순위 미정. 큰 가치/효용 순으로 그룹화.

### ⭐ 상사 피드백 고도화 — 남은 항목 (다음 우선순위)  _(2026-06-12 접수, 완료분은 ✅ 참고)_

> **핵심 전략 — 이탈 방지 / 원툴(One-tool)**: 유저 흐름 *"이 업체 요즘 뭐하지? → … → 찾아볼까?"* 의 마지막에서
> **사이트 밖으로 이탈**하지 않도록, 한 곳에서 궁금증이 완결되게. → **체류시간↑·이탈↓를 핵심 지표로** 관리.
> ✅ 완료: A-월간 기본 · A-검색 상단(Hero) · C-인앱 인라인 답변 1차 · E-검수→배포 파이프라인.

- [ ] **B. 지식그래프 관계성 + 사용성** ⭐다음 유력 — 태그뿐 아니라 **엔티티 간 관계**(예: 올거나이즈 ↔ 조달청)를 드러냄(기업↔기관/기업↔기업 관계 타입). + **풀스크린·force 레이아웃·줌·드래그·노드 수 조절·축소 시 라벨 가독성**(현 concentric/임베드 불편 해소). (관계 추출은 "AI·지식그래프 고도화"와 연계)
- [ ] **C. 외부 데이터 연결(원툴)** — 인앱 Chat이 내부 RAG에 더해 **외부(웹/실시간) 소스까지** 결합해 답하는 동선. "찾아볼까?"가 우리 안에서 끝나도록. (인앱 인라인 답변 자체는 ✅)
- [ ] **D. 서비스 지표(애널리틱스)** — 체류시간·이탈률·클릭/탐색 흐름 KPI를 관리자가 확인(이탈 방지 전략의 측정 도구).
- [ ] (E Phase 2) 컨플 Cron 자동 적재 / 검수 직접 편집 강화 / 새 draft 알림

### 🌐 데이터 커버리지 확장
- [ ] **해외 경쟁사** — 미국 SEC EDGAR(재무) + 글로벌 뉴스. 현재 보류한 5곳(Anthropic·MS·OpenAI·Salesforce·Cohere)부터
- [ ] **업계평균 대비 재무** — 동종 업종 평균 vs 해당 기업(잡코리아/Goover식). DART 대량 적재 필요(무거움)
- [ ] **데이터 자동 수집** — 뉴스 RSS/검색 → LLM 초안 생성 → 관리자 검토 후 등록(수기 입력 부담↓)
- [ ] **컨플 동기화 자동화** — 전체 페이지 일괄 동기화 버튼 / GitHub Actions cron(정기)

### 🤖 AI·지식그래프 고도화
- [ ] **지식그래프 관계 추출** — 본문에서 기업–기업 관계(제휴·경쟁·리셀) LLM 추출 → `/admin` 검증(source/status). (태그 추천은 ✅ 완료)
- [ ] **(조사 필요) OKF(Open Knowledge Format) / LLM-wiki 접목** — Google Cloud OKF v0.1(2026-06): 지식=마크다운+YAML 프론트매터 concept, cross-link=그래프, `# Citations`. 접목 후보: ① **관계 그래프(B)를 OKF concept(기업·기관·테마)+typed link로 모델링** ② **D1 데이터를 OKF 번들로 export("지식 자산화", Git·에이전트 소비 가능)** ③ RAG를 큐레이션 concept로 보강. ⚠️ v0.1 신생 표준 — 저장소 교체는 금물, *표현/내보내기 레이어*로만 차용. 참고: cloud.google.com/blog OKF, discuss.pytorch.kr/t/...10701
- [ ] **주간 다이제스트** — 이번 주 핵심 동향을 LLM이 요약해 대시보드 상단/이메일로
- [ ] **알림·구독** — 관심 기업/태그에 새 동향 시 이메일·슬랙 알림

### 🔎 사용성
- [ ] **기업 비교** — 2~3개 기업 동향·재무 나란히 비교 뷰
- [ ] **검색 필터·히스토리** — 기간·분류 필터, 인기 질문/최근 질문
- [ ] **대시보드 트렌드 차트** — 태그 빈도 추이, 분류별 활동량
- [ ] **소개(About) 페이지** — 서비스 소개·데이터 출처·갱신 주기 (사이드바 "소개" 항목)
- [ ] 모바일/접근성·성능 다듬기

### 🛠 운영·신뢰성
- [ ] **의견함 고도화** — 의견 상태 변경(handled)·처리 알림 / 공개 폼 Cloudflare Turnstile(봇 방지)
- [x] `dart-corps.txt` 갱신 수단 확보 — `node scripts/refresh-dart-corps.mjs` (분기 1회 권장, `--check` 로 변경분만 확인 가능)
- [ ] **보안** — OpenRouter API 키 rotate(노출 이력) / Rate Limiting 정밀화
- [ ] (선택) `GET /api/companies` 그리드 서버화 / 관리자 활동 로그

---

## ✅ 완료

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
- [ ] (선택·후속) `GET /api/companies` 그리드 서버화 / 전체 페이지 일괄 동기화·cron

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
- [ ] (후속) 업계평균 대비, 해외 기업 재무(SEC 등)

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
