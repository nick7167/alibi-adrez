# Alibi (v1) — archived

The first game this codebase hosted: two players secretly shared a made-up
alibi, the others interrogated them separately and voted on whether the story
held up. It was complete and deployed. The concept was retired because it took
a paragraph to explain, required the suspects to coordinate under time pressure,
ran slowly, and left most of the room passive.

- Code: tag `alibi-v1.0`, branch `archive/alibi-v1`
- The `alibi-web` / `alibi-rooms` Cloudflare workers keep serving that build
  until the replacement is ready, so a playable copy stays live.

## Why these files are kept

`plan2-ledger.md` is the valuable one. Its rulings were paid for in debugging
and still bind the new game:

- one alarm slot arbitrating the phase deadline against the idle self-destruct;
- catching up expired phases before judging any client message;
- deadline-based countdowns (server sends its clock) instead of per-second ticks;
- hidden fields must be *absent* from snapshots, never blanked;
- tests wait for a condition, never sleep for a socket frame;
- the evidence accent flips to sunshine on dark fields (contrast);
- svelte-check's tag-scanner trips on tag-like text inside `<script>` comments.

The design spec is kept for the parts that outlived the concept — room codes,
personalized snapshots, per-player language, the Cloudflare architecture.
