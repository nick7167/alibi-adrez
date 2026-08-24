import { describe, expect, it } from "vitest";
import type { Settings } from "../src/protocol";
import { applyEvent, createRoom, snapshotForPlayer } from "../src/state";

function makeDeps() {
  let i = 0;
  let t = 0;
  return { newId: () => `p${++i}`, newToken: () => `tok${++t}`, now: () => 0, random: () => 0 };
}

async function lobbyWithPlayers(n: number) {
  const deps = makeDeps();
  let room = createRoom("TEST");
  for (let i = 1; i <= n; i++) {
    const r = await applyEvent(room, "", { v: 1, t: "join", name: `P${i}`, emoji: "🦊" }, deps);
    if (!r.ok) throw new Error("setup failed");
    room = r.room;
  }
  return room;
}

describe("lobby state machine", () => {
  it("first join claims host and returns welcome token", async () => {
    const deps = makeDeps();
    const room = createRoom("TEST");
    expect(room.hostId).toBe("");
    const r = await applyEvent(room, "", { v: 1, t: "join", name: "Nick", emoji: "🦊" }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.welcome).toEqual({ playerId: "p1", token: "tok1" });
    expect(r.room.hostId).toBe("p1");
  });
  it("reconnect validates hashed token and replays identity", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(2);
    const ok = await applyEvent(room, "", { v: 1, t: "reconnect", playerId: "p2", token: "tok2" }, deps);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.room.players.find((p) => p.id === "p2")?.name).toBe("P2");
    const bad = await applyEvent(room, "", { v: 1, t: "reconnect", playerId: "p2", token: "WRONG" }, deps);
    expect(bad).toMatchObject({ ok: false, code: "UNKNOWN_PLAYER" });
  });
  it("rejects duplicate names case-insensitively", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(2);
    const r = await applyEvent(room, "", { v: 1, t: "join", name: "p2", emoji: "🐸" }, deps);
    expect(r).toMatchObject({ ok: false, code: "NAME_TAKEN" });
  });
  it("rejects 17th player with ROOM_FULL", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(16);
    const r = await applyEvent(room, "", { v: 1, t: "join", name: "late", emoji: "🦊" }, deps);
    expect(r).toMatchObject({ ok: false, code: "ROOM_FULL" });
  });
  it("updateSettings is host-only and clamps ranges", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(3);
    const bad = await applyEvent(room, "p2", { v: 1, t: "updateSettings", patch: { rounds: 99 } }, deps);
    expect(bad).toMatchObject({ ok: false, code: "NOT_HOST" });
    const good = await applyEvent(room, "p1", { v: 1, t: "updateSettings", patch: { rounds: 99, answerSec: 0 } }, deps);
    expect(good.ok && good.room.settings.rounds).toBe(10);
    expect(good.ok && good.room.settings.answerSec).toBe(10);
  });
  it("drops unknown and injected keys from settings patches", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(2);
    const patch = JSON.parse('{"rounds":5,"evil":true,"__proto__":{"polluted":true}}') as Partial<Settings>;
    const r = await applyEvent(room, "p1", { v: 1, t: "updateSettings", patch }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.settings.rounds).toBe(5);
    expect(Object.keys(r.room.settings).sort())
      .toEqual(["answerSec", "planningSec", "questionCount", "rounds", "scenarioSource"]);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
  it("startGame requires host and 3+ players, moves to INTRO", async () => {
    const deps = makeDeps();
    const solo = await lobbyWithPlayers(1);
    expect(await applyEvent(solo, "p1", { v: 1, t: "startGame" }, deps)).toMatchObject({ ok: false });
    const pair = await lobbyWithPlayers(2);
    expect(await applyEvent(pair, "p1", { v: 1, t: "startGame" }, deps))
      .toMatchObject({ ok: false, code: "BAD_MESSAGE" });
    const room = await lobbyWithPlayers(3);
    const r = await applyEvent(room, "p1", { v: 1, t: "startGame" }, deps);
    expect(r.ok && r.room.phase).toBe("INTRO");
  });
  it("rejects joining after the game has started", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(3);
    const started = await applyEvent(room, "p1", { v: 1, t: "startGame" }, deps);
    if (!started.ok) throw new Error("setup failed");
    const r = await applyEvent(started.room, "", { v: 1, t: "join", name: "late", emoji: "🦊" }, deps);
    expect(r).toMatchObject({ ok: false, code: "GAME_STARTED" });
  });
  it("leave reassigns host and keeps others", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(3);
    const r = await applyEvent(room, "p1", { v: 1, t: "leave" }, deps);
    expect(r.ok && r.room.hostId).toBe("p2");
  });
  it("snapshots never expose sessions or tokens", async () => {
    const room = await lobbyWithPlayers(2);
    const snap = snapshotForPlayer(room, "p1");
    const json = JSON.stringify(snap);
    expect(json).not.toContain("sessions");
    expect(json).not.toContain("token");
    if (snap.t === "state") expect(snap.isHost).toBe(true);
  });
  it("is pure: original room unchanged after event", async () => {
    const deps = makeDeps();
    const room = await lobbyWithPlayers(2);
    const before = structuredClone(room);
    await applyEvent(room, "p2", { v: 1, t: "leave" }, deps);
    expect(room).toEqual(before);
  });
});
