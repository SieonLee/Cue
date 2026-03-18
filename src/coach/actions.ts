export type ActionId =
  | "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8" | "A9"
  | "A10" | "A11" | "A12" | "A13" | "A14" | "A15" | "A16" | "A17" | "A18" | "A19" | "A20";

export const ACTIONS: Record<ActionId, { title: string; description: string; intent: string; tags: string[] }> = {
  A1: {
    title: "Yes/No Check-in",
    description: "Ask if they're available to talk right now (Yes / No)",
    intent: "Checking availability before talking avoids the feeling of rejection. A simple Yes/No keeps the barrier low.",
    tags: ["start", "low-pressure"],
  },
  A2: {
    title: "Suggest a Timeout",
    description: "Propose taking a 10\u201330 minute break before talking again",
    intent: "Pausing isn\u2019t avoidance \u2014 it protects the quality of the conversation when things are escalating.",
    tags: ["escalation", "de-escalate"],
  },
  A3: {
    title: "Text Summary",
    description: "Summarize the key points in two concise sentences",
    intent: "Condensing into two sentences makes the core message clearer and reduces working memory overload.",
    tags: ["clarity", "text-friendly"],
  },
  A4: {
    title: "Offer a Choice",
    description: "Let them choose between talking now or later",
    intent: "Giving choices restores a sense of control. When people feel in control, defensive reactions decrease.",
    tags: ["low-pressure", "autonomy"],
  },
  A5: {
    title: "One Clear Request",
    description: "Reduce it to a single, clear request",
    intent: "Multiple requests overwhelm. One clear request is more likely to lead to action.",
    tags: ["clarity", "request"],
  },
  A6: {
    title: "Repair Script",
    description: "Apology + intention + next step (what you\u2019ll do)",
    intent: "Pairing your intention with a concrete next step gives your partner a reason to expect change.",
    tags: ["repair", "apology"],
  },
  A7: {
    title: "Boundary Restatement",
    description: "Restate a boundary clearly and calmly, without blame",
    intent: "A boundary is information about what you need. Stating it without blame helps them hear it.",
    tags: ["boundary", "self-care"],
  },
  A8: {
    title: "Gratitude Message",
    description: "Express specific appreciation for something they did",
    intent: "Specific gratitude reinforces positive behavior far more than generic thanks.",
    tags: ["positive", "appreciation"],
  },
  A9: {
    title: "Wrap-Up Signal",
    description: "Signal the conversation is wrapping up with a clear next step",
    intent: "Agreeing on one next step and closing reduces lingering tension and anxiety.",
    tags: ["closure", "structure"],
  },
  A10: {
    title: "Feeling Statement",
    description: "Express how you feel using 'I feel ___ when ___' format",
    intent: "Separating your feeling from their action lets your partner hear you without feeling attacked.",
    tags: ["clarity", "self-expression"],
  },
  A11: {
    title: "Mirror Back",
    description: "Repeat back what you heard them say in your own words",
    intent: "Mirroring shows you\u2019re listening and gives them a chance to correct misunderstandings early.",
    tags: ["listening", "de-escalate"],
  },
  A12: {
    title: "Schedule a Talk",
    description: "Set a specific time to discuss this topic later",
    intent: "A specific time reduces anxiety. Vague \u2018we\u2019ll talk later\u2019 creates uncertainty.",
    tags: ["structure", "planning"],
  },
  A13: {
    title: "Energy Check",
    description: "Rate your energy 1\u201310 and share it before talking",
    intent: "Sharing your state prevents misreading your tone. Low energy isn\u2019t disinterest \u2014 it\u2019s information.",
    tags: ["start", "self-awareness"],
  },
  A14: {
    title: "Topic Narrowing",
    description: "Pick ONE specific topic instead of discussing everything at once",
    intent: "When multiple issues pile up, nothing gets resolved. One topic makes it manageable.",
    tags: ["clarity", "structure"],
  },
  A15: {
    title: "Soft Start-Up",
    description: "Begin with something positive before raising a concern",
    intent: "How you start a conversation predicts how it ends. A positive opening reduces defensiveness.",
    tags: ["start", "de-escalate"],
  },
  A16: {
    title: "Physical Reset",
    description: "Suggest changing location or taking a short walk together",
    intent: "Changing your physical environment can break a negative cycle. Movement reduces tension.",
    tags: ["de-escalate", "sensory"],
  },
  A17: {
    title: "Written Note",
    description: "Write down your thoughts and share the note instead of speaking",
    intent: "Writing forces you to organize thoughts. Your partner can read at their own pace.",
    tags: ["text-friendly", "low-pressure"],
  },
  A18: {
    title: "Future Focus",
    description: "Shift from 'what went wrong' to 'what we\u2019ll do next time'",
    intent: "Focusing on the future turns blame into problem-solving.",
    tags: ["repair", "forward"],
  },
  A19: {
    title: "Validation First",
    description: "Acknowledge their perspective before sharing yours",
    intent: "People can\u2019t hear your point until they feel heard. Validation doesn\u2019t mean agreement.",
    tags: ["listening", "de-escalate"],
  },
  A20: {
    title: "Small Win Recall",
    description: "Remind each other of a recent conversation that went well",
    intent: "Recalling a shared success shifts the narrative from \u2018we always fight\u2019 to \u2018we\u2019ve done this before.\u2019",
    tags: ["positive", "repair"],
  },
};

export const ALL_ACTION_IDS = Object.keys(ACTIONS) as ActionId[];
