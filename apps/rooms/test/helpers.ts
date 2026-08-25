import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { expect } from "vitest";

/**
 * Shared helpers for Durable Object socket tests.
 *
 * Ported VERBATIM from Alibi's `apps/rooms/test/round.test.ts` (deleted in T2)
 * because both survive the concept change unchanged, and both exist for a
 * reason that is easy to forget and expensive to rediscover.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Waits for `check` to become true rather than sleeping a fixed span. A fixed
 * sleep passes on an idle machine and loses the race under load — it made this
 * file flake in exactly that way, so socket frames are always awaited, never
 * assumed to have arrived.
 */
export async function until(check: () => boolean, what: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await sleep(10);
  }
  expect.fail(`timed out after ${timeoutMs}ms waiting for ${what}`);
}

export const stubFor = (code: string) => env.ROOMS_DO.get(env.ROOMS_DO.idFromName(code));

/**
 * Simulates the phase timer expiring: backdate the stored deadline (and the
 * instance's in-memory copy of it) and let the already-armed alarm run.
 *
 * Time is the awkward part of testing phase expiry: `runDurableObjectAlarm`
 * fires the alarm handler immediately regardless of when it was scheduled, and
 * there is no supported way to move the workerd clock. So instead of faking
 * the clock we backdate the deadline the alarm is waiting on — the state the
 * room would be in one phase later — and then run the alarm. The handler still
 * makes its real decision from the real `Date.now()`, which is what makes this
 * an honest test rather than a mock.
 */
export async function expirePhase(code: string): Promise<boolean> {
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
export async function expireIdle(code: string): Promise<boolean> {
  const stub = stubFor(code);
  await runInDurableObject(stub, async (_instance, state) => {
    const at = await state.storage.get<number>("destroyAt");
    if (at !== undefined) await state.storage.put("destroyAt", Date.now() - 1);
  });
  const ran = await runDurableObjectAlarm(stub);
  await sleep(50);
  return ran;
}
