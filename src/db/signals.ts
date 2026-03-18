import { db } from "./db";

export type SignalType = "copy" | "script_edit" | "timer_complete" | "session_return" | "daily_checkin";

export function recordSignal(sessionId: string | null, type: SignalType, value?: string) {
  db.runSync(
    "INSERT INTO implicit_signals(session_id, signal_type, value, created_at) VALUES(?, ?, ?, ?)",
    [sessionId, type, value ?? null, Date.now()]
  );
}

// Small reward bump based on follow-through after the session.
export function implicitRewardBonus(sessionId: string): number {
  type Row = { signal_type: string; value: string | null };
  const signals = db.getAllSync<Row>(
    "SELECT signal_type, value FROM implicit_signals WHERE session_id = ?",
    [sessionId]
  );

  let bonus = 0;

  for (const s of signals) {
    switch (s.signal_type) {
      case "copy":
        bonus += 0.1;
        break;
      case "script_edit":
        bonus += 0.15;
        break;
      case "timer_complete":
        bonus += 0.1;
        break;
      case "session_return":
        if (s.value && parseFloat(s.value) < 24) bonus += 0.05;
        break;
    }
  }

  return Math.min(0.3, bonus);
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDailyLoop(): { goalId: string | null; checkinDone: boolean; hadConversation: boolean; went: string | null } {
  const key = todayKey();
  const row = db.getFirstSync<{ morning_goal_id: string | null; evening_checkin: number; had_conversation: number; conversation_went: string | null }>(
    "SELECT morning_goal_id, evening_checkin, had_conversation, conversation_went FROM daily_loop WHERE date_key = ?",
    [key]
  );
  if (!row) return { goalId: null, checkinDone: false, hadConversation: false, went: null };
  return {
    goalId: row.morning_goal_id,
    checkinDone: row.evening_checkin === 1,
    hadConversation: row.had_conversation === 1,
    went: row.conversation_went,
  };
}

export function setMorningGoal(goalId: string) {
  const key = todayKey();
  db.runSync(
    `INSERT INTO daily_loop(date_key, morning_goal_id, morning_shown_at)
     VALUES(?, ?, ?)
     ON CONFLICT(date_key) DO UPDATE SET morning_goal_id=excluded.morning_goal_id, morning_shown_at=excluded.morning_shown_at`,
    [key, goalId, Date.now()]
  );
}

export function completeEveningCheckin(hadConversation: boolean, went: string | null) {
  const key = todayKey();
  db.runSync(
    `INSERT INTO daily_loop(date_key, evening_checkin, had_conversation, conversation_went, evening_completed_at)
     VALUES(?, 1, ?, ?, ?)
     ON CONFLICT(date_key) DO UPDATE SET evening_checkin=1, had_conversation=excluded.had_conversation, conversation_went=excluded.conversation_went, evening_completed_at=excluded.evening_completed_at`,
    [key, hadConversation ? 1 : 0, went, Date.now()]
  );
}

export function recordFingerprintEvent(
  actionId: string,
  channel: string,
  intent: string,
  reward: number,
) {
  const now = new Date();
  db.runSync(
    "INSERT INTO fingerprint_events(action_id, hour_of_day, day_of_week, channel, intent, reward, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)",
    [actionId, now.getHours(), now.getDay(), channel, intent, reward, Date.now()]
  );
}

export type FingerprintInsight = {
  bestHour: number | null;
  bestChannel: string | null;
  bestAction: string | null;
  avgRewardByHour: Record<number, number>;
  avgRewardByChannel: Record<string, number>;
};

export function getCoupleFingerprint(): FingerprintInsight {
  type HourRow = { hour_of_day: number; avg_r: number; cnt: number };
  const hours = db.getAllSync<HourRow>(
    "SELECT hour_of_day, AVG(reward) as avg_r, COUNT(*) as cnt FROM fingerprint_events GROUP BY hour_of_day HAVING cnt >= 2"
  );

  type ChannelRow = { channel: string; avg_r: number; cnt: number };
  const channels = db.getAllSync<ChannelRow>(
    "SELECT channel, AVG(reward) as avg_r, COUNT(*) as cnt FROM fingerprint_events GROUP BY channel HAVING cnt >= 2"
  );

  type ActionRow = { action_id: string; avg_r: number; cnt: number };
  const actions = db.getAllSync<ActionRow>(
    "SELECT action_id, AVG(reward) as avg_r, COUNT(*) as cnt FROM fingerprint_events GROUP BY action_id HAVING cnt >= 2 ORDER BY avg_r DESC LIMIT 1"
  );

  const avgRewardByHour: Record<number, number> = {};
  let bestHour: number | null = null;
  let bestHourReward = -1;
  for (const h of hours) {
    avgRewardByHour[h.hour_of_day] = h.avg_r;
    if (h.avg_r > bestHourReward) { bestHourReward = h.avg_r; bestHour = h.hour_of_day; }
  }

  const avgRewardByChannel: Record<string, number> = {};
  let bestChannel: string | null = null;
  let bestChannelReward = -1;
  for (const c of channels) {
    avgRewardByChannel[c.channel] = c.avg_r;
    if (c.avg_r > bestChannelReward) { bestChannelReward = c.avg_r; bestChannel = c.channel; }
  }

  return {
    bestHour,
    bestChannel,
    bestAction: actions.length > 0 ? actions[0].action_id : null,
    avgRewardByHour,
    avgRewardByChannel,
  };
}

export type Algorithm = "thompson" | "linucb";

export function assignAlgorithm(sessionId: string): Algorithm {
  const algo: Algorithm = Math.random() < 0.5 ? "thompson" : "linucb";
  db.runSync(
    "INSERT INTO ab_assignments(session_id, algorithm, created_at) VALUES(?, ?, ?)",
    [sessionId, algo, Date.now()]
  );
  return algo;
}

export function getAlgorithmStats(): { thompson: { count: number; avgReward: number }; linucb: { count: number; avgReward: number } } {
  type Row = { algorithm: string; cnt: number; avg_r: number };
  const rows = db.getAllSync<Row>(
    `SELECT a.algorithm, COUNT(*) as cnt, AVG(f.reward) as avg_r
     FROM ab_assignments a
     JOIN feedback f ON f.session_id = a.session_id
     GROUP BY a.algorithm`
  );

  const result = {
    thompson: { count: 0, avgReward: 0 },
    linucb: { count: 0, avgReward: 0 },
  };

  for (const r of rows) {
    if (r.algorithm === "thompson") { result.thompson = { count: r.cnt, avgReward: r.avg_r }; }
    if (r.algorithm === "linucb") { result.linucb = { count: r.cnt, avgReward: r.avg_r }; }
  }

  return result;
}
