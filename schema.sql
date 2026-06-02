-- AX Biz Radar — Cloudflare D1 (SQLite) schema
-- 적용: npx wrangler d1 execute ax-biz-radar --local  --file=./schema.sql
--       npx wrangler d1 execute ax-biz-radar --remote --file=./schema.sql

-- date 가 PRIMARY KEY 이므로 ORDER BY date DESC 는 PK 인덱스 역방향 스캔으로 처리됨.
-- 별도 인덱스 불필요.
CREATE TABLE IF NOT EXISTS reports (
  date       TEXT PRIMARY KEY,                 -- 'YYYY-MM-DD'
  companies  TEXT NOT NULL DEFAULT '[]',       -- JSON 직렬화된 companies 배열
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 조회자 의견(제안) 접수함. 공개 POST 로 적재, 관리자(PIN)가 GET 으로 열람.
CREATE TABLE IF NOT EXISTS suggestions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type       TEXT NOT NULL,                    -- 기업 추가 요청 / 내용 추가·수정 / 오류 제보 / 기타
  company    TEXT,                             -- 관련 기업명(선택)
  content    TEXT NOT NULL,                    -- 의견 내용
  team       TEXT,                             -- 소속 팀(선택)
  name       TEXT,                             -- 작성자 이름(선택)
  status     TEXT NOT NULL DEFAULT 'new'       -- new / handled
);
