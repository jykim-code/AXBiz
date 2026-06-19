# AX Biz Radar — 개발 지침 (사용자 명시 규칙)

> 이 파일은 사용자가 명시한 지침을 누적 기록하는 단일 출처(Source of Truth)다.
> Claude는 매 작업 전 이 파일을 먼저 확인하고, 새 지침이 나오면 여기에 추가한다.
> 디자인 관련 지침은 항상 `design-preview.html`을 기준으로 한다.

## ⭐ 최우선 규칙
- **프론트엔드 개발 시 반드시 `design-preview.html`을 참고할 것.** 이 파일이 확정된 디자인 기준이다.
  - 색/폰트/레이아웃/컴포넌트 스타일은 모두 이 파일을 따른다.
  - `AX-Biz-Radar-기획.md`의 디자인 서술(레이더/오렌지/다크 컨셉)은 **폐기**되었고,
    디자인은 `design-preview.html`(Template 기반 라임 톤)이 우선한다.
- **관리자 페이지의 존재를 대시보드(메인)에 절대 노출하지 말 것.**
  - nav·푸터·어디에도 `/admin` 링크/버튼/힌트를 두지 않는다.
  - 관리자 페이지는 URL을 직접 아는 사람만 접근한다.

## 확정된 디자인 (design-preview.html 기준)
- **톤**: Template(`Template/index.html`)의 비주얼 언어를 그대로 차용한 밝은 에디토리얼 스타일.
- **색**: 라임 `#c8f200`, 베이지 `#f7f5f0`, ink `#111`, 라벨용 `lime-600 #7ba500`.
- **폰트**: 제목 `Space Grotesk`(font-display), 본문 `Inter`. 대형 헤딩은 `tracking-tight/tighter`.
- **컴포넌트**: 라임 nav(`bg-lime/90` blur), 흰 라운드 카드(`rounded-[24px]` + `shadow-xl shadow-ink/5` + hover lift),
  `text-lime-600` 대문자 미니 라벨, `bg-ink` 다크 대비 카드, `.sn-reveal` 등장 애니메이션.
- **레이아웃 (한 화면)**:
  - 상단: 라임 nav (브랜드 + 태그라인 좌측 / Report Date 우측). **관리자 버튼 없음.**
  - 좌측(~42%): **지식 그래프** 다크 카드 — 임의 노드-링크 관계망(기업↔태그, 중앙 AX 허브) +
    하단 통계(취합 데이터 총 개수 / 추적 기업 / 분석일 / 태그 수). 크기 현행 유지.
  - 우측(~58%): **세로 스윔레인** — 대기업 → 중견기업 → 스타트업·중소 (순서 고정).
    각 섹션은 전체 폭 사용, 카드 `lg:grid-cols-2`로 2장씩 넓게 배치. 우측 영역 세로 스크롤.
  - 하단: 흰 라운드 카드 월 캘린더 (데이터 날짜 라임 점, 선택 시 라임 채움, 기본=최신 날짜).
  - 기업 카드: 기업명 + 요약 → 클릭 펼침 → 주요 내용 / 시사점 / **한컴 인사이트(라임 박스)** /
    출처·상세모니터링(Confluence) 링크 / 태그 칩.
- **태그라인**: "AX 레이더 : 시장의 동향 포착에서 인사이트까지"

## 확정된 기술 스택
- 프론트: 바닐라 HTML/CSS/JS + Tailwind CDN (빌드 단계 없음).
- DB: **Cloudflare D1** (서버리스 SQLite), Pages Functions에 `DB` 바인딩.
- 백엔드/REST: Cloudflare Pages Functions (`/api/*`).
- 배포: Cloudflare Pages + GitHub 레포 자동 배포.
- 관리자 인증: 단순 숫자 PIN. 서버(Function)에서 `ADMIN_PIN` 환경변수와 대조하여 검증.

## ⭐ 배포 워크플로 (2026-06-12 사용자 확정)
- **코드(UI/기능) 변경**: 항상 **stg 브랜치에 먼저 배포** → 사용자에게 스테이징 URL 공유 → **확인 후** main 배포.
  - 스테이징: `npx wrangler pages deploy public --project-name=ax-biz-radar --branch=stg --commit-dirty=true --commit-message="ascii"`
    → `https://stg.ax-biz-radar.pages.dev` (바인딩·시크릿 모두 동작 확인됨)
  - 본 반영: 같은 명령에 `--branch=main`.
  - 예외: 사용자가 명시적으로 "바로 배포"라고 한 경우만 main 직행.
