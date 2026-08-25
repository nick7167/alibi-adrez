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
 *  2. the two game messages actually travelling over a socket and coming back
 *     in a broadcast;
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

async function untilPhase(c: Client, want: string): Promise<void> {
  await until(() => phase(c) === want, `${c.name} to see ${want} (saw ${phase(c)})`);
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

describe("the round loop in the Durable Object", () => {
  it("plays a whole round on expiring alarms alone, re-arming through every stage", async () => {
    const code = "RDA";
    const clients = await seat(code, ["A", "B", "C", "D"]);
    const [host, b, c, d] = clients as [Client, Client, Client, Client];
    send(host, { v: 1, t: "updateSettings", patch: { rounds: 1 } });
    await until(() => view(host)?.settings?.rounds === 1, "the round count to drop to 1");

    send(host, { v: 1, t: "startGame" });
    await untilPhase(host, "INTRO");

    // The *only* client input in this test: three of the four players write.
    // Entries cannot be conjured server-side, and a fourth entry would resolve
    // WRITING early (everybody connected has written) — which is the other
    // test. From here on every transition is an alarm and nothing else.
    expect(await expirePhase(code), "INTRO must have re-armed the alarm").toBe(true);
    await untilPhase(host, "WRITING");
    for (const writer of [host, b, c]) {
      send(writer, { v: 1, t: "submitEntry", text: `answer from ${writer.name}` });
    }
    await until(
      () => [host, b, c].every((w) => view(w)?.myEntry !== undefined),
      "all three entries to land",
    );
    expect(phase(host), "one player still owes an answer").toBe("WRITING");

    expect(await expirePhase(code), "WRITING must have re-armed the alarm").toBe(true);
    await untilPhase(host, "GUESSING");
    expect(view(host)!.answerTotal).toBe(3);

    // The inner loop, driven entirely by the alarm: GUESSING -> REVEAL ->
    // GUESSING for each staged answer. Nobody guesses; nobody taps anything.
    const revealed: string[] = [];
    for (let i = 1; i <= 3; i++) {
      expect(phase(host), `stage ${i} should be GUESSING`).toBe("GUESSING");
      expect(view(host)!.answerIndex).toBe(i);
      expect(view(host)!.deadline, "a live phase must carry a deadline").not.toBeNull();

      expect(await expirePhase(code), `GUESSING ${i} must have re-armed the alarm`).toBe(true);
      await untilPhase(host, "REVEAL");
      expect(view(host)!.authorId).toBeTypeOf("string");
      revealed.push(view(host)!.answer.id as string);

      expect(await expirePhase(code), `REVEAL ${i} must have re-armed the alarm`).toBe(true);
      await until(
        () => phase(host) === (i === 3 ? "ROUND_END" : "GUESSING"),
        `stage ${i} to hand over to the next phase`,
      );
    }
    expect(new Set(revealed).size, "each stage reveals a different answer").toBe(3);

    expect(phase(host)).toBe("ROUND_END");
    expect((view(host)!.answers as Frame[]).map((a) => a.authorId).sort())
      .toEqual([host.id, b.id, c.id].sort());

    expect(await expirePhase(code), "ROUND_END must have re-armed the alarm").toBe(true);
    await untilPhase(host, "FINALE");
    expect(view(host)!.deadline).toBeUndefined(); // FINALE view is untimed
    for (const client of [host, b, c, d]) client.ws.close();
  });

  it("round-trips submitEntry and submitGuess over a real socket", async () => {
    const code = "RDB";
    const [host, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
    send(host, { v: 1, t: "startGame" });
    await untilPhase(host, "INTRO");
    await expirePhase(code);
    await untilPhase(host, "WRITING");

    send(host, { v: 1, t: "submitEntry", text: "a socket-borne answer" });
    await until(() => view(host)?.myEntry === "a socket-borne answer", "submitEntry to come back");
    // Upsert, not append: the second submission replaces the first.
    send(host, { v: 1, t: "submitEntry", text: "edited before the deadline" });
    await until(
      () => view(host)?.myEntry === "edited before the deadline", "the edit to come back");

    for (const writer of [b, c]) send(writer, { v: 1, t: "submitEntry", text: `by ${writer.name}` });
    await untilPhase(host, "GUESSING"); // everyone connected has written

    const guesser = [host, b, c].find((client) => view(client)!.youWrote === undefined)!;
    const answerId = view(guesser)!.answer.id as string;
    const target = (view(guesser)!.candidates as string[])[0]!;

    send(guesser, { v: 1, t: "submitGuess", answerId: "not-the-staged-answer", playerId: target });
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

  describe("a locked phone is not a leave", () => {
    it("resolves early once the connected players act, and still scores the absent one", async () => {
      const code = "RDC";
      const [a, b, c, d] = await seat(code, ["A", "B", "C", "D"]) as
        [Client, Client, Client, Client];
      send(a, { v: 1, t: "startGame" });
      await untilPhase(a, "INTRO");
      await expirePhase(code);
      await untilPhase(a, "WRITING");

      // D writes and then their phone locks. They are not gone from the room.
      send(d, { v: 1, t: "submitEntry", text: "written before the screen went dark" });
      await until(() => view(d)?.myEntry !== undefined, "D's entry to land");
      d.ws.close();
      await until(
        () => (view(a)?.players as Frame[]).length === 4, "D to still be in the room");

      // The remaining three write. No alarm is fired anywhere in this test:
      // if the room were still waiting on D it would sit here until the
      // 60-second writing timer, and this would time out.
      for (const writer of [a, b, c]) send(writer, { v: 1, t: "submitEntry", text: `by ${writer.name}` });
      await untilPhase(a, "GUESSING");

      // D is disconnected, not absent: their answer is on the stage and they
      // are on everybody's candidate list.
      expect(view(a)!.answerTotal).toBe(4);
      expect(view(a)!.candidates as string[]).toContain(d.id);

      // Everyone guesses somebody who is not D, four stages in a row, so D is
      // fooled by every guesser on their own answer: +1 each, and D never
      // guesses, so their whole score comes from being fooled-with.
      const target: Record<string, string> = { [a.id]: b.id, [b.id]: a.id, [c.id]: a.id };
      for (let stage = 1; stage <= 4; stage++) {
        for (const client of [a, b, c]) {
          const v = view(client)!;
          if (v.phase !== "GUESSING" || v.youWrote !== undefined) continue;
          send(client, { v: 1, t: "submitGuess", answerId: v.answer.id, playerId: target[client.id] });
          await until(
            () => view(client)!.myGuess !== undefined || view(client)!.phase !== "GUESSING",
            `${client.name}'s guess on stage ${stage} to land`,
          );
        }
        await untilPhase(a, "REVEAL");
        expect(await expirePhase(code), `REVEAL ${stage} must re-arm`).toBe(true);
        await until(
          () => phase(a) === (stage === 4 ? "ROUND_END" : "GUESSING"),
          `stage ${stage} to hand over`,
        );
      }

      const board = view(a)!.scoreboard as { playerId: string; score: number }[];
      expect(board.find((s) => s.playerId === d.id)!.score)
        .toBe(3); // three guessers, all fooled, +1 each
      for (const client of [a, b, c]) client.ws.close();
    });

    it("resolves the phase when the last player we were waiting on drops", async () => {
      const code = "RDD";
      const [a, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
      send(a, { v: 1, t: "startGame" });
      await untilPhase(a, "INTRO");
      await expirePhase(code);
      await untilPhase(a, "WRITING");

      for (const writer of [a, b]) send(writer, { v: 1, t: "submitEntry", text: `by ${writer.name}` });
      await until(() => view(b)?.myEntry !== undefined, "B's entry to land");
      expect(phase(a)).toBe("WRITING");

      // C's phone locks *last*. No message follows a disconnect, so the close
      // handler is the only chance to notice nobody is left to wait for.
      c.ws.close();
      await untilPhase(a, "GUESSING");
      expect(view(a)!.answerTotal).toBe(2);
      for (const client of [a, b]) client.ws.close();
    });
  });

  it("survives an eviction mid-round with its stage order and deadline intact", async () => {
    const code = "RDE";
    const [a, b, c] = await seat(code, ["A", "B", "C"]) as [Client, Client, Client];
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    await expirePhase(code);
    await untilPhase(a, "WRITING");
    for (const writer of [a, b, c]) send(writer, { v: 1, t: "submitEntry", text: `by ${writer.name}` });
    await untilPhase(a, "GUESSING");

    const before = await stored(code);
    const seen = view(a)!;

    // Tear the instance down: in-memory `this.room` goes, durable storage and
    // the hibernatable sockets stay. Everything below has to come off disk.
    await evictDurableObject(stubFor(code));

    const after = await stored(code);
    expect(after.phase).toBe("GUESSING");
    expect(after.rounds[0].order).toEqual(before.rounds[0].order); // the staged order
    expect(after.rounds[0].stage).toBe(before.rounds[0].stage);
    expect(after.deadline).toBe(before.deadline); // the deadline is not re-based by a restart

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

  it("recovers when the staged author leaves during their own REVEAL", async () => {
    // T4 could construct this state but not drive it: the reveal is already
    // scored and on screen, so T3 lets it finish, which voids the answer the
    // phase is about. The projection falls back to the contentless INTRO view
    // (never ROUND_END, which would publish the un-guessed answers).
    const code = "RDH";
    const [a, b, c, d] = await seat(code, ["A", "B", "C", "D"]) as
      [Client, Client, Client, Client];
    send(a, { v: 1, t: "startGame" });
    await untilPhase(a, "INTRO");
    await expirePhase(code);
    await untilPhase(a, "WRITING");
    for (const writer of [a, b, c, d]) send(writer, { v: 1, t: "submitEntry", text: `by ${writer.name}` });
    await untilPhase(a, "GUESSING");

    // Reach a REVEAL whose author is not the host, so the leaver is an
    // ordinary player and the room stays at MIN_PLAYERS.
    let author = "";
    for (let stage = 0; stage < 4; stage++) {
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
      () => phase(a) === "GUESSING" || phase(a) === "ROUND_END",
      "the loop to continue past the voided answer",
    );
    if (phase(a) === "GUESSING") {
      // Three entries left, and the leaver's is not one of them.
      expect(view(a)!.answerTotal).toBe(3);
    }
    let guard = 0;
    while (phase(a) !== "ROUND_END" && guard++ < 10) await stepAlarm(code, a);
    expect(phase(a)).toBe("ROUND_END");
    expect((view(a)!.answers as Frame[]).some((ans) => ans.authorId === author)).toBe(false);
    for (const client of [a, b, c]) client.ws.close();
  });
});
