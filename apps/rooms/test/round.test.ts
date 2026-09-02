import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { expireIdle, expirePhase, stubFor, until } from "./helpers";

/**
 * What only the Durable Object can prove.
 *
 * The engine (T3) and the projections (T4) are covered exhaustively as pure
 * functions in `packages/shared`. Nothing here re-tests them. These tests
 * exist for the four things that live in the wiring and nowhere else:
 *
 *  1. the alarm **re-arming** across the inner `GUESSING -> REVEAL -> GUESSING`
 *     loop — if it ever fails to, the room hangs forever and no unit test can
 *     see it, because a pure `advance()` needs no timer to be running;
 *  2. the three game messages actually travelling over a socket and coming
 *     back in a broadcast;
 *  3. the connected-player set, which the engine cannot compute and the DO
 *     must supply ("a locked phone is not a leave");
 *  4. state surviving an eviction, since the DO caches the room in memory.
 *
 * Time: `runDurableObjectAlarm` fires immediately and workerd's clock cannot
 * be faked, so `expirePhase()` backdates the stored deadline instead and lets
 * the handler make its real decision from the real clock. It returns whether
 * an alarm was actually scheduled — which is exactly the re-arm assertion.
 */

type Frame = Record<string, any>;

interface Client {
  ws: WebSocket;
  inbox: Frame[];
  id: string;
  token: string;
  name: string;
}

async function openSocket(code: string): Promise<{ ws: WebSocket; inbox: Frame[] }> {
  const res = await stubFor(code).fetch("https://do/ws", { headers: { Upgrade: "websocket" } });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  const inbox: Frame[] = [];
  ws.addEventListener("message", (e) => {
    inbox.push(JSON.parse((e as MessageEvent).data as string) as Frame);
  });
  return { ws, inbox };
}

async function join(code: string, name: string): Promise<Client> {
  const { ws, inbox } = await openSocket(code);
  ws.send(JSON.stringify({ v: 1, t: "join", name, emoji: "🦊" }));
  await until(() => inbox.some((m) => m.t === "welcome"), `${name} to be welcomed`);
  const welcome = inbox.find((m) => m.t === "welcome")!;
  return { ws, inbox, id: welcome.playerId as string, token: welcome.token as string, name };
}

/** The room as this client last saw it. */
function view(c: Client): Frame | undefined {
  for (let i = c.inbox.length - 1; i >= 0; i--) if (c.inbox[i]!.t === "state") return c.inbox[i]!.room;
  return undefined;
}

function phase(c: Client): string | undefined {
  return view(c)?.phase as string | undefined;
}

function send(c: Client, msg: unknown): void {
  c.ws.send(JSON.stringify(msg));
}

async function untilPhase(c: Client, want: string, timeoutMs = 3000): Promise<void> {
  await until(() => phase(c) === want, `${c.name} to see ${want} (saw ${phase(c)})`, timeoutMs);
}

/** Seats `names` and returns them; the first is the host. */
async function seat(code: string, names: string[]): Promise<Client[]> {
  const clients: Client[] = [];
  for (const name of names) clients.push(await join(code, name));
  await until(
    () => (view(clients[0]!)?.players as Frame[] | undefined)?.length === names.length,
    "everyone to be seated",
  );
  return clients;
}

/**
 * One alarm-driven transition: expire the phase, insist the alarm was actually
 * armed (a `false` here is a hung room), and wait for the room to hand over.
 */
async function stepAlarm(code: string, c: Client): Promise<void> {
  const from = phase(c);
  expect(await expirePhase(code), `${from} must have re-armed the alarm`).toBe(true);
  await until(() => phase(c) !== from, `${from} to hand over (still ${phase(c)})`);
}

/**
 * Waits for the room to be genuinely abandoned: every socket gone *and* the
 * idle clock written, with the clock stable across a beat.
 *
 * Both halves matter. Closes are processed one at a time, so an early handler
 * can see zero sockets left and arm `destroyAt` while a later one is still in
 * flight — and that later handler re-arms it ten minutes into the future,
 * right on top of the backdate the test just made. Waiting for the value to
 * stop moving is synchronisation, not a weakened assertion: the alarm's real
 * decision is still made from the real clock.
 */
