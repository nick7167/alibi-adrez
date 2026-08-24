import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@alibi/shared";

/**
 * T5: the Durable Object drives the round loop. Everything here goes over a
 * real socket, exactly as a browser would talk to it.
 *
 * Time is the awkward part: `runDurableObjectAlarm` fires the alarm handler
 * immediately regardless of when it was scheduled, and there is no supported
 * way to move the workerd clock. So instead of faking the clock we backdate
 * the deadline the alarm is waiting on — the state the room would be in ten
 * minutes (or one phase) later — and then run the alarm. The handler still
 * makes the real decision from the real `Date.now()`.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Waits for `check` to become true rather than sleeping a fixed span. A fixed
 * sleep passes on an idle machine and loses the race under load — it made this
 * file flake in exactly that way, so socket frames are always awaited, never
 * assumed to have arrived.
 */
async function until(check: () => boolean, what: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await sleep(10);
  }
  expect.fail(`timed out after ${timeoutMs}ms waiting for ${what}`);
}

type Peer = { ws: WebSocket; inbox: any[]; id: string };

const stubFor = (code: string) => env.ROOMS_DO.get(env.ROOMS_DO.idFromName(code));

async function join(code: string, name: string, lang?: "en" | "da"): Promise<Peer> {
  const res = await stubFor(code).fetch("https://do/ws", { headers: { Upgrade: "websocket" } });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  const inbox: any[] = [];
  ws.addEventListener("message", (e) => {
    inbox.push(JSON.parse((e as MessageEvent).data as string));
  });
  const msg: Record<string, unknown> = { v: 1, t: "join", name, emoji: "🦊" };
  if (lang !== undefined) msg.lang = lang;
  ws.send(JSON.stringify(msg));
  await until(() => inbox.some((m) => m.t === "welcome"), `a welcome frame for ${name}`);
  const welcome = inbox.find((m) => m.t === "welcome");
  return { ws, inbox, id: welcome.playerId };
}

/** The most recent snapshot this peer received. */
function view(peer: Peer): any {
  const state = peer.inbox.filter((m) => m.t === "state").at(-1);
  expect(state, "no state frame received").toBeDefined();
  return state.room;
}

function frame(peer: Peer): any {
  return peer.inbox.filter((m) => m.t === "state").at(-1);
}

async function send(peer: Peer, msg: Record<string, unknown>): Promise<void> {
  const before = peer.inbox.length;
  peer.ws.send(JSON.stringify({ v: 1, ...msg }));
  // Every accepted message broadcasts a snapshot and every rejected one sends
  // an error, so exactly one new frame is the settled signal.
  await until(() => peer.inbox.length > before, `a reply to ${String(msg.t)}`);
}

/**
 * Simulates the phase timer expiring: backdate the stored deadline (and the
 * instance's in-memory copy of it) and let the already-armed alarm run.
 */
async function expirePhase(code: string): Promise<boolean> {
  const stub = stubFor(code);
  await runInDurableObject(stub, async (instance, state) => {
    const room = await state.storage.get<{ deadline: number | null }>("state");
    if (room === undefined || room.deadline === null) return;
    room.deadline = Date.now() - 1;
    await state.storage.put("state", room);
    // Keep the instance's in-memory cache consistent with storage.
    (instance as unknown as { room?: unknown }).room = room;
  });
  const ran = await runDurableObjectAlarm(stub);
  await sleep(50);
  return ran;
}

/** Backdates the idle self-destruct deadline, i.e. "ten minutes went by". */
async function expireIdle(code: string): Promise<boolean> {
  const stub = stubFor(code);
  await runInDurableObject(stub, async (_instance, state) => {
    const at = await state.storage.get<number>("destroyAt");
    if (at !== undefined) await state.storage.put("destroyAt", Date.now() - 1);
  });
  const ran = await runDurableObjectAlarm(stub);
  await sleep(50);
  return ran;
}

async function exists(code: string): Promise<boolean> {
  const meta = (await (await stubFor(code).fetch("https://do/meta")).json()) as {
    exists: boolean;
  };
  return meta.exists;
}

