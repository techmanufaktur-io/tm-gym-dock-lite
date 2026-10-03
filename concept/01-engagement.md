# Phase 2 — Engagement & Retention

> Keep users coming back. Make the gym habit visible.

## Features

### 2.1 Streak Counter
- Show current streak (consecutive days/weeks with check-ins)
- Display on check-in screen: "5 sessions this week" / "3-week streak"
- Small flame/bolt icon next to streak count
- **Effort:** ~30 lines JS, no backend changes

### 2.2 Weekly Goal
- User sets a weekly session goal in settings (e.g., 3x per week)
- Progress ring or bar on check-in screen: "2/3 this week"
- Stored in localStorage, no backend needed
- **Effort:** ~50 lines JS + CSS

### 2.3 Personal Bests
- Longest session, most sessions in a week, longest streak
- Shown in history stats section
- Calculated from existing history data
- **Effort:** ~40 lines JS

### 2.4 Workout Notes (optional)
- After checkout: optional one-line note ("Leg day", "Cardio 5K")
- Shown in history below each entry
- Stored locally, optionally sent to backend
- **Effort:** ~40 lines JS/HTML

### 2.5 Motivational Check-in Milestones
- Toast on milestone check-ins: 10th, 25th, 50th, 100th session
- "You've hit 50 sessions!" with accent styling
- **Effort:** ~15 lines JS

## Priority

| Feature | Impact | Effort | Recommendation |
|---------|--------|--------|----------------|
| Streak Counter | High | Low | Do first |
| Weekly Goal | High | Low | Do second |
| Milestones | Medium | Tiny | Do with streak |
| Personal Bests | Medium | Low | Do with stats |
| Workout Notes | Low | Low | Nice-to-have |

## No Backend Changes Required

All Phase 2 features work with localStorage only.
