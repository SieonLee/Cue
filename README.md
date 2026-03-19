# Cue

On-device couple communication coaching app built with React Native, Expo SDK 54, TypeScript, and SQLite.

Cue helps users prepare for difficult conversations, choose lower-friction communication actions, review outcomes, and personalize future recommendations through an adaptive feedback loop that runs entirely on device.

## Overview

Cue is a local-first mobile app for communication coaching.

It combines:

- local-first product architecture with no backend dependency
- behavioral onboarding and preference capture
- context-aware action recommendation
- Bayesian Thompson Sampling personalization
- A/B comparison against LinUCB
- feedback collection, analytics, and model transparency

## Why This Is Portfolio-Relevant

Cue sits at the intersection of product design and applied machine learning.

From a recruiter perspective, the project shows:

- a clear recommendation problem instead of a generic CRUD app
- local persistence and state management in a real app flow
- contextual ranking with multiple policies instead of a fixed rules engine
- a closed feedback loop where saved outcomes influence future recommendations
- enough product surface area to discuss tradeoffs, instrumentation, and evaluation

The strongest part of the project is the core loop:

`Onboarding -> Coach -> Result -> Feedback -> Review`

That loop is where the recommendation logic, user context, and learning behavior come together.

## Problem Framing

From a data-science perspective, Cue can be framed as a contextual recommendation problem:

- each conversation scenario is a context
- each communication action is a candidate intervention
- the product needs to select an action under uncertainty
- user feedback becomes reward data for future decisions

In other words, the app is trying to answer:

`Given this communication context, which action is most likely to help right now?`

This framing makes the project more than a mobile app. It becomes a small decision system with personalization, uncertainty, and sequential learning.

## Modeling Decisions

The recommendation system was designed around a few practical constraints:

- limited data per user
- no server-side training loop
- need for interpretable behavior
- need to balance exploration and exploitation

These constraints motivated a lightweight contextual bandit approach rather than a heavier supervised learning pipeline.

Main choices:

- Thompson Sampling was used as the main online decision policy because it handles uncertainty naturally and works well in low-data settings.
- Hierarchical smoothing was added so sparse buckets can borrow strength from broader patterns.
- Warm-start priors were added so onboarding preferences influence early recommendations before much feedback exists.
- LinUCB was included as an alternative policy to support algorithm comparison and A/B-style experimentation.
- Implicit signals were kept separate from explicit reward feedback so the learning signal remains interpretable.

## Core User Flow

### 1. Onboarding

Users complete a short behavioral setup around:

- preferred channel
- message length
- question style
- notice preference
- overload response
- tone
- sensory preference

These responses are stored locally and used to shape early recommendations.

### 2. Coaching Session

Users choose a conversation scenario and set quick context such as:

- intent
- stage
- channel
- urgency
- tiredness

The app generates candidate actions, ranks them, and stores the session context for later learning.

### 3. Recommendation Output

The results flow presents:

- ranked action suggestions
- confidence-oriented recommendation stats
- guided scripts
- copy/share interactions
- post-session feedback capture

### 4. Feedback and Review

After a conversation, users can record outcomes and review how the suggestion worked. Feedback updates local model state and influences future recommendations.

This is the part of the product I would emphasize most in a portfolio review. It makes the app feel like an adaptive decision system rather than a static advice tool.

## Recommendation System

### Context-Based Candidate Filtering

The app first narrows actions using a rule-based layer keyed on intent, stage, channel, and low-energy context.

Relevant files:

- `src/coach/actions.ts`
- `src/coach/recommend.ts`

### Thompson Sampling

The main ranking engine includes:

- Beta posterior tracking
- posterior mean scoring
- Bayesian credible intervals
- probability-best estimation
- confidence scoring
- optional reward decay for non-stationary behavior

Relevant files:

- `src/bandit/thompson.ts`
- `src/bandit/features.ts`

### 15-Segment Context Key

The bandit bucket key is built from 15 segments:

```text
profile | intent | stage | channel | urgency | tiredFlag | prefText | prefYesNo | tone | prefChannel | prefMessageLength | prefQuestionStyle | prefOverload | timeOfDay | dayType
```

This lets the app learn from both situation context and user communication preferences.

### Hierarchical Smoothing and Fallback

When a bucket has limited data, the model backs off to broader evidence:

- full bucket key
- legacy key without time segments
- intent-level aggregation
- global action history

This improves cold-start behavior while preserving personalization.

### Warm-Start Personalization

Onboarding preferences are used as informative priors so new users are not treated as a complete cold start.

### A/B Testing Support

Sessions can be assigned to different ranking algorithms, including:

- Thompson Sampling
- LinUCB

## Evaluation Perspective

This project is evaluated more like a product than a single offline benchmark.

### Current verification snapshot

| Area | Current status | Why it matters |
| --- | --- | --- |
| Core recommendation flow | Implemented and manually validated | Confirms the main user path works end-to-end |
| Algorithm assignment | Thompson Sampling and LinUCB both wired into session flow | Shows policy comparison is part of the product design |
| Feedback loop | Explicit feedback is saved and reused for future ranking | Demonstrates sequential learning instead of static advice |
| Logic tests | Candidate filtering, context encoding, and bandit update paths covered | Adds confidence that core ranking logic is stable |
| Type safety | `npx tsc --noEmit` passes | Reduces risk of regressions in app state and navigation |

