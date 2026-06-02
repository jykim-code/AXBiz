# 이어서 작업 (Handoff) — 2026-06-02

> 다른 PC(노트북)에서 이어가기 위한 현재 상태·결정·다음 단계 기록.
> 상세 진행은 `ROADMAP.md` 참고. (※ `.omc/plans/*` 상세 기획서는 gitignore라 이 레포엔 없음 — 핵심 결정은 아래에 옮겨둠)

## 현재 상태
- **라이브**: https://ax-biz-radar.pages.dev  ·  **레포(Private)**: github.com/jykim-code/AXBiz
- **배포**: Cloudflare Pages(정적 `public/`) + Pages Functions(`functions/api/*`) + D1(`ax-biz-radar`)
- **완료**: 대시보드(날짜별), 관리자(/admin, PIN), 지식그래프(홈 레이더 Cytoscape), 탐색(/explore 부분일치), 기업상세(/company), 의견(/feedback + D1 suggestions + 관리자 의견함), Hancom CI, 사이드바(기본 닫힘 드로어)
- **진행 예정(다음 작업)**: **RAG 시맨틱 검색** — 기획 확정, 구현 전.

## RAG 작업 — 확정된 결정 (구현 시 이대로)
- **목표**: `/explore`의 부분일치 → 자연어 질문 RAG(질문→검색→LLM 답변 + 출처 카드 → 기업상세/원문 연결). **키워드 검색은 폴백으로 유지**(RAG/LLM 실패 시).
- **검색 저장소**: Cloudflare **Vectorize**, 인덱스 `ax-biz-radar-idx`, **1024차원 / cosine**.
- **임베딩**: **Workers AI `@cf/baai/bge-m3`** (1024d, 무료 tier, Vectorize 적합). → `[ai]` 바인딩 사용.
- **답변 생성**: **OpenRouter 무료 챗 모델(`:free`)** — `OPENROUTER_MODEL` env로 지정(크레딧 0이라 무료 모델; 무료 tier rate limit 있음). 크레딧 충전 시 env만 바꿔 유료 모델 업그레이드.
- **인용**: 검색 청크에 [1][2] 번호 부여 → LLM이 [n] 인용 → 번호→metadata 매핑(환각 방지).
- **세부**: 유사도 cosine<0.35 컷("정보 없음"), vector id `"<date>#<idx>"`, metadata≤10KiB(snippet=keyPoints[0]만), `?tag=` 태그 목록 보기는 유지(지식그래프·기업상세 딥링크).
- **엔드포인트**: `POST /api/ask`(공개), `POST /api/reindex`(PIN, 백필), `POST /api/reports`에 증분 재인덱싱(기존행 읽기→D1 upsert→old 벡터 delete→new upsert).
- **운영 필수**: 공개 `/api/ask`에 Cloudflare **Rate Limiting**(IP/분 10회), 질문 ≤500자.

## 구현 전 선결(블로커) — 노트북에서 먼저
1. **Cloudflare API 토큰 권한 추가**: `Account · Vectorize · Edit` + `Account · Workers AI · Read`. (현재 토큰엔 없음 — `vectorize create`·임베딩 실패)
2. **`.dev.vars`(로컬 런타임)** 에 추가 — `.env` 아님:
   ```
   ADMIN_PIN=...
   OPENROUTER_API_KEY=...          # 생성용 (임베딩은 Workers AI 바인딩이라 키 불필요)
   OPENROUTER_MODEL=<무료 :free 챗 모델>
   ```
   운영은 Pages 대시보드 env에 동일 설정.
3. (선택) OpenRouter 크레딧 충전 시 유료 생성 모델로 업그레이드.

## RAG 구현 첫 단계 (RAG-1)
1. **임베딩 차원 확인**: Workers AI bge-m3 → 1024 고정(확인됨, 문제없음).
2. `npx wrangler vectorize create ax-biz-radar-idx --dimensions=1024 --metric=cosine`
3. `wrangler.toml`에 `[ai] binding="AI"` + `[[vectorize]] binding="VECTORIZE" index_name="ax-biz-radar-idx"` 추가
4. `functions/_rag.js`(임베딩/청크/upsert/delete 공용) → `POST /api/reindex` 백필 → `POST /api/reports` 증분 → `POST /api/ask` → `/explore` 프론트 → Rate Limiting.

## 노트북에서 환경 복구
```
git clone https://github.com/jykim-code/AXBiz.git
cd AXBiz
npm install
# .env 생성: CLOUDFLARE_API_TOKEN=<Vectorize Edit+Workers AI Read 권한 포함 새 토큰>
# .dev.vars 생성: 위 2번 참고
npm run d1:local     # 로컬 D1 스키마
npm run dev          # http://localhost:8788  (단, RAG는 원격 Vectorize/Workers AI 필요 — 아래 주의)
```
- **주의**: Vectorize/Workers AI는 **로컬 에뮬레이션이 없음** → RAG 검증은 **프리뷰 배포(원격) 중심**. D1·정적·UI는 로컬 가능.

## 🔐 보안 — 즉시 할 것
- 이 세션 대화에 **OpenRouter API 키**와 (이전) **Cloudflare API 토큰**이 평문 노출된 이력이 있음 → **둘 다 재발급(rotate) 권장**. `.env`/`.dev.vars`는 gitignore라 GitHub엔 없음(대화 기록 노출이 사유).
- 새 키는 `.env`(CLOUDFLARE_API_TOKEN)·`.dev.vars`(OPENROUTER_API_KEY)에만, 절대 커밋 금지.
