import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/* Guards the canvas-color convention every screen depends on.
 *
 * Background (the bug this prevents): a screen paints the html+body canvas with
 * its field color so iOS never exposes a mismatched system zone. That style has
 * to live in <svelte:head>. Injecting it dynamically — {@html} or any {expr}
 * interpolation — makes Svelte 5 hydrate the head as a mismatch, and its head
 * reconciliation then DETACHES the <link rel="stylesheet"> elements Vite emits
 * right after it. The page downloads its CSS and renders completely unstyled.
 * Static <style> text hydrates cleanly, so the rule is: static text only.
 *
 * See apps/web/src/app.css (":where(html, html > body)" default) for why the
 * selector must be `html, html > body` — it has to outrank the bundle default
 * regardless of <head> order.
 */

const ROUTES = new URL("../src/routes", import.meta.url).pathname;

function svelteFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return svelteFiles(path);
		return path.endsWith(".svelte") ? [path] : [];
	});
}

/** Extract the contents of every <svelte:head> block, comments stripped
 *  (the convention is documented in comments that name the banned patterns). */
function headBlocks(source: string): string[] {
	return [...source.matchAll(/<svelte:head>([\s\S]*?)<\/svelte:head>/g)].map((m) =>
		(m[1] ?? "").replace(/<!--[\s\S]*?-->/g, "")
	);
}

/** Extract the contents of every <style> element inside a head block. */
function styleBlocks(head: string): string[] {
	return [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? "");
}

const files = svelteFiles(ROUTES).map((path) => ({
	path: path.slice(ROUTES.length + 1),
	source: readFileSync(path, "utf8")
}));

describe("svelte:head canvas convention", () => {
	it("finds route components to check", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it.each(files)("$path never uses {@html} in <svelte:head>", ({ source }) => {
		for (const head of headBlocks(source)) {
			// {@html} in the head detaches the CSS links during hydration.
			expect(head).not.toContain("{@html");
		}
	});

	it.each(files)("$path keeps <svelte:head> <style> text fully static", ({ source }) => {
		for (const head of headBlocks(source)) {
			for (const style of styleBlocks(head)) {
				// Anything that makes Svelte compile the style dynamically:
				// template tags ({@html}, {#if}, {:else}, {/if}), an interpolated
				// declaration value (`background-color: {color}`), or `${}`.
				expect(style, "svelte template tag inside <style>").not.toMatch(/\{[@#/:]/);
				expect(style, "interpolated declaration value").not.toMatch(/:\s*\{/);
				expect(style, "template literal interpolation").not.toMatch(/\$\{/);
			}
		}
	});

	it.each(files)("$path paints the canvas via `html, html > body`", ({ source }) => {
		for (const head of headBlocks(source)) {
			for (const style of styleBlocks(head)) {
				if (!style.includes("background-color")) continue;
				// Zero-specificity default in app.css must lose to this rule.
				expect(style.replace(/\s+/g, " ")).toMatch(/html,\s*html > body\s*\{/);
			}
		}
	});

	it.each(files)("$path keeps theme-color and canvas hexes in sync", ({ source }) => {
		const heads = headBlocks(source).join("\n");
		if (!heads.includes("background-color")) return;
		const canvasHexes = new Set(
			styleBlocks(heads)
				.flatMap((style) => [...style.matchAll(/#[0-9a-fA-F]{6}/g)])
				.map((m) => m[0].toLowerCase())
		);
		// theme-color is either a literal in the head or a $derived over the
		// same branch; either way its hex set must equal the canvas hex set.
		const themeSource = /theme-color"\s+content="?\{?([A-Za-z]+)/.exec(heads)?.[1];
		const themeHexes = new Set(
			[
				...(themeSource
					? (new RegExp(`${themeSource}\\s*=\\s*\\$derived\\(([\\s\\S]*?)\\);`).exec(source)?.[1] ??
						"")
					: heads
				).matchAll(/#[0-9a-fA-F]{6}/g)
			].map((m) => m[0].toLowerCase())
		);
		expect([...themeHexes].sort()).toEqual([...canvasHexes].sort());
	});
});