The most useful checks for this app are:

- recommendation acceptance by action
- average reward by algorithm assignment
- top-ranked action selection rate
- average reward by context bucket
- recent versus all-time reward trends
- uncertainty reduction as more feedback is collected
- usage behavior through copy events, follow-through, and review completion

The app already exposes part of this through local analytics and model history screens. The next logical step would be:

- offline replay evaluation
- simulation-based comparison of ranking policies
- calibration checks for posterior confidence
- longitudinal reward trend monitoring

## Action and Intent System

The app currently supports 20 communication actions, including:

- Yes/No Check-in
- Suggest a Timeout
- Text Summary
- Offer a Choice
- One Clear Request
- Repair Script
- Boundary Restatement
- Validation First
- Future Focus
- Small Win Recall

Current intents include:

- `schedule_change`
- `apology`
- `request`
- `repair`
- `boundary`
- `checkin`
- `positive`
- `logistics`
- `support`
- `recurring`
- `decision`
- `gratitude`

The coaching flow first maps the situation to an intent and then ranks actions within the relevant candidate set.

## Feedback Loop

The learning loop combines explicit and implicit signals.

Explicit signals:

- post-session reward feedback
- review outcomes

Implicit signals:

- copy events
- return events
- daily loop activity
- other behavioral interaction signals

This keeps the recommendation loop grounded in actual user behavior over time.

## Product Features

The current app surface includes:

- home dashboard
- coaching flow
- result and review flow
- daily card and evening check-in
- live coach
- history and replay
- pattern dashboard
- conflict radar
- weekly report
- goals, lessons, and milestones
- bandit stats and model history
- settings, export, and reset tools
- theme-aware and sensory-aware UI behavior

For portfolio purposes, I would treat these as supporting features around the main recommendation flow rather than the headline story. The strongest user journey is still the coaching and feedback loop.

## Tech Stack

- React Native
- Expo SDK 54
- TypeScript
- React Navigation v7
- Expo SQLite
- sql.js for the web preview database layer
- React Context
- React Native Web

## Local-First Data Design

All core product data is stored on device using SQLite.

For the web preview, the app uses `sql.js` so the browser fallback stays close to real SQLite behavior instead of relying on a lightweight mock parser.

Main persisted entities include:

- settings
- coaching sessions
- feedback
- bandit parameters
- outcome reviews
- profile assessment
- daily engagement
- badges
- lesson progress
- implicit signals
- daily loop activity
- A/B assignments
- fingerprint events

Storage and schema files:

- `src/db/db.ts`
- `src/db/schema.ts`
- `src/db/sessions.ts`
- `src/db/signals.ts`
- `src/db/export.ts`

The schema also includes migration support through versioned updates.

## Theme System

The app includes a shared theme system with:

- semantic color tokens
- dark and light mode
- typography, spacing, and radius tokens
- theme context shared across screens

Relevant files:

- `src/theme/tokens.ts`
- `src/theme/ThemeContext.tsx`
- `src/theme/index.ts`

## Project Structure

- `App.tsx` - app bootstrap, DB initialization, providers, and navigation theme wiring
- `src/navigation` - app routes and stack configuration
- `src/screens` - user-facing product flows
- `src/coach` - action definitions and candidate filtering
- `src/bandit` - ranking logic and contextual features
- `src/db` - SQLite schema, persistence, signals, and export logic
- `src/context` - profile and sensory providers
- `src/theme` - tokens and theme context
- `src/components` - reusable UI elements

## Running the App

Install dependencies:

```bash
npm install
```

Start the Expo dev server:

```bash
npm start
```

Run on iOS:

```bash
npm run ios
```

Run on Android:

```bash
npm run android
```

Run on web:

```bash
npm run web
```

Run the logic tests:

```bash
npm test
```

## Screenshots

Representative product screens:

![Onboarding](https://raw.githubusercontent.com/SieonLee/Cue/main/docs/screenshots/01_onboarding.png)
![Home](https://raw.githubusercontent.com/SieonLee/Cue/main/docs/screenshots/02_home.png)
![Coach](https://raw.githubusercontent.com/SieonLee/Cue/main/docs/screenshots/03_coach.png)
![Result](https://raw.githubusercontent.com/SieonLee/Cue/main/docs/screenshots/05_result.png)
![History](https://raw.githubusercontent.com/SieonLee/Cue/main/docs/screenshots/07_history.png)
![Statistics](https://raw.githubusercontent.com/SieonLee/Cue/main/docs/screenshots/09_statistics.png)

Additional screens captured for documentation:

- `docs/screenshots/02_home_more.png`
- `docs/screenshots/02_home_scroll.png`
- `docs/screenshots/03_coach_scroll.png`
- `docs/screenshots/04_coach_detail.png`
- `docs/screenshots/05_result_scroll.png`
- `docs/screenshots/05_settings.png`
- `docs/screenshots/05_settings_scroll.png`
- `docs/screenshots/08_weekly_report.png`
- `docs/screenshots/10_goals.png`
- `docs/screenshots/11_evening_checkin.png`
- `docs/screenshots/12_lessons.png`

## Next Steps

- add offline replay evaluation for saved sessions
- compare Thompson Sampling and LinUCB over longer local usage windows
- add a simple architecture diagram for the recommendation and feedback loop
