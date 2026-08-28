/**
 * Playtest bots — fill a room so one person can play a real game.
 *
 * AHA needs 3 players minimum, which makes solo playtesting awkward: separate
 * browser profiles share nothing but are tedious, and the interesting things
 * (the guessing spread, the standings movement, whether 180s feels right) only
 * show up with a roomful.
 *
 * So: you join in your browser first (the first player to join is the host),
 * then run this, and it seats N bots that answer every question and guess at
 * random. You play normally.
 *
 *   node scripts/bots.mjs <ROOM-CODE> [count] [--host localhost:8787]
 *
 * Defaults to 3 bots against the local rooms worker. Ctrl-C to remove them
 * (they send a real `leave`, so the room shrinks the way it would in life).
 *
 * DEV ONLY. Nothing imports this and nothing ships it.
 */

const [, , rawCode, rawCount, ...rest] = process.argv;

if (!rawCode || rawCode.startsWith('-')) {
	console.error(`
  Usage:  node scripts/bots.mjs <ROOM-CODE> [count] [--host host:port]

  Example, a 5-player game with you as one of them:
      1. pnpm --filter @aha/rooms dev      (terminal 1)
      2. pnpm dev:web                      (terminal 2)
      3. open http://localhost:5173, create a room, JOIN IT, note the code
      4. node scripts/bots.mjs ABCD 4      (terminal 3)
      5. press Start in the browser

  Join in the browser BEFORE running this: the first player to join is the
  host, and only the host can change settings or start the game. Run it first
  and a bot takes the chair.
`);
	process.exit(1);
}

const CODE = rawCode.trim().toUpperCase();
const COUNT = Number(rawCount) > 0 ? Number(rawCount) : 3;
const hostFlag = rest.indexOf('--host');
const HOST = hostFlag !== -1 ? rest[hostFlag + 1] : 'localhost:8787';

const NAMES = ['Bo', 'Cyd', 'Dov', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo',
	'Jo', 'Kit', 'Lux', 'Mo', 'Nel', 'Ola', 'Pim'];
const EMOJI = ['🐸', '🐼', '🦉', '🐙', '🦖', '🐝', '🦄', '🐺',
	'🦩', '🐳', '🦁', '🐷', '🐵', '🦔', '🐨'];

/* Answers with actual voice in them, so the guessing is a real test rather
   than five identical strings. Picked at random per bot per question. */
const ANSWERS = [
	'a cold slice of pizza, standing up', 'honestly? no idea', 'my sister would say otherwise',
	'the one with the dog on it', 'nothing. absolutely nothing.', 'about four in the morning',
	'i refuse to answer this', 'the green one obviously', 'i already forgot',
	'ask me again in an hour', 'something i regret buying', 'the last one, always',
	'my neighbour knows why', 'a very long story', 'genuinely cannot remember',
	'it was on sale', 'twice, actually', 'do NOT tell anyone',
	'the usual', 'i blame my brother', 'in my defence it was raining',
	'not proud of it', 'still thinking about it', 'that was one time',
];

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Bots act after a human-ish pause so the counters visibly tick along. */
const humanPause = () => 700 + Math.random() * 1800;

