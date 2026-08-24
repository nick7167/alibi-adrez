import { SELF, env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function connectAndJoin(code: string, name: string) {
  const id = env.ROOMS_DO.idFromName(code);
  const res = await env.ROOMS_DO.get(id).fetch("https://do/ws", {
    headers: { Upgrade: "websocket" },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  const inbox: unknown[] = [];
  ws.addEventListener("message", (e) => { inbox.push(JSON.parse((e as MessageEvent).data as string)); });
  ws.send(JSON.stringify({ v: 1, t: "join", name, emoji: "🦊" }));
  await new Promise((r) => setTimeout(r, 50));
  return { ws, inbox };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openSocket(code: string) {
  const id = env.ROOMS_DO.idFromName(code);
  const res = await env.ROOMS_DO.get(id).fetch("https://do/ws", {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket!;
  ws.accept();
  const inbox: unknown[] = [];
  ws.addEventListener("message", (e) => { inbox.push(JSON.parse((e as MessageEvent).data as string)); });
  return { ws, inbox };
}

describe("lobby websocket", () => {
  it("welcomes first player as host and broadcasts state", async () => {
    const { ws, inbox } = await connectAndJoin("WSA", "Nick");
    expect(inbox[0]).toMatchObject({ t: "welcome" });
    const state = inbox.find((m: any) => m.t === "state") as any;
    expect(state.isHost).toBe(true);
    expect(state.room.players).toHaveLength(1);
    ws.close();
  });
  it("second joiner sees both players and is not host", async () => {
    await connectAndJoin("WSB", "A");
    const { inbox, ws } = await connectAndJoin("WSB", "B");
    const state = inbox.filter((m: any) => m.t === "state").at(-1) as any;
    expect(state.room.players.map((p: any) => p.name).sort()).toEqual(["A", "B"]);
    expect(state.isHost).toBe(false);
    ws.close();
  });
  it("rejects non-join first message", async () => {
    const id = env.ROOMS_DO.idFromName("WSE");
    const res = await env.ROOMS_DO.get(id).fetch("https://do/ws", {
      headers: { Upgrade: "websocket" },
    });
    const ws = res.webSocket!;
    ws.accept();
    const inbox: any[] = [];
    ws.addEventListener("message", (e) => { inbox.push(JSON.parse((e as MessageEvent).data as string)); });
    ws.send(JSON.stringify({ v: 1, t: "ping" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(inbox[0]).toMatchObject({ t: "error", code: "BAD_MESSAGE" });
  });
  it("failed reconnect against an unused code leaves no state behind", async () => {
    const code = "WSZ";
    const { ws, inbox } = await openSocket(code);
    ws.send(JSON.stringify({ v: 1, t: "reconnect", playerId: "ghost", token: "bogus" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(inbox[0]).toMatchObject({ t: "error", code: "UNKNOWN_PLAYER" });
    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    const meta = (await (
      await env.ROOMS_DO.get(env.ROOMS_DO.idFromName(code)).fetch("https://do/meta")
    ).json()) as { exists: boolean };
    expect(meta.exists).toBe(false);
  });
  it("reconnect replays same identity", async () => {
    const first = await connectAndJoin("WSC", "A");
    const welcome = first.inbox[0] as any;
    expect(welcome.t).toBe("welcome");
    const { playerId, token } = welcome;
    first.ws.close();
    await new Promise((r) => setTimeout(r, 50)); // let server process the close

    const res = await env.ROOMS_DO.get(env.ROOMS_DO.idFromName("WSC")).fetch("https://do/ws", {
      headers: { Upgrade: "websocket" },
    });
    const ws = res.webSocket!;
    ws.accept();
    const inbox: any[] = [];
    ws.addEventListener("message", (e) => { inbox.push(JSON.parse((e as MessageEvent).data as string)); });
    ws.send(JSON.stringify({ v: 1, t: "reconnect", playerId, token }));
    await new Promise((r) => setTimeout(r, 50));
    expect(inbox[0]).toMatchObject({ t: "welcome", playerId });
    const state = inbox.find((m) => m.t === "state") as any;
    expect(state.you).toBe(playerId);
    expect(state.room.players.map((p: any) => p.name)).toEqual(["A"]);
    ws.close();
  });
  it("host can start game → INTRO broadcast", async () => {
    const a = await connectAndJoin("WSD", "A");
    const b = await connectAndJoin("WSD", "B");
    await connectAndJoin("WSD", "C"); // scope decision 1: 3 players minimum
    (a.ws as any).send(JSON.stringify({ v: 1, t: "startGame" }));
    await new Promise((r) => setTimeout(r, 50));
    const last = (b.inbox as any[]).at(-1);
    expect(last!.room.phase).toBe("INTRO");
  });

  it("proxies /api/room/<code>/ws through the worker to the DO", async () => {
    const res = await SELF.fetch("https://example.com/api/room/WSPX/ws", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket!;
    ws.accept();
    const inbox: unknown[] = [];
    ws.addEventListener("message", (e) => { inbox.push(JSON.parse((e as MessageEvent).data as string)); });
    ws.send(JSON.stringify({ v: 1, t: "join", name: "P", emoji: "🦊" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(inbox[0]).toMatchObject({ t: "welcome" });
    ws.close();
  });

  it("leave removes the player and broadcasts the updated lobby", async () => {
    const a = await connectAndJoin("WSL", "A");
    const b = await connectAndJoin("WSL", "B");
    b.ws.send(JSON.stringify({ v: 1, t: "leave" }));
    await new Promise((r) => setTimeout(r, 50));
    const last = (a.inbox as any[]).at(-1);
    expect(last!.t).toBe("state");
    expect(last!.room.players.map((p: any) => p.name)).toEqual(["A"]);
    a.ws.close();
  });

  describe("carried from task 6 review: atomic /init", () => {
    it("serializes concurrent /init for the same room code", async () => {
      const stub = env.ROOMS_DO.get(env.ROOMS_DO.idFromName("WST"));
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          stub.fetch("https://do/init", {
            method: "POST",
            body: JSON.stringify({ code: "WST" }),
          }),
        ),
      );
      const statuses = results.map((r) => r.status).sort((x, y) => x - y);
      expect(statuses).toEqual([200, 409, 409, 409, 409]);
    });
  });

  describe("self-destruct alarm", () => {
    it("destroys storage when alarm fires with zero connections", async () => {
      const code = "WSF";
      const { ws } = await connectAndJoin(code, "A");
      ws.close();
      await sleep(50); // let server process close + schedule alarm
      const stub = env.ROOMS_DO.get(env.ROOMS_DO.idFromName(code));
      // The alarm slot is shared with the phase deadline (T5), so the handler
      // checks the clock instead of assuming any alarm means "self-destruct".
      // runDurableObjectAlarm fires early, so backdate the idle deadline to
      // stand in for the ten minutes actually elapsing.
      await runInDurableObject(stub, async (_instance, state) => {
        expect(await state.storage.get<number>("destroyAt")).toBeGreaterThan(Date.now());
        await state.storage.put("destroyAt", Date.now() - 1);
      });
      expect(await runDurableObjectAlarm(stub)).toBe(true);
      const meta = (await (await stub.fetch("https://do/meta")).json()) as { exists: boolean };
      expect(meta.exists).toBe(false);
    });
    it("rejoin cancels a pending self-destruct alarm", async () => {
      const code = "WSG";
      const first = await connectAndJoin(code, "A");
      const welcome = first.inbox[0] as any;
      first.ws.close();
      await sleep(50); // schedule alarm
      const { ws } = await openSocket(code);
      ws.send(JSON.stringify({
        v: 1, t: "reconnect", playerId: welcome.playerId, token: welcome.token,
      }));
      await sleep(50);
      const ran = await runDurableObjectAlarm(env.ROOMS_DO.get(env.ROOMS_DO.idFromName(code)));
      expect(ran).toBe(false);
      ws.close();
    });
  });
});
