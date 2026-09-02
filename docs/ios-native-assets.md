# Native iOS icon and launch assets

Prepared 2026-09-02 on the `ios-app` branch. These assets replace Capacitor's blue
placeholder artwork without deciding the final public App Store/display name.

## Sources and output

- `apps/mobile/assets/aha-app-icon.svg` is the deterministic 1024x1024 source for
  the app icon: the established AHA yellow mark and mint reveal diamond on the
  product's purple field. The square source deliberately has no rounded corners;
  iOS applies its own icon mask.
- `apps/mobile/assets/aha-launch.svg` is a 2732x2732, crop-safe source for the
  native launch screen. Its centered mark survives `scaleAspectFill` in portrait,
  landscape, iPhone, and iPad frames, while the field colour matches the initial
  web canvas to avoid a white transition flash.
- The referenced PNGs live in the existing AppIcon and Splash image sets. They are
  RGB, have no alpha channel, and measure exactly 1024x1024 or 2732x2732. The icon
  was visually checked at both source size and 60x60.
- The unreferenced Capacitor placeholder PNGs were removed from the image sets and
  remain recoverable from Git history.

The SVGs are intentionally simple vector geometry rather than generated artwork:
this preserves exact design tokens, produces clean small-size edges, and avoids
unreliable rendered text.

## Icon audit

Checked 2026-09-02 against the current official App Store artwork for Undercover,
Psych!, and AhaGuess. Those adjacent party/guessing apps rely on detailed character
illustration, faces, question marks, or embedded lettering. AHA's flat yellow mark
and mint diamond therefore retain a recognisable silhouette and a materially simpler
thumbnail without imitating their category conventions.

- Clarity at 60x60: 9/10
- Light/dark-background contrast: 9/10
- Simplicity: 10/10 (two elements, no rendered text)
- Existing-product brand alignment: 10/10
- Current category differentiation: 9/10

This is a visual implementation audit, not approval of the public name or final App
Store positioning. Repeat the comparison when the title, subtitle, screenshots, and
primary category are final; those elements can change the competitive context.

## Remaining release checks

- Hosted Xcode must pass the explicit dimensions/alpha guard and compile the asset
  catalogs for both generic iOS and the simulator.
- Capture and inspect the transient launch screen on a physical device; the hosted
  smoke workflow captures the settled landing UI after launch, not the brief splash.
- Inspect the installed icon on an actual iPhone against light/dark wallpapers and
  Apple's final mask. Confirm there are no alpha-channel upload warnings.
- Replace the provisional native display name only after the public-name gate. A
  later name choice can keep or deliberately revise this symbol; it must not
  silently inherit AHA wording by accident.
