# iOS universal-link preparation

Prepared 2026-09-02 on the `ios-app` branch. No production domain, Apple
identifier, or signing profile was changed.

## Implemented locally

- The official Capacitor App plugin is the sole added native plugin. Capacitor
  sync discovers it and adds `CapacitorApp` to the generated Swift Package.
- The root Svelte layout handles both `appUrlOpen` (an already-running app) and
  `getLaunchUrl()` (a cold launch).
- Incoming URLs pass through a pure allow-list parser. Only canonical HTTPS URLs
  on `aha.adrez.dev` whose entire path is `/room/<valid AHA code>` are routed.
  Codes are normalized to uppercase; query strings and fragments do not enter the
  in-app route. HTTP, alternate hosts/subdomains, custom ports, malformed URLs,
  invalid codes, and extra path segments are rejected.
- The web and mobile builds already share `/room/<code>`, so the same public link
  remains a normal web fallback when the native app is absent.
- Unit coverage exercises accepted links and the trust-boundary rejection cases.
  The mobile build and Capacitor sync verify that both the JavaScript listener and
  native plugin are packaged.

## Identity- and deployment-gated completion

Complete these steps only after the final bundle identifier is approved:

1. Register the final App ID and enable Apple's Associated Domains capability.
2. Add an app entitlement containing `applinks:aha.adrez.dev`, connect it through
   `CODE_SIGN_ENTITLEMENTS`, and regenerate the AHA provisioning profile. Do not
   reuse Vildsvar's entitlement or profile.
3. Publish `/.well-known/apple-app-site-association` from `aha.adrez.dev` over
   HTTPS with no redirect and the correct JSON content type. Its exact AHA entry
   must use the final `TEAM_ID.BUNDLE_ID` and restrict paths to `/room/*`, for
   example:

   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.BUNDLE_ID",
           "paths": ["/room/*"]
         }
       ]
     }
   }
   ```

4. Treat publishing that file as an explicitly approved production web deployment;
   do not use the provisional identifier or a placeholder document in production.
5. Validate the hosted file and signed entitlement, then test a Messages/Mail link
   on a physical iPhone in all three states: app absent (web fallback), cold app,
   and warm app. Confirm iOS-to-web and web-to-iOS players can join the same room.

References: Capacitor v8 `@capacitor/app` API and Capacitor's Universal/App Links
guide, linked in `IOS_APP_HANDOFF.md`.
