---
name: handprint
description: Capture and publish the human decisions from your AI work as signed handprints on handprint.sh. Use when the user says "handprint this", "leave a handprint", invokes /handprint, or asks to capture or publish the decisions from this session or recent work.
---

# Handprint: capture and publish your decisions

Leave a signed, verifiable record of the human decisions in your AI sessions, then publish them to your handprint.sh profile. This skill only orchestrates the `handprint` CLI. Never invent or embellish decisions; the CLI's extractor does the reading.

## Before you start

Run `handprint --version`. If the command is missing, tell the user to install it with `npm i -g handprint-sh` and stop.

## 1. Ask how far back

Ask the user which window to capture. Offer these, with **Today** as the default:

- Today (default)
- Last 3 days
- Last 7 days
- Everything new since the last capture

Map the answer to a window flag:

- Today: `--days 1`
- Last 3 days: `--days 3`
- Last 7 days: `--days 7`
- Everything new: omit the flag

If the user wants to limit it to the current project, add `--project <name>`.

## 2. Preview the size first

Run `handprint grab <window> --dry-run`. This does no model calls. Show the user the plan it prints: how many sessions and the rough token estimate, and whether it runs on their machine or bills an agent quota. If the window is large (for example "everything new" on a first capture), say so and suggest a smaller window before continuing. Captures are incremental, so anything already captured is skipped automatically.

## 3. Capture (grab = extract, sign, store locally)

Run `handprint grab <window> -y` to extract the decisions, sign them, and append them to the local chain. Report a short summary: how many handprints were created and a few of the decision notes. If the extractor is not ready, relay the one-line fix the CLI prints (for example install node-llama-cpp, start Ollama, or use `--extractor host`) and stop.

## 4. Publish (push), by default

Then run `handprint push` to publish the new handprints to the hub. New handprints are **unlisted** by default: their metadata is searchable, but they are not listed on the public profile.

If `push` reports that the user is not logged in, run `handprint login`. It prints a URL and a code for the user to approve in the browser. Wait for them to confirm, then run `handprint push` again.

If the user asked to keep the capture local, skip this step and tell them how to publish later (`handprint push`).

## 5. Report

Tell the user:

- how many decisions were captured and published,
- that they are unlisted by default and can be made public from the handprint.sh dashboard,
- their profile link, from `handprint status`, if available.

Never fabricate decisions, and never push anything the user did not ask to capture.

## Optional: offer ambient capture

If the user captures often, mention they can capture automatically without
running this each time: wire `handprint hook` to Claude Code's **Stop** hook by
merging `integrations/claude/settings.snippet.json` into `~/.claude/settings.json`.
It's debounced and runs detached, so it never slows Claude down, and grab is
incremental + idempotent so nothing is captured twice. Only suggest it; never
edit their settings without asking.
