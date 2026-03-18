export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  context_json TEXT NOT NULL,
  candidates_json TEXT NOT NULL,
  ranked_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  session_id TEXT PRIMARY KEY,
  chosen_action TEXT NOT NULL,
  reward REAL NOT NULL,
  created_at INTEGER NOT NULL,
  context_json TEXT
);

CREATE TABLE IF NOT EXISTS bandit_params (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS async_sessions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  profile_a_answer TEXT,
  profile_b_answer TEXT,
  a_prediction TEXT,
  b_prediction TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  profile TEXT NOT NULL DEFAULT 'shared'
);

CREATE TABLE IF NOT EXISTS outcome_reviews (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  chosen_action TEXT NOT NULL,
  partner_reaction TEXT NOT NULL,
  emotion_before INTEGER NOT NULL,
  emotion_after INTEGER NOT NULL,
  what_worked TEXT,
  what_to_change TEXT,
  would_use_again INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_assessment (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_engagement (
  date_key TEXT PRIMARY KEY,
  sessions INTEGER NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  cards INTEGER NOT NULL DEFAULT 0,
  goals_completed INTEGER NOT NULL DEFAULT 0,
  checkins INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS badges (
  badge_id TEXT PRIMARY KEY,
  earned_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson_id TEXT PRIMARY KEY,
  completed INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);

-- Implicit feedback: track behavioral signals
CREATE TABLE IF NOT EXISTS implicit_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  signal_type TEXT NOT NULL,
  value TEXT,
  created_at INTEGER NOT NULL
);

-- Daily loop: morning micro-goal + evening check-in
CREATE TABLE IF NOT EXISTS daily_loop (
  date_key TEXT PRIMARY KEY,
  morning_goal_id TEXT,
  morning_shown_at INTEGER,
  evening_checkin INTEGER DEFAULT 0,
  had_conversation INTEGER DEFAULT 0,
  conversation_went TEXT,
  evening_completed_at INTEGER
);

-- A/B test: track which algorithm is assigned per session
CREATE TABLE IF NOT EXISTS ab_assignments (
  session_id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Couple fingerprint: time/channel/context success patterns
CREATE TABLE IF NOT EXISTS fingerprint_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id TEXT NOT NULL,
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  channel TEXT NOT NULL,
  intent TEXT NOT NULL,
  reward REAL NOT NULL,
  created_at INTEGER NOT NULL
);
`;

// ── V2 Migration ──────────────────────────────────────────────────────────

export const MIGRATIONS = [
  {
    version: 2,
    sql: `ALTER TABLE feedback ADD COLUMN context_json TEXT;`,
  },
];
