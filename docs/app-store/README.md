# Hvem mon? — App Store promotional screenshots

Six original posters for each language (Danish and English) and device family:
24 final RGB PNGs, without alpha. Upload in numerical order from `final/`.

- iPhone: 1320 × 2868, `final/{da,en}/iphone/01.png` through `06.png`.
- iPad: 2064 × 2752, `final/{da,en}/ipad/01.png` through `06.png`.
- Preview: `gallery.html`, `overview-da.png` and `overview-en.png`.

The sequence explains author guessing, actively typing an answer, the reveal,
cross-platform rooms, question themes, and the finale. Six purposeful images were chosen over
filling all ten available slots with repeated features or invented social proof.
The first three explain the actual game loop. The revised campaign keeps one
deep-purple background, bright-purple gameplay panels, yellow headlines/accents
and cream supporting copy throughout. No Vildsvar artwork or content was copied.

## Provenance

All UI comes from the real Svelte app running against a local Rooms backend.
Five fictional players join and play through normal controls. The game chooses
the question and author. The capture test checks the revealed author, answer,
and total score. `scenario-da.json` and `scenario-en.json` preserve that evidence.
Names and answers are fictional demonstration content entered through the UI;
text, votes and scores are not replaced in the DOM or edited after capture.

Both device families use enlarged, rearranged crops of actual controls for
readability; complete source captures remain in `raw/`. Writing is captured with
the text field focused, a real caret and the final two characters not yet typed.
The player finishes the answer before submission and the subsequent reveal.
Room-code detail crops exclude the separate leave control, not game content.
These are promotional compositions, not unaltered
native device screenshots. Compare them with the signed release candidate before
upload. They have not been uploaded, submitted to review or approved by Apple.

## Reproduce

From the repository root, after installing workspace dependencies:

```sh
pnpm --filter web exec playwright test --config playwright.store.config.ts
```

To change poster styling without replaying the game:

```sh
STORE_RENDER_ONLY=1 pnpm --filter web exec playwright test --config playwright.store.config.ts
```

Refresh both overview images and validate all final PNG dimensions/colour types:

```sh
node docs/app-store/render-gallery.mjs
```

The explicit store configuration isolates these tests from normal E2E tests.
The renderer waits for fonts and images and checks headline width and clearance.
Game capture uses normal motion and asserts lobby confetti has reached zero
opacity before any capture. Reduced motion disabled its animation and left it
visible in the first draft; that draft must not be uploaded.
`artwork.html` is the editable HTML/CSS composition. Fonts resolve from the app's
installed font packages. Source captures are generated at 3×; final posters are
rendered at 3× for phone and 2× for iPad.

Apple's accepted sizes were checked against the official
[screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).
Metadata and ASO evidence are in `../ios-store-metadata.json` and
`../ios-aso-audit.md`. Final name clearance, replacement of legacy A-shaped native
icon/splash assets, and signed-device validation remain separate release gates.
