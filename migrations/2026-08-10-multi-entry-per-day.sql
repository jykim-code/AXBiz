-- 2026-08-10 — 같은 (기업, 날짜)에 동향을 여러 건 담을 수 있게 한다.
--
-- 배경: 하루에 같은 기업의 별개 동향이 둘 이상 나올 수 있다(예: 2026-08-10 Cloudflare 의
--       'Cloudflare OS 오픈소스 공개' 와 'AI 에이전트 브라우저 카이트서프 공개').
--       기존에는 company_entries 의 PK(company, date) 때문에 두 번째 동향을 저장할 수 없었고,
--       reports 병합도 기업명으로 교체해서 뒤에 배포한 동향이 앞의 것을 덮어썼다.
--
-- 적용: NODE_TLS_REJECT_UNAUTHORIZED=0 npx wrangler d1 execute ax-biz-radar --remote -y \
--         --file=./migrations/2026-08-10-multi-entry-per-day.sql
--       (코드 배포보다 먼저 적용할 것 — 새 코드는 seq 컬럼에 INSERT 한다.)
--
-- 되돌리기: company_entries 는 reports 에서 파생되는 테이블이므로 재생성 가능하다.
--           reports·draft_entries 는 이 마이그레이션에서 건드리지 않는다(인덱스만 교체).

-- 1) company_entries: PK 에 seq 추가. SQLite 는 PK 변경이 불가해 테이블을 다시 만든다.
CREATE TABLE IF NOT EXISTS company_entries_new (
  company  TEXT NOT NULL,
  date     TEXT NOT NULL,
  seq      INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  data     TEXT NOT NULL,
  PRIMARY KEY (company, date, seq)
);

-- 기존 행은 모두 seq=0 (그 시점엔 (기업,날짜)당 1건이었음).
INSERT INTO company_entries_new (company, date, seq, category, data)
  SELECT company, date, 0, category, data FROM company_entries;

DROP TABLE company_entries;
ALTER TABLE company_entries_new RENAME TO company_entries;
CREATE INDEX IF NOT EXISTS idx_company_entries_company_date ON company_entries(company, date DESC);

-- 2) draft_entries: 같은 (날짜, 기업)에 동향 여러 건이 draft 로 공존할 수 있게
--    source_ref(동향 신원: 수동입력=출처 URL, 가져오기=컨플 pageId)까지 키에 포함.
DROP INDEX IF EXISTS uq_draft_dcs;
CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_dcsr ON draft_entries(date, company, source, source_ref) WHERE status='draft';
