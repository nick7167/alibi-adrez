import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.test.js', 'test/**/*.test.ts', 'test/**/*.test.js'],
		passWithNoTests: true
	}
});
