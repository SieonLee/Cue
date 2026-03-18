export type Intent = "schedule_change" | "apology" | "request" | "repair" | "boundary" | "checkin" | "positive" | "logistics" | "support" | "recurring" | "decision" | "gratitude";
export type Stage = "start" | "escalation" | "repair";
export type Channel = "text" | "call" | "in_person";
export type Tone = "casual" | "formal";

export type CoachContext = {
  intent: Intent;
  stage: Stage;
  channel: Channel;
  urgency: 0 | 1;
  tiredFlag: 0 | 1;
  prefText: 0 | 1;     // from user settings
  prefYesNo: 0 | 1;    // from user settings
  noticeHours: number; // from user settings
  tone: Tone;          // from user settings
};
