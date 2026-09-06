# Join navigation regression evidence

Captured 2026-09-06 from the real local room-creation flow after commit `695bfe6`.
The frontend-design pass preserves the existing identity and places navigation
in a separate non-scrolling row above the form.

- `da-iphone.png`: 390 × 844 CSS pixels.
- `da-iphone-keyboard-height.png`: 390 × 420 CSS pixels, focused nickname input.

Both captures emulate 59px top safe-area padding. These are browser captures,
not physical-device or native keyboard screenshots. At reduced height the form
scrolls to the input and clips optional context; navigation and submit stay visible.
The test also scrolls through the avatar picker and taps Back to verify it is
not covered. Eight cases cover Danish and English at four viewport sizes.

Reproduce with `apps/web/e2e/join-layout.spec.ts`. Full outputs are written to
`apps/web/test-results/`, which later test runs may replace. This folder retains
the two Danish phone captures for the physical-device follow-up.