/** Fast settings so a test round is three questions long, not six. */
const FAST = { rounds: 1, planningSec: 15, answerSec: 10, questionCount: 3 };

async function seat(code: string, names: string[]): Promise<Peer[]> {
  const peers: Peer[] = [];
  for (const name of names) peers.push(await join(code, name));
  await send(peers[0]!, { t: "updateSettings", patch: FAST });
  await send(peers[0]!, { t: "startGame" });
  expect(view(peers[0]!).phase).toBe("INTRO");
  return peers;
}

/** Runs the phase timer out until the room reaches `phase`. */
async function runTo(code: string, peers: Peer[], phase: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (view(peers[0]!).phase === phase) return;
    await expirePhase(code);
  }
  throw new Error(`never reached ${phase}; stuck in ${view(peers[0]!).phase}`);
}

function rolesOf(peers: Peer[]): { suspects: Peer[]; detectives: Peer[] } {
  const suspectIds: string[] = view(peers[0]!).suspectIds;
  return {
    suspects: peers.filter((p) => suspectIds.includes(p.id)),
    detectives: peers.filter((p) => !suspectIds.includes(p.id)),
  };
}

describe("round loop over sockets", () => {
  it("stamps the server clock on every snapshot", async () => {
    const peers = await seat("R01", ["A", "B", "C"]);
    const f = frame(peers[0]!);
    expect(typeof f.now).toBe("number");
    expect(Math.abs(f.now - Date.now())).toBeLessThan(60_000);
    expect(f.room.deadline).toBeGreaterThan(f.now);
    for (const p of peers) p.ws.close();
  });

  it("does not advance a phase before its deadline", async () => {
    const peers = await seat("R02", ["A", "B", "C"]);
    // startGame must have armed the alarm for the INTRO deadline...
    expect(await runDurableObjectAlarm(stubFor("R02"))).toBe(true);
    await sleep(50);
    // ...but the deadline has not passed, so nothing moves.
    expect(view(peers[0]!).phase).toBe("INTRO");
    for (const p of peers) p.ws.close();
  });

  it("reaches PLANNING when the INTRO deadline passes", async () => {
    const code = "R03";
    const peers = await seat(code, ["A", "B", "C"]);
    expect(await expirePhase(code)).toBe(true);
    for (const p of peers) {
      const v = view(p);
      expect(v.phase).toBe("PLANNING");
      expect(v.deadline).toBeGreaterThan(Date.now());
      expect(v.role).toBe(v.suspectIds.includes(p.id) ? "suspect" : "detective");
    }
    for (const p of peers) p.ws.close();
  });

  it("round-trips suspectChat, submitQuestion, submitAnswer and castVote", async () => {
    const code = "R04";
    const peers = await seat(code, ["A", "B", "C", "D"]);
    await runTo(code, peers, "PLANNING");
    const { suspects, detectives } = rolesOf(peers);
    expect(suspects).toHaveLength(2);

    // suspectChat: private to the two suspects.
    await send(suspects[0]!, { t: "suspectChat", text: "say we were at the zoo" });
    expect(view(suspects[1]!).chat).toEqual([
      { playerId: suspects[0]!.id, text: "say we were at the zoo" },
    ]);
    expect(view(detectives[0]!).chat).toBeUndefined();
    await send(detectives[0]!, { t: "suspectChat", text: "let me in" });
    expect(detectives[0]!.inbox.at(-1)).toMatchObject({ t: "error", code: "NOT_SUSPECT" });

    await runTo(code, peers, "INTERROGATION");

    // submitQuestion: the detective's remaining budget drops.
    const before = view(detectives[0]!).myQuestionsLeft;
    await send(detectives[0]!, { t: "submitQuestion", text: "what colour was the bus?" });
    expect(view(detectives[0]!).myQuestionsLeft).toBe(before - 1);

    // submitAnswer: the clock passes to the other suspect, then the question
    // is complete and lands in the (sanitized) transcript.
    const onClock = view(peers[0]!).onTheClock as string;
    const first = suspects.find((p) => p.id === onClock)!;
    const second = suspects.find((p) => p.id !== onClock)!;
    await send(first, { t: "submitAnswer", text: "we were at the zoo" });
    expect(view(peers[0]!).onTheClock).toBe(second.id);
    // The second suspect must not be shown the first one's answer.
    expect(JSON.stringify(view(second))).not.toContain("we were at the zoo");
    await send(second, { t: "submitAnswer", text: "the zoo, obviously" });
    const t = view(detectives[0]!).transcript;
    expect(t).toHaveLength(1);
    expect(t[0].answers.map((a: any) => a.text).sort()).toEqual([
      "the zoo, obviously",
      "we were at the zoo",
    ]);

    // castVote in DELIBERATION.
    await runTo(code, peers, "DELIBERATION");
    await send(detectives[0]!, { t: "castVote", verdict: "busted" });
    expect(view(detectives[0]!)).toMatchObject({ myVote: "busted", votesCast: 1 });
    expect(view(detectives[1]!)).toMatchObject({ myVote: null, votesCast: 1 });
    await send(suspects[0]!, { t: "castVote", verdict: "busted" });
    expect(suspects[0]!.inbox.at(-1)).toMatchObject({ t: "error", code: "NOT_DETECTIVE" });
    for (const p of peers) p.ws.close();
  });

  it("resolves DELIBERATION as soon as every detective has voted", async () => {
    const code = "R05";
    const peers = await seat(code, ["A", "B", "C", "D"]);
    await runTo(code, peers, "DELIBERATION");
    const { detectives } = rolesOf(peers);
    expect(detectives).toHaveLength(2);
    await send(detectives[0]!, { t: "castVote", verdict: "consistent" });
    expect(view(peers[0]!).phase).toBe("DELIBERATION");
    // No timer expiry here: the last vote alone must resolve the phase.
    await send(detectives[1]!, { t: "castVote", verdict: "consistent" });
    const v = view(peers[0]!);
    expect(v.phase).toBe("REVEAL");
    expect(v.verdict).toBe("consistent");
    expect(v.unanimous).toBe(true);
    expect(v.deadline).toBeGreaterThan(Date.now());
    // ...and the alarm was re-armed for the new (REVEAL) deadline.
    expect(await runDurableObjectAlarm(stubFor(code))).toBe(true);
    await sleep(50);
    expect(view(peers[0]!).phase).toBe("REVEAL");
    for (const p of peers) p.ws.close();
  });

  it("plays a one-round game through to FINALE", async () => {
    const code = "R06";
    const peers = await seat(code, ["A", "B", "C"]);
    await runTo(code, peers, "FINALE");
    const v = view(peers[0]!);
    expect(v.deadline).toBeUndefined(); // FinaleView carries no deadline
    expect(v.scoreboard).toHaveLength(3);
    // FINALE is untimed, so with everyone still connected no alarm remains.
    expect(await runDurableObjectAlarm(stubFor(code))).toBe(false);
    for (const p of peers) p.ws.close();
  });

  it("setLang changes what that player's next snapshot contains", async () => {
    const code = "R07";
    const peers = await seat(code, ["A", "B", "C"]);
    await runTo(code, peers, "PLANNING");
    const { suspects } = rolesOf(peers);
    const me = suspects[0]!;
    const other = suspects[1]!;
    const englishStory = view(me).scenario.story as string;
    const scenario = SCENARIOS.find((s) => s.en.story === englishStory);
    expect(scenario, "scenario story should come from the curated pack").toBeDefined();

    await send(me, { t: "setLang", lang: "da" });
    expect(view(me).scenario.story).toBe(scenario!.da.story);
    expect(view(me).scenario.details).toEqual(scenario!.da.details);
    // Only the sender's language changed.
    expect(view(other).scenario.story).toBe(scenario!.en.story);
    for (const p of peers) p.ws.close();
  });
});

