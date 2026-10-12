# Rust Wipe Bot

Discord bot that shows wipe information for Rust server networks via the `/wipe` slash command:

- `/wipe` — overview: one field per network — the earliest upcoming wipe among its servers with that server's name and its `connect` string (code block), the most recent wipe (if within 24 h) and the server count.
- `/wipe network:<choice>` — the servers of one network (top 25 by online), each with the next wipe, time since the last wipe (if within 24 h) and its `connect` string (code block).
- `/wipe server:<autocomplete>` — a single server: next wipe, time since the last wipe, online and map.
- Replies are in Russian.

## Requirements

- Node.js 20 or newer (LTS recommended)
- An application in the [Discord Developer Portal](https://discord.com/developers/applications)
- A BattleMetrics API key for `https://battlemetrics.ru`

## Installation

```bash
npm install
copy .env.example .env
```

Fill in `.env` (see below), then generate the server registry:

```bash
npm run generate
```

This searches the six networks (survivors, magic rust, rust room, atlas, warbandits, восток), takes every matching server and writes `servers.json`. Each entry gets a wipe schedule inferred from the server's own last wipe: weekly on the wipe weekday at the wipe time, or monthly (first weekday of the month) when the name contains "Monthly" or the wipe fell on the 1st–3rd. Review the file and fix any wrong entries — wrong inference only affects that server's "next wipe" line. Never commit `.env` — it is already listed in `.gitignore`.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token from the Discord Developer Portal (Bot → Reset Token) |
| `CLIENT_ID` | yes | Application ID from the Discord Developer Portal |
| `GUILD_ID` | no | Server ID for fast command registration during development. If omitted, commands are registered globally (may take up to 1 hour to appear) |
| `BATTLEMETRICS_API_KEY` | yes | API key, sent as `Authorization: Bearer <key>` |
| `TIMEZONE` | no | IANA timezone used for all schedule calculations, default `Europe/Moscow`. The host machine's local timezone is never used |
| `LAST_WIPE_THRESHOLD_HOURS` | no | The "time since last wipe" line is shown only while the elapsed time is within this many hours, default `24` (exactly 24 h still shows) |

Per-server wipe schedules live in `servers.json` as `{ id, label, network, schedule }`. The `schedule` value uses the same format as before:

- `type=weekly;day=4;time=19:00` — every Thursday at 19:00
- `type=monthly;week=1;day=4;time=14:00` — the first Thursday of every month
- `type=fixed;date=2026-11-05;time=14:00` — a one-time wipe

Days use ISO numbering: `1` = Monday … `7` = Sunday. Times are `HH:mm` in `TIMEZONE`.

## Slash command registration

```bash
npm run deploy
```

With `GUILD_ID` set, the command appears in that server instantly. Without it, the command is registered globally and can take up to an hour to propagate.

## Running

```bash
npm start
```

## Tests

```bash
npm test
```

The suite covers next-wipe calculation for all three schedule types (including month rollover, year rollover, midnight crossing, exact-time boundaries and different timezones), duration formatting (including exactly 24 hours), the 24-hour display threshold (2 h / 23 h / 24 h shown, 25 h hidden), schedule inference for the generator, the server registry (validation, lookups, autocomplete), the BattleMetrics search service (mapping, caching, retries, timeouts, errors) with a fake `fetch`, and the embed builders for all three command levels.

## Project structure

```
src/index.js                    client startup, dispatch, autocomplete handling
src/commands/wipe.js            /wipe command and embed builders
src/services/battlemetrics.js   BattleMetrics search requests (cache, timeout, retries)
src/services/serverRegistry.js  servers.json loading, validation and lookups
src/services/wipeSchedule.js    next wipe calculation and display threshold
src/utils/formatDuration.js     duration formatting in Russian
src/scripts/generate-servers.js servers.json generator with schedule inference
src/deploy-commands.js          slash command registration
servers.json                    generated server registry (editable)
test/                           unit tests (node:test)
```

## Data source

Live server data comes from `GET https://battlemetrics.ru/api/v1/servers?game=rust&q=<network>` — one request per network returns every matching server including `last_wipe` (ISO 8601, UTC). Responses are cached for 60 seconds; requests time out after 10 seconds and are retried once. If the API is unavailable, the bot still shows schedule-based lines and hides the live ones instead of crashing. The next wipe is calculated from the per-server schedule in `servers.json`, because the API does not provide it (the `/wipes` endpoint is capped at 50 entries and a two-week window, which is not reliable for a specific set of servers).

## Discord Developer Portal setup

1. Go to https://discord.com/developers/applications and click **New Application**. The name is up to you.
2. Copy the **Application ID** from the General Information page — this is `CLIENT_ID`.
3. Open the **Bot** page, click **Reset Token** and copy the token — this is `DISCORD_TOKEN`. Keep it secret.
4. No privileged intents are needed: the bot only answers slash commands.
5. Invite the bot: open **OAuth2 → URL Generator**, check the scopes **`bot`** and **`applications.commands`**, then in Bot Permissions check **View Channel**, **Send Messages** and **Embed Links**. Open the generated URL and select your server (you need the Manage Server permission there).
6. To get `GUILD_ID`: in Discord open Settings → Advanced → enable **Developer Mode**, then right-click your server → **Copy Server ID**.

## Troubleshooting

- `Missing required environment variable ...` — `.env` is incomplete or the bot was started from a different directory.
- `Failed to read server registry` — run `npm run generate` from the project root before starting the bot.
- `BattleMetrics API returned status 401` — the API key is invalid or expired, issue a new one in your battlemetrics.ru profile.
- The `/wipe` command does not appear — run `npm run deploy`; if `GUILD_ID` is not set, wait for global propagation or re-invite the bot.
- Wrong "next wipe" for one server — fix its `schedule` in `servers.json`; rerunning `npm run generate` resets manual edits.
- A network search matched an unrelated server (for example "BestAtlas" under "atlas") — delete that entry from `servers.json` and rerun `npm run deploy` (choices are built from the registry).
- `Invalid TIMEZONE` — use an IANA name such as `Europe/Moscow` or `UTC`.