function bot(index) {
	const name = NAMES[index % NAMES.length];
	const emoji = EMOJI[index % EMOJI.length];
	const url = `ws://${HOST}/api/room/${CODE}/ws`;
	const ws = new WebSocket(url);

	let me = null;
	let phase = null;
	/** The answer currently on the stage, so a guess that was queued behind a
	    human-ish pause can check the round has not moved on before sending.
	    Without this the bots spray WRONG_PHASE at the end of every short
	    guess timer — harmless, but noise in a log you are trying to read. */
	let liveAnswerId = null;
	/** Question indexes this bot has already sent, so an upsert storm can't
	    happen when the server rebroadcasts on every other player's action. */
	const answered = new Set();
	let handedIn = false;
	/** answerId this bot has already guessed on. One guess per round, final. */
	let guessedOn = null;

	const send = (msg) => {
		if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
	};

	ws.addEventListener('open', () => {
		send({ v: 1, t: 'join', name, emoji, lang: 'en' });
	});

	ws.addEventListener('message', async (ev) => {
		let msg;
		try {
			msg = JSON.parse(ev.data);
		} catch {
			return;
		}

		if (msg.t === 'welcome') {
			me = msg.playerId;
			console.log(`  ${emoji} ${name} joined`);
			return;
		}
		if (msg.t === 'error') {
			console.error(`  ${emoji} ${name}: ${msg.code}`);
			if (msg.code === 'NAME_TAKEN' || msg.code === 'ROOM_FULL') ws.close();
			return;
		}
		if (msg.t !== 'state') return;

		const room = msg.room;
		liveAnswerId = room.phase === 'GUESSING' ? room.answer.id : null;
		if (room.phase !== phase) {
			phase = room.phase;
			if (index === 0) console.log(`\n— ${phase} —`);
		}

		// ---- answer everything, then hand in --------------------------------
		if (room.phase === 'ANSWERING') {
			for (let q = 0; q < room.questions.length; q++) {
				if (answered.has(q)) continue;
				answered.add(q);
				await sleep(humanPause());
				if (phase !== 'ANSWERING') return; // the clock beat us to it
				send({ v: 1, t: 'submitEntry', questionIndex: q, text: pick(ANSWERS) });
			}
			if (!handedIn && answered.size >= room.questions.length) {
				handedIn = true;
				await sleep(humanPause());
				if (phase !== 'ANSWERING') return;
				send({ v: 1, t: 'handIn' });
				console.log(`  ${emoji} ${name} is done`);
			}
			return;
		}

		// ---- guess, unless this one is ours ---------------------------------
		if (room.phase === 'GUESSING') {
			if (room.youWrote) return;            // the author does not guess
			if (guessedOn === room.answer.id) return;  // one guess, and it is final
			if (room.myGuess !== undefined) {
				guessedOn = room.answer.id;
				return;
			}
			const target = room.answer.id;
			guessedOn = target;
			await sleep(humanPause());
			// The round can resolve while a bot is "thinking" — everyone else
			// guessed, or the clock ran out. Sending anyway is a guaranteed
			// STALE_ANSWER/WRONG_PHASE.
			if (phase !== 'GUESSING' || liveAnswerId !== target) return;
			send({
				v: 1,
				t: 'submitGuess',
				answerId: target,
				playerId: pick(room.candidates),
			});
			return;
		}

		if (room.phase === 'FINALE' && index === 0) {
			const board = room.scoreboard
				.map((s) => {
					const p = room.players.find((x) => x.id === s.playerId);
					return `${p ? p.emoji + ' ' + p.name : s.playerId}: ${s.score}`;
				})
				.join('   ');
			console.log(`\nFinal — ${board}\n`);
		}
	});

	ws.addEventListener('error', (e) => {
		console.error(`  ${emoji} ${name} socket error:`, e.message ?? e);
	});

	return {
		name,
		leave() {
			try {
				send({ v: 1, t: 'leave' });
			} catch {
				/* closing anyway */
			}
			ws.close();
		},
	};
}

console.log(`\nSeating ${COUNT} bot${COUNT === 1 ? '' : 's'} in room ${CODE} via ${HOST}\n`);
const bots = [];
for (let i = 0; i < COUNT; i++) {
	bots.push(bot(i));
	await sleep(250); // stagger the joins so the lobby animates like a real one
}
console.log('\nBots seated. Press Start in your browser. Ctrl-C here to remove them.\n');

let leaving = false;
process.on('SIGINT', () => {
	if (leaving) process.exit(0);
	leaving = true;
	console.log('\nRemoving bots…');
	for (const b of bots) b.leave();
	setTimeout(() => process.exit(0), 400);
});
