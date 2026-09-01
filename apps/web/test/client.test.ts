import { describe, expect, it } from 'vitest';
import { apiUrl, normalizeOrigin, websocketUrl } from '../src/lib/client';

describe('transport URL resolution', () => {
	it('keeps relative API paths for the web facade', () => {
		expect(apiUrl('/api/rooms', '')).toBe('/api/rooms');
	});

	it('uses an explicit native API origin without duplicate slashes', () => {
		expect(apiUrl('/api/rooms', ' https://rooms.example/ ')).toBe(
			'https://rooms.example/api/rooms'
		);
		expect(normalizeOrigin('https://rooms.example///')).toBe('https://rooms.example');
	});

	it('derives web sockets from the page when no override exists', () => {
		expect(websocketUrl('/api/room/AB23/ws', '', { protocol: 'https:', host: 'aha.test' })).toBe(
			'wss://aha.test/api/room/AB23/ws'
		);
		expect(websocketUrl('/api/room/AB23/ws', '', { protocol: 'http:', host: 'localhost:5173' })).toBe(
			'ws://localhost:5173/api/room/AB23/ws'
		);
	});

	it('uses the explicit WSS origin for the native client', () => {
		expect(websocketUrl('/api/room/AB23/ws', 'wss://rooms.example/')).toBe(
			'wss://rooms.example/api/room/AB23/ws'
		);
	});
});
