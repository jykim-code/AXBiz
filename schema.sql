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