async function untilIdleArmed(code: string): Promise<number> {
  for (let i = 0; i < 300; i++) {
    const seen = await runInDurableObject(stubFor(code), async (_i, state) => ({
      sockets: state.getWebSockets().length,
      at: await state.storage.get<number>("destroyAt"),
    }));
    if (seen.sockets === 0 && seen.at !== undefined) {
      await new Promise((r) => setTimeout(r, 100));
      const again = await runInDurableObject(stubFor(code), (_i, state) =>
        state.storage.get<number>("destroyAt"));
      if (again === seen.at) return seen.at;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  return expect.fail("the room never became idle with no sockets attached");
}

/** Reads the persisted room, i.e. what a restarted instance would load. */
async function stored(code: string): Promise<Frame> {
  return await runInDurableObject(stubFor(code), async (_i, state) => {
    return (await state.storage.get<Frame>("state"))!;
  });
}

describe("the game loop in the Durable Object", () => {
  it("plays a whole game on expiring alarms alone, re-arming through every phase", async () => {
    const code = "RDA";
    const clients = await seat(code, ["A", "B", "C", "D"]);
    const [host, b, c, d] = clients as [Client, Client, Client, Client];
    send(host, { v: 1, t: "updateSettings", patch: { questions: 2, rounds: 3, standingsEvery: 0 } });
    await until(() => view(host)?.settings?.rounds === 3, "the settings to land");

    send(host, { v: 1, t: "startGame" });
    await untilPhase(host, "INTRO");

    expect(await expirePhase(code), "INTRO must have re-armed the alarm").toBe(true);
    await untilPhase(host, "ANSWERING");

    // The *only* client input in this test: three of the four players answer
    // both questions. Entries cannot be conjured server-side, and nobody hands
    // in — so from here every transition is an alarm and nothing else.
    for (const writer of [host, b, c]) {
      for (let q = 0; q < 2; q++) {
        send(writer, { v: 1, t: "submitEntry", questionIndex: q, text: `${writer.name} on q${q}` });
      }
    }
    await until(
      () => [host, b, c].every((w) => Object.keys(view(w)?.myAnswers ?? {}).length === 2),
      "all six answers to land",
    );
    expect(phase(host), "nobody handed in, so the clock still owns this phase").toBe("ANSWERING");

    expect(await expirePhase(code), "ANSWERING must have re-armed the alarm").toBe(true);
    await untilPhase(host, "GUESSING");
    expect(view(host)!.roundCount).toBe(3);

    // The loop, driven entirely by the alarm. Nobody guesses; nobody taps.
    const asked: string[] = [];
    const questions: string[] = [];
    for (let round = 1; round <= 3; round++) {
      expect(phase(host), `round ${round} should be GUESSING`).toBe("GUESSING");
      expect(view(host)!.round).toBe(round);
      expect(view(host)!.deadline, "a live phase must carry a deadline").not.toBeNull();
      asked.push(view(host)!.answer.id as string);
      questions.push(view(host)!.prompt as string);

      expect(await expirePhase(code), `GUESSING ${round} must have re-armed`).toBe(true);
      await untilPhase(host, "REVEAL");
      expect(view(host)!.authorId).toBeTypeOf("string");

      expect(await expirePhase(code), `REVEAL ${round} must have re-armed`).toBe(true);
      await until(
        () => phase(host) === (round === 3 ? "FINALE" : "GUESSING"),
        `round ${round} to hand over`,
      );
    }
    expect(new Set(asked).size, "each round asks about a different answer").toBe(3);
    // The rule the whole mixed pool exists for.
    for (let i = 1; i < questions.length; i++) {
      expect(questions[i], "the same question must not run twice in a row")
        .not.toBe(questions[i - 1]);
    }

    expect(phase(host)).toBe("FINALE");
    expect(view(host)!.deadline).toBeUndefined(); // FINALE view is untimed
    for (const client of [host, b, c, d]) client.ws.close();
  });

  it("round-trips submitEntry, handIn and submitGuess over a real socket", async () => {
    const code = "RDB";
    const [host, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
    send(host, { v: 1, t: "updateSettings", patch: { questions: 2, standingsEvery: 0 } });
    await until(() => view(host)?.settings?.questions === 2, "the question count to land");
    send(host, { v: 1, t: "startGame" });
    await untilPhase(host, "INTRO");
    await expirePhase(code);
    await untilPhase(host, "ANSWERING");
    expect((view(host)!.questions as string[])).toHaveLength(2);

    send(host, { v: 1, t: "submitEntry", questionIndex: 0, text: "a socket-borne answer" });
    await until(
      () => view(host)?.myAnswers?.["0"] === "a socket-borne answer", "submitEntry to come back");
    // Upsert, not append: the second submission replaces the first.
    send(host, { v: 1, t: "submitEntry", questionIndex: 0, text: "edited before the deadline" });
    await until(
      () => view(host)?.myAnswers?.["0"] === "edited before the deadline", "the edit to come back");

    // Everyone answers both questions and hands in; the last hand-in resolves
    // the phase with no alarm involved.
    for (const w of [host, b, c]) {
      for (let q = 0; q < 2; q++) {
        send(w, { v: 1, t: "submitEntry", questionIndex: q, text: `${w.name} q${q}` });
      }
    }
    await until(
      () => [host, b, c].every((w) => Object.keys(view(w)?.myAnswers ?? {}).length === 2),
      "every answer to land",
    );
    send(host, { v: 1, t: "handIn" });
    await until(() => view(host)?.handedIn === true, "the hand-in to come back");
    await until(() => (view(b)?.doneCount ?? 0) === 1, "the room to see one player done");
    for (const w of [b, c]) send(w, { v: 1, t: "handIn" });
    await untilPhase(host, "GUESSING");

    const guesser = [host, b, c].find((client) => view(client)!.youWrote === undefined)!;
    const answerId = view(guesser)!.answer.id as string;
    const target = (view(guesser)!.candidates as string[])[0]!;

    send(guesser, { v: 1, t: "submitGuess", answerId: "not-the-live-answer", playerId: target });
    await until(
      () => guesser.inbox.some((m) => m.t === "error" && m.code === "STALE_ANSWER"),
      "a stale answerId to be rejected",
    );

    send(guesser, { v: 1, t: "submitGuess", answerId, playerId: target });
    await until(() => view(guesser)?.myGuess === target, "submitGuess to come back");
    // And it is visible to the room, as a count that names nobody.
    const other = [host, b, c].find((client) => client !== guesser)!;
    await until(() => (view(other)?.guessedCount ?? 0) >= 1, "the room to see the guess counted");
    for (const client of [host, b, c]) client.ws.close();
  });

  it("plays the complete solo practice game through the real socket", async () => {
    const code = "RDP";
    const host = await join(code, "Reviewer");

    send(host, { v: 1, t: "startPractice" });
    await untilPhase(host, "INTRO", 10_000);
    expect(view(host)?.players).toHaveLength(3);
    expect((view(host)?.players as Frame[]).filter((player) => player.isBot === true)).toHaveLength(2);

    const seeded = await stored(code);
    const bots = (seeded.players as Frame[]).filter((player) => player.isBot === true);
    expect(bots).toHaveLength(2);
    for (const bot of bots) {
      expect(Object.keys(seeded.entries[bot.id] as Frame)).toHaveLength(3);
      expect(seeded.handedIn[bot.id]).toBe(true);
      expect(seeded.sessions[bot.id]).toBeUndefined();
    }

    expect(await expirePhase(code), "practice INTRO must have armed its alarm").toBe(true);
    await untilPhase(host, "ANSWERING", 10_000);
    expect(view(host)?.questions).toHaveLength(3);
    for (let questionIndex = 0; questionIndex < 3; questionIndex++) {
      send(host, {
        v: 1,
        t: "submitEntry",
        questionIndex,
        text: `reviewer answer ${questionIndex}`,
      });
    }
    await until(
      () => Object.keys(view(host)?.myAnswers ?? {}).length === 3,
      "all reviewer answers to land",
    );
    send(host, { v: 1, t: "handIn" });
    await until(
      () => phase(host) === "GUESSING" || phase(host) === "REVEAL",
      "practice guessing to begin",
      10_000,
    );

    let revealCount = 0;
    for (let guard = 0; guard < 20 && phase(host) !== "FINALE"; guard++) {
      if (phase(host) === "GUESSING") {
        const guessing = view(host)!;
        expect(guessing.youWrote).toBeUndefined();
        expect(guessing.candidates).toHaveLength(2);
        send(host, {
          v: 1,
          t: "submitGuess",
          answerId: guessing.answer.id,
          playerId: guessing.candidates[0],
        });
        await untilPhase(host, "REVEAL", 10_000);
      }
      if (phase(host) === "REVEAL") {
        revealCount++;
        expect(view(host)?.awarded).toHaveLength(3);
        expect(await expirePhase(code), "practice REVEAL must have armed its alarm").toBe(true);
        await until(() => phase(host) !== "REVEAL", "practice reveal to hand over", 10_000);
      }
      if (phase(host) === "STANDINGS") {
        expect(await expirePhase(code), "practice STANDINGS must have armed its alarm").toBe(true);
        await until(() => phase(host) !== "STANDINGS", "practice standings to hand over", 10_000);
      }
    }

    expect(phase(host)).toBe("FINALE");
    expect(revealCount).toBe(3);
    expect((view(host)?.scoreboard as Frame[]).reduce((sum, line) => sum + line.score, 0)).toBeGreaterThan(0);
    host.ws.close();
  }, 15_000);

  it("shows the standings beat on the cadence the host set", async () => {
    const code = "RDI";
    const [a, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
    send(a, { v: 1, t: "updateSettings", patch: { questions: 2, rounds: 4, standingsEvery: 2 } });
    await until(() => view(a)?.settings?.standingsEvery === 2, "the cadence to land");
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    await expirePhase(code);
    await untilPhase(a, "ANSWERING");
    for (const w of [a, b, c]) {
      for (let q = 0; q < 2; q++) send(w, { v: 1, t: "submitEntry", questionIndex: q, text: `${w.name}${q}` });
    }
    await until(
      () => [a, b, c].every((w) => Object.keys(view(w)?.myAnswers ?? {}).length === 2),
      "the answers to land",
    );
    for (const w of [a, b, c]) send(w, { v: 1, t: "handIn" });
    await untilPhase(a, "GUESSING");

    // Rounds 1 and 2, then the beat.
    for (let round = 1; round <= 2; round++) {
      expect(await expirePhase(code)).toBe(true);
      await untilPhase(a, "REVEAL");
      expect(await expirePhase(code)).toBe(true);
      await until(() => phase(a) !== "REVEAL", "the reveal to hand over");
    }
    expect(phase(a), "a standings beat is due after round 2").toBe("STANDINGS");
    const lines = view(a)!.lines as Frame[];
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.rank).toBeTypeOf("number");
      expect(line.delta).toBeTypeOf("number");
    }
    // It carries scores and nothing about any answer.
    expect(JSON.stringify(view(a))).not.toContain("authorId");

    expect(await expirePhase(code), "STANDINGS must have re-armed").toBe(true);
    await untilPhase(a, "GUESSING");
    for (const client of [a, b, c]) client.ws.close();
  });

  describe("a locked phone is not a leave", () => {
    it("resolves early once the connected players hand in, and still stages the absent one",
      async () => {
        const code = "RDC";
        const [a, b, c, d] = await seat(code, ["A", "B", "C", "D"]) as
          [Client, Client, Client, Client];
        send(a, { v: 1, t: "updateSettings", patch: { questions: 1, rounds: 4, standingsEvery: 0 } });
        await until(() => view(a)?.settings?.questions === 1, "the settings to land");
        send(a, { v: 1, t: "startGame" });
        await untilPhase(a, "INTRO");
        await expirePhase(code);
        await untilPhase(a, "ANSWERING");

        // D answers and hands in, then their phone locks. They are not gone.
        send(d, { v: 1, t: "submitEntry", questionIndex: 0, text: "written before the screen went dark" });
        await until(() => view(d)?.myAnswers?.["0"] !== undefined, "D's answer to land");
        send(d, { v: 1, t: "handIn" });
        await until(() => view(d)?.handedIn === true, "D's hand-in to land");
        d.ws.close();
        await until(() => (view(a)?.players as Frame[]).length === 4, "D to still be in the room");

        // The remaining three answer and hand in. No alarm is fired anywhere in
        // this test: if the room were still waiting on D it would sit here for
        // the whole answering clock and this would time out.
        for (const w of [a, b, c]) {
          send(w, { v: 1, t: "submitEntry", questionIndex: 0, text: `by ${w.name}` });
        }
        await until(
          () => [a, b, c].every((w) => view(w)?.myAnswers?.["0"] !== undefined),
          "the three answers to land",
        );
        for (const w of [a, b, c]) send(w, { v: 1, t: "handIn" });
        await untilPhase(a, "GUESSING");

        // D is disconnected, not absent: they are on everybody's candidate list
        // and their answer is in the pool that the four rounds draw from.
        expect(view(a)!.candidates as string[]).toContain(d.id);
        expect(view(a)!.roundCount).toBe(4);
        for (const client of [a, b, c]) client.ws.close();
      });

    it("resolves the phase when the last player we were waiting on drops", async () => {
      const code = "RDD";
      const [a, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
      send(a, { v: 1, t: "updateSettings", patch: { questions: 1, standingsEvery: 0 } });
      await until(() => view(a)?.settings?.questions === 1, "the settings to land");
      send(a, { v: 1, t: "startGame" });
      await untilPhase(a, "INTRO");
      await expirePhase(code);
      await untilPhase(a, "ANSWERING");

      for (const w of [a, b, c]) send(w, { v: 1, t: "submitEntry", questionIndex: 0, text: `by ${w.name}` });
      await until(
        () => [a, b, c].every((w) => view(w)?.myAnswers?.["0"] !== undefined), "the answers to land");
      for (const w of [a, b]) send(w, { v: 1, t: "handIn" });
      await until(() => (view(a)?.doneCount ?? 0) === 2, "two hand-ins to register");
      expect(phase(a)).toBe("ANSWERING");

      // C's phone locks *last*. No message follows a disconnect, so the close
      // handler is the only chance to notice nobody is left to wait for.
      c.ws.close();
      await untilPhase(a, "GUESSING");
      for (const client of [a, b]) client.ws.close();
    });
  });

  it("survives an eviction mid-round with its live round and deadline intact", async () => {
    const code = "RDE";
    const [a, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
    send(a, { v: 1, t: "updateSettings", patch: { questions: 2, standingsEvery: 0 } });
    await until(() => view(a)?.settings?.questions === 2, "the settings to land");
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    await expirePhase(code);
    await untilPhase(a, "ANSWERING");
    for (const w of [a, b, c]) {
      for (let q = 0; q < 2; q++) send(w, { v: 1, t: "submitEntry", questionIndex: q, text: `${w.name}${q}` });
    }
    await until(
      () => [a, b, c].every((w) => Object.keys(view(w)?.myAnswers ?? {}).length === 2),
      "the answers to land",
    );
    for (const w of [a, b, c]) send(w, { v: 1, t: "handIn" });
    await untilPhase(a, "GUESSING");

    const before = await stored(code);
    const seen = view(a)!;

    // Tear the instance down: in-memory `this.room` goes, durable storage and
    // the hibernatable sockets stay. Everything below has to come off disk.
    await evictDurableObject(stubFor(code));

    const after = await stored(code);
    expect(after.phase).toBe("GUESSING");
    expect(after.rounds.length).toBe(before.rounds.length);
    expect(after.rounds[after.rounds.length - 1].answerId)
      .toBe(before.rounds[before.rounds.length - 1].answerId);
    expect(after.rounds[after.rounds.length - 1].questionIndex)
      .toBe(before.rounds[before.rounds.length - 1].questionIndex);
    expect(after.deadline).toBe(before.deadline); // not re-based by a restart

    // And the restarted instance answers on the same sockets with the same room.
    const guesser = [a, b, c].find((client) => view(client)!.youWrote === undefined)!;
    send(guesser, {
      v: 1, t: "submitGuess",
      answerId: seen.answer.id,
      playerId: (view(guesser)!.candidates as string[])[0]!,
    });
    await until(() => view(guesser)!.myGuess !== undefined, "a guess to land after the eviction");
    expect(view(guesser)!.answer.id).toBe(seen.answer.id);
    expect(view(guesser)!.deadline).toBe(before.deadline);
    for (const client of [a, b, c]) client.ws.close();
  });

  describe("the idle self-destruct still arbitrates against the phase deadline", () => {
    it("destroys a room abandoned mid-game", async () => {
      const code = "RDF";
      const clients = await seat(code, ["A", "B", "C"]);
      send(clients[0]!, { v: 1, t: "startGame" });
      await untilPhase(clients[0]!, "INTRO");
      for (const client of clients) client.ws.close();
      expect(await untilIdleArmed(code)).toBeGreaterThan(Date.now());
      expect(await expireIdle(code)).toBe(true);
      const meta = (await (await stubFor(code).fetch("https://do/meta")).json()) as
        { exists: boolean };
      expect(meta.exists).toBe(false);
    });

    it("does not destroy a room with a socket attached, even when idle is due", async () => {
      const code = "RDG";
      const clients = await seat(code, ["A", "B", "C"]);
      send(clients[0]!, { v: 1, t: "startGame" });
      await untilPhase(clients[0]!, "INTRO");

      // `destroyAt` set while a socket is attached is reachable: it is written
      // when the last socket closes, and a socket that connects but never
      // authenticates does not clear it. The alarm must service the phase
      // deadline and leave the room alone.
      await runInDurableObject(stubFor(code), async (_i, state) => {
        await state.storage.put("destroyAt", Date.now() - 1);
      });
      expect(await runDurableObjectAlarm(stubFor(code))).toBe(true);
      const meta = (await (await stubFor(code).fetch("https://do/meta")).json()) as
        { exists: boolean };
      expect(meta.exists).toBe(true);
      expect((await stored(code)).players).toHaveLength(3);
      for (const client of clients) client.ws.close();
    });
  });

  it("discards a room persisted by an older build instead of hot-looping on it", async () => {
    // Storage outlives deploys. This is a room EXACTLY as the previous build
    // wrote it: no `schema`, no `questions`, no author-keyed `entries`, a
    // phase ("WRITING") that no longer exists, and `writeSec` instead of
    // `answerSec`. Loaded as-is it cannot advance, so its already-passed
    // deadline is re-armed on every alarm and the object spins forever.
    const code = "RDK";
    const stub = stubFor(code);
    await runInDurableObject(stub, async (_i, state) => {
      await state.storage.put("state", {
        code, hostId: "old-1", phase: "WRITING",
        players: [{ id: "old-1", name: "Ghost", emoji: "🦊", lang: "en" }],
        settings: { rounds: 4, writeSec: 60, guessSec: 25, packs: ["everyday"] },
        sessions: {}, scores: { "old-1": 0 }, stagedCount: { "old-1": 0 },
        rounds: [{ index: 1, promptId: "last-search", entries: {}, order: [],
                   stage: 0, guesses: {}, awarded: {} }],
        deadline: Date.now() - 60_000,
      });
      await state.storage.setAlarm(Date.now() - 1);
    });

    // The room reports as absent rather than sending anyone into it.
    const meta = (await (await stub.fetch("https://do/meta")).json()) as { exists: boolean };
    expect(meta.exists).toBe(false);

    // And the code is reusable: a fresh room can be created on it.
    const init = await stub.fetch("https://do/init", {
      method: "POST", body: JSON.stringify({ code }),
    });
    expect(init.ok).toBe(true);

    // The new room is playable, and nothing of the old one survived.
    const [a, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
    expect((view(a)!.players as Frame[])).toHaveLength(3);
    expect(JSON.stringify(view(a))).not.toContain("Ghost");
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    for (const client of [a, b, c]) client.ws.close();
  });

  it("goes back to the lobby with the same players, and can play again", async () => {
    const code = "RDJ";
    const [a, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
    send(a, { v: 1, t: "updateSettings", patch: { questions: 1, rounds: 1, standingsEvery: 0 } });
    await until(() => view(a)?.settings?.rounds === 1, "the settings to land");
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    await expirePhase(code);
    await untilPhase(a, "ANSWERING");
    for (const w of [a, b, c]) send(w, { v: 1, t: "submitEntry", questionIndex: 0, text: `by ${w.name}` });
    await until(
      () => [a, b, c].every((w) => view(w)?.myAnswers?.["0"] !== undefined), "the answers to land");
    for (const w of [a, b, c]) send(w, { v: 1, t: "handIn" });
    await untilPhase(a, "GUESSING");

    expect(await expirePhase(code)).toBe(true);
    await untilPhase(a, "REVEAL");
    expect(await expirePhase(code)).toBe(true);
    await untilPhase(a, "FINALE");

    // A NON-host sends it: the finale has no leave control, so this must not
    // be host-only or every other player is stranded there.
    send(b, { v: 1, t: "returnToLobby" });
    for (const w of [a, b, c]) await untilPhase(w, "LOBBY");
    expect((view(a)!.players as Frame[])).toHaveLength(3);
    expect(view(a)!.settings.questions).toBe(1);      // settings survive
    expect(view(a)!.hostId).toBe(a.id);               // the host is still the host

    // Nothing of the finished game is left in storage.
    const stored_ = await stored(code);
    expect(stored_.entries).toEqual({});
    expect(stored_.rounds).toEqual([]);
    expect(stored_.questions).toEqual([]);
    expect(stored_.deadline).toBeNull();

    // And the same room plays a second game.
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    for (const client of [a, b, c]) client.ws.close();
  });

  it("recovers when the answer's author leaves during their own REVEAL", async () => {
    // The reveal is already scored and on screen, so the engine lets it finish,
    // which voids the answer the phase is about. The projection falls back to
    // the contentless splash rather than to anything richer.
    const code = "RDH";
    const [a, b, c, d] = await seat(code, ["A", "B", "C", "D"]) as
      [Client, Client, Client, Client];
    send(a, { v: 1, t: "updateSettings", patch: { questions: 2, rounds: 6, standingsEvery: 0 } });
    await until(() => view(a)?.settings?.rounds === 6, "the settings to land");
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    await expirePhase(code);
    await untilPhase(a, "ANSWERING");
    for (const w of [a, b, c, d]) {
      for (let q = 0; q < 2; q++) send(w, { v: 1, t: "submitEntry", questionIndex: q, text: `${w.name}${q}` });
    }
    await until(
      () => [a, b, c, d].every((w) => Object.keys(view(w)?.myAnswers ?? {}).length === 2),
      "the answers to land",
    );
    for (const w of [a, b, c, d]) send(w, { v: 1, t: "handIn" });
    await untilPhase(a, "GUESSING");

    // Reach a REVEAL whose author is not the host, so the leaver is an
    // ordinary player and the room stays at MIN_PLAYERS.
    let author = "";
    for (let round = 0; round < 6; round++) {
      expect(await expirePhase(code)).toBe(true);
      await untilPhase(a, "REVEAL");
      author = view(a)!.authorId as string;
      if (author !== a.id) break;
      expect(await expirePhase(code)).toBe(true);
      await untilPhase(a, "GUESSING");
    }
    expect(author).not.toBe(a.id);
    const leaver = [b, c, d].find((client) => client.id === author)!;
    const staged = view(a)!.answer.id as string;

    send(leaver, { v: 1, t: "leave" });
    // The in-flight REVEAL finishes, but its answer is voided, so the view
    // falls back to the splash rather than to any answer content.
    await until(() => phase(a) === "INTRO", "the voided reveal to fall back to the splash");
    expect((view(a)!.players as Frame[])).toHaveLength(3);
    expect(JSON.stringify(view(a))).not.toContain(staged);

    // And the room recovers: the alarm the REVEAL armed still fires and the
    // loop moves on to the remaining answers.
    expect(await expirePhase(code), "the voided REVEAL must still re-arm").toBe(true);
    await until(
      () => phase(a) === "GUESSING" || phase(a) === "FINALE",
      "the loop to continue past the voided answer",
    );
    for (const client of [a, b, c]) client.ws.close();
  });
});
