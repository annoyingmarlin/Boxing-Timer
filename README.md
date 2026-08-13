# Boxing Timer — How It Works

A browser-based interval timer for boxing/HIIT-style workouts, with audio cues, a round tracker, and a workout history table.

## Overview

The page has three main sections:

1. **Timer display** — shows the countdown clock, current round status, and Pause/Reset controls.
2. **Setup form** — where the user enters rounds, round length, and rest length, then starts the timer.
3. **Workout history table** — a placeholder table intended to log past sessions (currently populated by JS, not yet wired to save data).

## Starting a Timer

When the user fills out the form (Rounds, Round Time, Rest Time) and clicks **Start Timer**:

- The form's `submit` event is intercepted (`e.preventDefault()`) so the page doesn't reload.
- The entered values are read and stored (`totalRounds`, `currentRoundTime`, `currentRestTime`).
- State resets: round counter goes to 1, rest flag is cleared, pause flag is cleared.
- The countdown (`totalSeconds`) is set to the round length, the display updates immediately, and the **bell sound plays** to signal the workout has begun.
- A `setInterval` starts, calling `tick()` once per second — this is the engine that drives the whole timer.

## The Tick Loop

Every second, `tick()`:

1. Decrements `totalSeconds` and updates the on-screen clock (`MM:SS` format).
2. Plays a **whistle** as a warning cue:
   - 10 seconds before a round ends (transitioning into rest).
   - 5 seconds before rest ends (transitioning into the next round).
3. When the countdown hits zero, it flips between **round** and **rest** phases:
   - **Round → Rest:** rest period begins, clock resets to the rest duration, bell rings.
   - **Rest → Round:** round counter increments. If it exceeds the total number of rounds, the workout ends (timer stops, display shows "Done!", final bell rings). Otherwise, the next round begins, clock resets to the round duration, bell rings.
4. Updates the round/rest label under the clock (e.g. "Round: 2" or "Rest").

## Pause, Resume, and Reset

- **Pause/Resume button** toggles the running interval without losing progress. Pausing calls `clearInterval` (freezing `totalSeconds` in place); resuming starts a fresh `setInterval` that picks up exactly where it left off. The button label swaps between "Pause" and "Resume" accordingly.
- **Reset button** stops the timer entirely and returns the display to its initial state (`00:00`, "Round: 0", button relabeled "Pause"). It does not clear the form, so the previously entered rounds/time values remain ready for a quick restart.

## Audio

Two sound effects drive the audio cues:

- `sounds/bell.mp3` — plays at the start of the workout, at the start/end of every round, and at the very end.
- `sounds/whistle.mp3` — plays as a 10-second warning before a round ends, and a 5-second warning before rest ends.

Each play uses `cloneNode()` on the `Audio` object before calling `.play()`. This allows the same sound to overlap or replay in quick succession (e.g. if a round is very short) without waiting for the previous playback to finish. Playback failures (e.g. browser autoplay restrictions, missing/corrupt audio files) are caught and logged to the console rather than breaking the app.

## Layout & Navigation

- A simple navbar at the top displays a logo and a login link (not yet functional — placeholder for future account features).
- The workout history section below the timer is currently a static table shell (`#historyBody`) intended to log completed sessions — rows are not yet being inserted, so this is a planned/in-progress feature rather than a working log.

## Known Gaps / Next Steps

- Workout history isn't actually being recorded yet — the table exists in the HTML but nothing writes rows to it.
- The login button is a placeholder with no functionality.
- No persistence (e.g. localStorage) — refreshing the page loses all timer state.