describe("restart", () => {
  it("keeps the round, the deadline and the alarm across a DO eviction", async () => {
    const code = "R08";
    const peers = await seat(code, ["A", "B", "C"]);
    await runTo(code, peers, "INTERROGATION");
    const stub = stubFor(code);
    const beforeView = view(peers[0]!);
    const before = {
      phase: beforeView.phase,
      round: beforeView.round,
      suspectIds: beforeView.suspectIds,
      deadline: beforeView.deadline,
      question: beforeView.question,
      onTheClock: beforeView.onTheClock,
    };

    // Tear the instance down; storage (and the alarm) survive, sockets hibernate.
    await evictDurableObject(stub);

    // A message over the same socket must be served from rehydrated state.
    const framesBefore = peers[0]!.inbox.length;
    await send(peers[0]!, { t: "setLang", lang: "en" });
    const fresh = peers[0]!.inbox.slice(framesBefore);
    expect(fresh.map((m) => m.t)).toEqual(["state"]); // a snapshot, not an error
    const after = view(peers[0]!);
    expect(after.phase).toBe(before.phase);
    expect(after.round).toBe(before.round);
    expect(after.suspectIds).toEqual(before.suspectIds);
    expect(after.deadline).toBe(before.deadline);
    expect(after.question).toBe(before.question);
    expect(after.onTheClock).toBe(before.onTheClock);

    // The phase timer still works after the restart.
    expect(await expirePhase(code)).toBe(true);
    expect(view(peers[0]!).onTheClock).not.toBe(before.onTheClock);
    for (const p of peers) p.ws.close();
  });
});