- **데이터(보고서) 변경**: 코드와 무관 — `/admin` 가져오기/수동입력 → draft → 검수 → 배포 버튼 (사이트 `/preview`에서 draft 합본 확인).
- 두 트랙은 독립: 코드 스테이징=stg 브랜치 URL, 데이터 미리보기=`/preview`(draft 합본).

## ⭐ 통합 검수 창구 (2026-06-12 사용자 확정)
- **stg 도메인을 단일 "배포 전 검수" 창구로 사용.** `https://stg.ax-biz-radar.pages.dev/preview` = **새 코드(stg 브랜치) + draft 데이터(공유 D1)**를 한 화면에서 확인.
  - `/admin`의 "검수 미리보기 ↗" 버튼이 이 URL로 연결됨(크로스오리진이라 PIN 1회 추가 입력).
- **그래서 main에 코드 배포할 때는 stg 브랜치도 항상 함께(또는 먼저) 배포해 동기화**할 것 — 안 그러면 검수 화면이 옛 코드로 draft를 보여줘 오해 소지.
  - 데이터만 바뀌는 경우엔 stg 브랜치가 이미 main과 같으니 추가 배포 불필요.
- prod(`ax-biz-radar.pages.dev`)=발행 코드+발행 데이터(공개), stg 도메인=스테이징(검수).

## ⭐ 협업 배포 프로세스 (2026-06-12 사용자 확정) — 2인(관리자 + 협업자)
- **협업자(또는 그 Claude Code)는 절대 `main`에 직접 푸시/배포하지 않는다.** 항상 **새 브랜치 → PR**까지만.
  - 코드 변경 요청 시: 새 브랜치 생성 → 커밋 → 푸시 → **PR 생성**. (`gh` 없으면 git push 후 PR은 사용자/웹에서)
  - `main` 직접 푸시·`wrangler pages deploy --branch=main`(운영 직접배포) **금지**.
- **운영 배포 = `main` 머지 시 GitHub Actions(`deploy.yml`)만.** 운영 토큰은 GitHub Secrets에만(노트북엔 두지 않음). "머지 = 배포".
- **PR/브랜치 푸시 시 자동**: `preview.yml`이 **단일 스테이징**(`stg.ax-biz-radar.pages.dev`)으로 배포(PR마다 새 주소 X) + PR 댓글, `pr-check.yml`이 JS 문법 검사.
- 신규 협업자 셋업은 `ONBOARDING.md` 참고. 데이터 변경은 코드 아님(`/admin` draft→배포).
- 관리자가 GitHub에서 1회 설정: **`main` 브랜치 보호(PR+승인 필수, 직접 푸시 차단)**, 협업자 collaborator 초대, 운영 토큰은 협업자에게 미공유.

## 데이터 / API (계획 기준 — AX-Biz-Radar-기획.md 참조)
- 스키마: `reports(date PK, companies TEXT(JSON), updated_at)`. 날짜 PK upsert(덮어쓰기).
- 엔드포인트: `GET /api/dates`, `GET /api/reports?date=`, `POST /api/reports`(PIN 검증, 자동화 진입점).

---

## 지침 로그 (시간순 누적)
- 디자인은 `design-preview.html` 기준. (사용자 확정)
- 코드 변경은 stg 브랜치 선배포→확인 후 main 반영. 데이터는 /admin draft→검수→배포. (2026-06-12 사용자 지시)
- 검수 환경 주소를 `preview.ax-biz-radar.pages.dev` → `stg.ax-biz-radar.pages.dev`로 변경(데이터 미리보기 `/preview` 페이지와 이름 충돌 해소). 배포 브랜치도 `preview`→`stg`. (2026-06-19 사용자 지시)
- 기획안의 레이더/오렌지/다크 컨셉 → Template 라임 톤으로 전환. (사용자 지시)
- 칸반: 가로 3컬럼 → 세로 스윔레인 + 카드 2장 grid. (사용자 지시)
- 관리자 입력 버튼 삭제, 관리자 페이지 존재 비노출. (사용자 지시)
