# Capturing at scale

A one-time **backfill** of your whole history, then run `grab` again whenever
you want to pick up new work.

grab is incremental — a per-session watermark means every run only processes
messages newer than the last run. Re-running is cheap and safe.

## One-time backfill

Point grab at all your history and publish in one step. Choose an extractor:

- `--extractor host` — uses your logged-in `claude` CLI (your Claude
  subscription, no per-token cost). Best marks; subject to your plan's usage
  limits, so a huge backfill runs in bursts. Raise `--concurrency` cautiously
  (2 is plenty — each chunk spawns a CLI process).
- `--extractor ollama --base-url http://localhost:11434/v1 --model qwen2.5:3b`
  — fully local, no account limits, `--concurrency 4` safe.
- `--extractor openai --base-url <endpoint> --model <model>` (needs the
  endpoint's API key in your config) — fastest; `--concurrency 8` fine.
- `--extractor anthropic --api-key sk-ant-...` (or set `extraction.apiKey` in
  config) — native Anthropic Messages API. Pay-per-token on your API key, but
  the big system prompt (taxonomy + examples) is **cached**, so after the first
  chunk you stop re-billing it (see below). Fast — no per-call process boot like
  `host`. `--concurrency 8` fine. Default model `claude-haiku-4-5-20251001`;
  override with `--model`.

```bash
cd "$HANDPRINT_ROOT"          # where your handprints are stored
handprint grab --push -y --extractor host --concurrency 2
```

Push batches to the hub automatically (500 per request, retried on rate
limit). If a run is interrupted, just run it again — it resumes from the
watermark. Artifacts (which repo each handprint belongs to) are inferred from
the files each conversation touched, so nothing lands in "other" that has a
real repo behind it.

### Which extractor?

Every chunk of a backfill sends the same large system prompt (the decision
taxonomy plus few-shot examples). The `anthropic` extractor marks that prompt
with a cache block, so Anthropic writes it to cache on the first chunk and
**reads it from cache on every chunk after** — you are not billed the full
prompt again and again, only the small per-chunk conversation window. `host`
and the openai-compatible path have no such caching and resend the whole prompt
each time.

| Extractor        | Cost                          | Speed                        | Where it runs        |
| ---------------- | ----------------------------- | ---------------------------- | -------------------- |
| `host`           | Free (your Claude sub)        | Slow (spawns a CLI per chunk)| Cloud (your agent)   |
| `anthropic`      | Paid per token, **cached**    | Fast (direct API, cached prompt) | Cloud (Anthropic API) |
| `ollama` / `local` | Free                        | Depends on your hardware     | On your machine      |

Pick `host` for a free backfill you can leave running in bursts, `anthropic`
when you want it done fast and don't mind paying (the caching keeps that cheap),
and `ollama`/`local` to keep everything on-machine.

## Ongoing capture

Handprint has no background process of any kind — no agent hook, no daemon,
no timer. Run `handprint grab` yourself whenever you want to pick up new work;
the watermark means it only processes what's new since the last run, so it's
cheap to run often.

We tried both a Claude Code Stop-hook and a launchd timer and pulled both.
The Stop-hook's debounce was a plain timestamp file: with several concurrent
agent sessions, simultaneous Stop events could race past that check before
any of them recorded a run, so more than one detached `grab --push` launched
at once — each one a memory-hungry background process, and a machine running
many sessions could end up with several piled up at once. The timer avoided
that specific race (a lock file instead of a timestamp), but it's still a
background process running on your machine on a schedule you don't control
in the moment, extracting and encrypting conversation content whether or not
you're thinking about it right then. Manual `grab` means capture only ever
happens when you decide to run it.
