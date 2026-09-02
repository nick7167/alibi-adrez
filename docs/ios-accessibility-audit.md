# iOS safe-area and accessibility audit

Audited 2026-09-02 on the `ios-app` branch. This document separates evidence that
can be established from code and hosted browsers/simulators from checks that still
need a current physical iPhone.

## Code-side evidence

- The Capacitor web view renders edge-to-edge with `contentInset: 'never'`. Every
  landing, join, lobby, game-phase, support, and rules shell uses the shared dynamic
  viewport and safe-area helpers. The HTML/body canvas uses the same field colour,
  so exposed status-bar and home-indicator regions do not flash a foreign colour.
- `pt-safe` and `pb-safe` take the larger of the design spacing and the relevant
  `env(safe-area-inset-*)` value. Short-viewport browser coverage exercises the
  join, lobby, answering, standings, and solo-reviewer actions at 390x420, the
  representative software-keyboard height.
- The browser suite also covers 390x844 and 1032x1376 layouts. Hosted Xcode 26.6
  launches and captures the native landing screen on both current iPhone and iPad
  simulators, with an automated visible-content guard.
- Join and lobby already move focus to the newly presented input or lobby heading.
  Intro, answering, guessing, reveal, standings, and finale now move focus once to
  the heading that introduces each newly mounted phase. This gives VoiceOver a
  deterministic phase-change announcement without making the countdown a live
  region.
- All animated screen effects have component-level `prefers-reduced-motion`
  fallbacks. The shared stylesheet additionally disables transitions and smooth
  scrolling when Reduce Motion is requested. The complete solo-reviewer browser
  journey runs with reduced motion and asserts the transition override.
- Interactive controls use native buttons, text inputs, and text areas; selection
  controls expose disabled, pressed, expanded, or labelled state where applicable.
  Correct/incorrect and score movement include text or accessible labels rather
  than depending on colour alone.
- The palette's measured contrast ratios are recorded beside the design tokens.
  The lower-contrast pink token is restricted to large status marks, never body
  copy.

## Remaining release checks

These are not complete merely because the code audit and simulators pass:

- Run the full flow on a current physical iPhone and inspect every status-bar,
  notch/Dynamic Island, home-indicator, rotation policy, and software-keyboard
  state.
- Traverse the entire flow with VoiceOver, including rotor order, phase-change
  announcements, safety menus, confirmation dialogs, reconnect errors, and focus
  after navigation.
- Test Larger Text/Dynamic Type at the supported accessibility sizes. A Capacitor
  web view and CSS pixel sizes do not by themselves prove that native text-size
  preferences are honoured without clipping.
- Confirm 44pt targets and spacing with the Accessibility Inspector, then repeat
  Reduce Motion on-device.

These remain Phase E release gates in `IOS_APP_HANDOFF.md`.
