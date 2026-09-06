import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Explicit opt-in: no marketing captures or generated assets in normal E2E runs.
export default defineConfig(base, {
  testMatch: 'store-screenshots.store.ts',
  workers: 1,
  retries: 0,
  timeout: 240_000,
});
