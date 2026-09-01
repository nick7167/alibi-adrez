// The Cloudflare build keeps SSR. The Capacitor build is a bundled SPA with
// an index fallback, so room links remain client-routable inside the app.
export const ssr = import.meta.env.VITE_APP_PLATFORM !== 'ios';
export const prerender = false;