describe("idle self-destruct vs. phase alarm", () => {
  it("still destroys an abandoned lobby", async () => {
    const code = "R09";
    const peer = await join(code, "A");
    peer.ws.close();
    await sleep(50); // let the server see the close and start the idle clock
    expect(await expireIdle(code)).toBe(true);
    expect(await exists(code)).toBe(false);
  });

  it("does not destroy a game in progress while players are connected", async () => {
    const code = "R10";
    const peers = await seat(code, ["A", "B", "C"]);
    await runTo(code, peers, "PLANNING");
    // Force the idle deadline into the past *and* keep everyone connected.
    await runInDurableObject(stubFor(code), async (_i, state) => {
      await state.storage.put("destroyAt", Date.now() - 1);
    });
    expect(await expirePhase(code)).toBe(true);
    expect(await exists(code)).toBe(true);
    expect(view(peers[0]!).phase).toBe("INTERROGATION");
    for (const p of peers) p.ws.close();
  });

  it("destroys an abandoned game once the idle deadline passes", async () => {
    const code = "R11";
    const peers = await seat(code, ["A", "B", "C"]);
    await runTo(code, peers, "PLANNING");
    for (const p of peers) p.ws.close();
    await sleep(50);
    expect(await expireIdle(code)).toBe(true);
    expect(await exists(code)).toBe(false);
  });

  it("reconnecting mid-game cancels the idle clock and keeps the phase alarm", async () => {
    const code = "R12";
    const peers = await seat(code, ["A", "B", "C"]);
    await runTo(code, peers, "PLANNING");
    const welcome = peers[2]!.inbox.find((m) => m.t === "welcome");
    peers[2]!.ws.close();
    await sleep(50);

    const res = await stubFor(code).fetch("https://do/ws", { headers: { Upgrade: "websocket" } });
    const ws = res.webSocket!;
    ws.accept();
    const inbox: any[] = [];
    ws.addEventListener("message", (e) => {
      inbox.push(JSON.parse((e as MessageEvent).data as string));
    });
    ws.send(JSON.stringify({ v: 1, t: "reconnect", playerId: welcome.playerId, token: welcome.token }));
    await sleep(50);
    const back: Peer = { ws, inbox, id: welcome.playerId };
    expect(view(back).phase).toBe("PLANNING"); // lands back on the right screen

    // The idle clock is cancelled...
    const destroyAt = await runInDurableObject(stubFor(code), (_i, state) =>
      state.storage.get<number>("destroyAt"),
    );
    expect(destroyAt).toBeUndefined();
    // ...but the phase alarm is still armed and still works.
    expect(await expirePhase(code)).toBe(true);
    expect(view(back).phase).toBe("INTERROGATION");
    for (const p of peers) p.ws.close();
    ws.close();
  });
});
