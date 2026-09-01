# 이어서 작업 (Handoff)

> 이 파일은 세션 간 인계용 현황 포인터입니다.
> 상세 내용은 각 전문 문서를 참고하세요.

---

## 현재 상태 (2026-08-31 기준)

- **운영**: https://ax-biz-radar.pages.dev
- **레포**: github.com/jykim-code/AXBiz (Private)
- **스테이징**: https://stg.ax-biz-radar.pages.dev

### 완료된 주요 기능

| 기능 | 참고 |
|---|---|
| 메인 대시보드 (지식그래프·스윔레인·캘린더) | `README.md` |
| RAG 시맨틱 검색 (`/api/ask`, Vectorize) | `ARCHITECTURE.md` 6절 |
| 기업 프로필 + AI 요약 + DART 재무 | `ARCHITECTURE.md` 8절 |
| 위클리 픽 Phase 1 + 뉴스레터 (`/weekly`, `/news`) | `ARCHITECTURE.md` 10-1절 |
| 관리자 전체 워크플로 (가져오기·검수·배포·위클리 픽) | `ADMIN-GUIDE.md` |
| 2단계 메신저 발송 (리허설→전사) | `ARCHITECTURE.md` 10-1절 |
| 라이브 항목 삭제 | `ADMIN-GUIDE.md` 5-1절 |

### 현재 진행 중 / 잔여 과제

- **Vectorize 재색인** — 기업 표기 통합(8/24)으로 바뀐 4건 벡터가 옛 영문명으로 남아 있음
  - `POST /api/reindex {"dates":["2026-07-09","2026-08-18","2026-08-19"]}` (관리자 PIN)
- **발행본 스냅샷 구멍** — `save`가 발행 후에도 `payload`를 덮어써 공개 내용이 바뀌는 문제
- 1순위 요구사항(LLM 게이트웨이·자동화·해외 재무 등) → `TODO.md` 참고

---

## 문서 지도

| 궁금한 것 | 볼 문서 |
|---|---|
| 기술 구조·저장소·LLM 호출·비용 | `ARCHITECTURE.md` |
| 파일 구조·API 목록·배포 방법 | `README.md` |
| 앞으로 할 일 | `TODO.md` |
| 완료 이력 | `ROADMAP.md` |
| 관리자 화면 조작법 | `ADMIN-GUIDE.md` |
| 하루 운영 절차 | `동료 가이드.md` |
| 컨플 회차 작성 지침 | `프롬프트.MD` |
| 협업자 셋업 | `ONBOARDING.md` |
| 개발 규칙 단일 출처 | `CLAUDE.md` |

---

## 로컬 환경 복구

```bash
git clone https://github.com/jykim-code/AXBiz.git && cd AXBiz && npm install

# .dev.vars: ADMIN_PIN / OPENROUTER_API_KEY / OPENROUTER_MODEL
cp .dev.vars.example .dev.vars

npm run d1:local   # 로컬 D1 스키마
npm run dev        # http://localhost:8788
```

> Vectorize·R2·Workers AI는 로컬 에뮬레이션 없음 — 해당 기능 검증은 stg 배포에서.

## 배포

- **PR 올리면** → GitHub Actions가 `stg.ax-biz-radar.pages.dev`에 자동 배포
- **main 머지** → `deploy.yml`이 운영에 자동 배포
- 협업자는 main 직접 푸시 금지. 항상 브랜치 → PR 경로 사용
