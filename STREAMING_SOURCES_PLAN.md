# Streaming Sources Plan & Reference

> **Purpose:** This file is the master reference for the streaming-sources work. It captures:
> 1. The full history of what was done and why.
> 2. The current state of every source.
> 3. The exact edits still needed to finish the migration to the canonical domains (`vidsrcme.ru` + `vidsrc.to` + `player.videasy.to`).
> 4. The original documentation the user pasted, so a new chat session can read everything in one place.
>
> **When continuing this work, start with "Step A — Finish the provider registry migration" below.**

---

## TL;DR — what works right now and what doesn't

### Sources that work (kept in the player)
| Provider | URL pattern | Notes |
| --- | --- | --- |
| **VidSrc (canonical)** | `https://vidsrcme.ru/embed/{movie\|tv}/{id}{?se,?ep}` | Accepts IMDB `tt...` or TMDB numeric ids. `?ds_lang=en,fr,de` pre-selects subtitle. **PRIMARY default.** |
| **VidSrc.to** | `https://vidsrc.to/embed/{movie\|tv}/{id}{?se,?ep}` | Per-domain mirror. `?sub_file=...` for custom subs. Fallback. |
| **Videasy (canonical)** | `https://player.videasy.to/{movie/...\|tv/.../.../...}` | New canonical domain per docs. Old `.net` is deprecated. |
| **VidLink** | `https://vidlink.pro/{movie/...\|tv/.../.../...}?autoplay=true` | 4K-aware, JWPlayer mode available. |
| **VidFast** | `https://vidfast.pro/movie/{id}?autoPlay=true&sub=...` | Works per user. URL format from the user's docs. |
| **YapGrid** | `https://yapgrid.com/embed/{movie\|tv}/{id}/{se}/{ep}?server=sg_g4&lang=en` | Server token `sg_g4` is the only one that works. User says keep it. |

### Sources that don't work (already removed)
| Provider | Why removed |
| --- | --- |
| `vidsrc.sbs` | Returns 200 with body "This content is blocked. Contact the site owner to fix the issue." |
| `vidsrc.me` / `.pm` / `.in` / `.su` | User flagged `.pm` as dead. The other mirrors are stale — `vidsrcme.ru` is the canonical one per current docs. |
| `multiembed.mov` (SuperEmbed) | Returns 200 with same "blocked" body. |
| `embed.su` | DNS no longer resolves. |
| `player.videasy.net` | Superseded by `player.videasy.to` per current docs. |
| `2embed.cc` | Returns 200 but the embed route body is a thin shell that shows as a blank iframe. |

---

## Step A — finish the provider-registry migration (the only thing left to ship)

The current commit on `origin/master` is in a half-finished state: the source list, the URL builders, the `ALLOWED_EMBED_HOSTS`, and the CSP are updated. But the in-player provider registry still has stale domain names. Need to finish the following in order:

### A1. Update `src/lib/player/providerRegistry.ts`

The current file still has:
```ts
export type EmbedProvider =
  | "vidsrc"
  | "vidlink"
  | "videasy"
  | "vidfast"
  | "twoembed"
  | "embedsu"
  | "superembed"
  | "yapgrid"
  | "generic";
```

And the entry:
```ts
{ id: "vidsrc", ..., origins: ["vidsrc.me"], ... }
```

Tasks:
- Remove `"embedsu"`, `"superembed"`, `"twoembed"` from the `EmbedProvider` union (they no longer have working sources).
- Change `vidsrc` entry's `origins: ["vidsrc.me"]` to `origins: ["vidsrcme.ru", "vidsrc.to", "vidsrc.me"]` (canonical first, mirrors as fallback).
- Change `videasy` entry's `origins: ["videasy.net", "player.videasy.net"]` to `origins: ["player.videasy.to", "videasy.to", "player.videasy.net"]`.
- Drop the "twoembed" and "embedsu" entries entirely.
- Keep `vidlink`, `vidfast`, `yapgrid` as-is (just verify their origin lists are correct — `["vidlink.pro"]`, `["vidfast.pro"]`, `["yapgrid.com", "www.yapgrid.com"]`).
- If there is a "superembed" entry, remove it.
- Add a new "vidsrc-to" or just rely on the multi-origin list above.

### A2. Update `src/lib/player/embedSeekUrls.ts`

The current code has a check like:
```ts
if (/vidsrc\.(me|net|in|pm|xyz|cc|icu)/.test(url)) { ... }
```

Tasks:
- Update the regex to match the new canonical domain pattern: `/vidsrc(me\.ru|to|\.me)/.test(url)`.
- Add a `videasy.to` check: `/player\.videasy\.to|videasy\.to/.test(url)`.
- Remove any superembed/embed-su/vidsrc-sbs specific paths.

### A3. Build, test, commit, push

After A1 and A2:
1. `Remove-Item .next -Recurse -Force` and `npm run build` — must be clean.
2. `git add -A && git commit -m "fix(sources): migrate provider registry to canonical vidsrcme.ru / vidsrc.to / player.videasy.to"`
3. `git push origin master`

---

## History — what was already done (in commit order)

### Commit `8d9a724` — `fix(yapgrid): use real server tokens`
- Replaced short `x|y|z` lane IDs with the real `sg_g4|sx_a1|sy_b2|sz_c3` tokens found by inspecting YapGrid's test player JS bundle. G (sg_g4) was promoted to first.

### Commit `3812696` — `fix(subs): switch to vidsrc.sbs as primary, pass ?sub=<lang>`
- Initially promoted `vidsrc.sbs` based on its docs, but the user later confirmed it blocks us with a "contact the site owner" body.

### Commit `ccc2a60` — `fix(sources): promote vidsrc to first source so ?sub=<lang> is active by default`
- Moved vidsrc from 4th to 1st position. But the user pointed out the URL was `vidsrc.sbs` (which is blocked), so the order alone wasn't enough.

### Commit `4737eb6` — `fix(sources): replace dead sources + switch vidsrc mirror`
- Switched primary from `vidsrc.sbs` → `vidsrc.me`.
- Added `vidsrc.pm` and `vidsrc.to` as fallbacks.
- Removed `multiembed.mov` (blocked), `embed.su` (dead DNS).
- Kept `vidfast.pro` even though it 404'd in our tests, because the user said it works on the actual site.
- Kept `yapgrid.com` per user request.

### Commit-in-progress — what was just done before this plan
- Updated `vidsrcBase` from `https://vidsrc.sbs/embed/movie/{id}` to `https://vidsrcme.ru/embed/movie/{id}` (canonical per current docs).
- Updated `vidsrcBaseTo` to use `https://vidsrc.to/embed/movie/{id}`.
- Updated `vidsrcUrl` to append `?ds_lang=en` (or `sq`) — VidSrc's documented default-subtitle param.
- Replaced `player.videasy.net/movie/...` with `player.videasy.to/movie/...` (canonical per docs).
- Removed the now-dead `vidsrc.me/pm/in/su` entries.
- Removed `player.videasy.net` (deprecated per docs).
- Updated `ALLOWED_EMBED_HOSTS` to `["vidsrcme.ru", "vidsrc.to", "vidlink.pro", "videasy.to", "player.videasy.to", "vidfast.pro", "yapgrid.com"]`.
- Updated the CSP `frame-src` in `src/lib/security-headers.ts` to match.
- Re-added YapGrid as a last-resort fallback (id `yapgrid-g`, references the already-built `yapgridSources[0].providerUrl`).
- `2embed.cc` was removed (only thin-body, useless).

**What's still missing from the commit:** I stopped editing before touching `src/lib/player/providerRegistry.ts` and `src/lib/player/embedSeekUrls.ts`. Those two files still reference the old domain names (`vidsrc.me`, `videasy.net`, `superembed`, `embedsu`, `twoembed`). See Step A above.

---

## Reference — the original documentation the user pasted

### Doc 1 — VidSrc (vidsrcme.ru) — the canonical VidSrc docs

> **API Documentation**
> Complete guide to embedding movies and TV shows on your website using VidSrc. One iframe, one URL — no API key, no sign-up required.
>
> Free forever. Copy an embed URL, drop it in an iframe, and you're live. All domains serve identical content — use any mirror if one is unavailable in your region.

> **Quick Start — Movie**
> ```html
> <iframe
>   src="https://vidsrcme.ru/embed/movie/tt1300854"
>   width="100%" height="560"
>   frameborder="0" allowfullscreen
> ></iframe>
> ```

> **Custom Domain** (point your own DNS at VidSrc to remove ads and branding).

> **GET /embed/movie/{id}** — accepts IMDB id (`tt...`) or numeric TMDB id.
> Examples:
> - `https://vidsrcme.ru/embed/movie/tt1300854`
> - `https://vidsrcme.ru/embed/movie/786892`

> **GET /embed/tv/{id}/{season}/{episode}** — accepts IMDB id or TMDB id.
> Example: `https://vidsrcme.ru/embed/tv/1399/1/1`
> (omit season/episode to open the series with a built-in season/episode picker)

> **Query String Format** — alternative: `?imdb=tt...` or `?tmdb=...`
> Examples:
> - `https://vidsrcme.ru/embed/movie?imdb=tt1300854`
> - `https://vidsrcme.ru/embed/tv?tmdb=1399&season=1&episode=1`

> **Query Parameters:**
>
> | Parameter | Type | Description |
> | --- | --- | --- |
> | `autoplay` | 0/1 | Force autoplay on/off. Direct autoplay (no play button) works on **custom domains only** — the official/default domains always show a play button first. |
> | `autonext` | 0/1 | TV only. Auto-play next episode when current one ends (shows "Up next" countdown). |
> | `startAt` | float | Start at this timestamp in seconds (e.g. `startAt=300` = 5 minutes). |
>
> **Subtitles:**
> | Parameter | Type | Description |
> | --- | --- | --- |
> | `ds_lang` | string | Default subtitle language for auto-selection. Accepts ISO 639-1 (e.g. `en`) or 3-letter (e.g. `eng`). Pass comma-separated priority list of up to 3 — e.g. `en,fr,de` — and the player picks the first available. |
> | `sub_url` | URL | Load your own external subtitle file (.vtt or .srt) as a selectable, auto-applied track. File is fetched and converted to WebVTT in the viewer's browser only. Host must send CORS (`Access-Control-Allow-Origin`). Must be `https://`. |
> | `sub_label` | string | Display name for the `sub_url` track (e.g. "English"). |
> | `sub_lang` | string | Language code for the `sub_url` track (e.g. `en`). |
>
> Examples:
> - `https://vidsrcme.ru/embed/movie/tt1300854?ds_lang=en`
> - `https://vidsrcme.ru/embed/movie/tt1300854?ds_lang=en,fr,de`
> - `https://vidsrcme.ru/embed/movie/tt1300854?sub_url=https://example.com/subs/en.vtt&sub_label=English&sub_lang=en`

> Built-in subtitles are automatic — no configuration needed. The player shows every available track and prefers the video-extracted ones. Use `ds_lang` to set the default.

> **Player Events** (postMessage to parent):
> ```json
> {
>   "type": "PLAYER_EVENT",
>   "data": {
>     "player_info": { "imdb": "tt1300854", "tmdb": null, "mediaType": "movie", "season": null, "episode": null },
>     "player_status": "playing",  // "playing" | "paused" | "completed" | "seeked"
>     "player_progress": 125.4,
>     "player_duration": 7200
>   }
> }
> ```

> **Resume Playback** — save `player_progress` to localStorage, then use `?startAt={saved}` on next load.

> **Latest Content Lists** (no auth, ~5 min cache):
> - `https://vidsrcme.ru/movies/latest/page-1.json`
> - `https://vidsrcme.ru/tvshows/latest/page-1.json`
> - `https://vidsrcme.ru/episodes/latest/page-1.json`
> Each returns `{ "result": [...], "pages": <total> }`.

> **Content ID Lists** (CORS enabled, daily updated):
> - `https://vidsrcme.ru/ids/movie_imdb.txt`
> - `https://vidsrcme.ru/ids/movie_tmdb.txt`
> - `https://vidsrcme.ru/ids/tv_imdb.txt`
> - `https://vidsrcme.ru/ids/tv_tmdb.txt`
> - `https://vidsrcme.ru/ids/eps_imdb.txt`
> - `https://vidsrcme.ru/ids/eps_tmdb.txt`

### Doc 2 — VidSrc.to (vidsrc.to) — the per-domain mirror

> **API Documentation**
> Detailed representation of the API endpoints for Vidsrc includes comprehensive information regarding the available methods, request formats, required parameters and optional parameters.
>
> **GET /embed/movie/{id}**
> - `{id}` required — from imdb.com or themoviedb.com. IMDB id must have `tt` prefix.
> Examples:
> - `https://vidsrc.to/embed/movie/tt17048514`
> - `https://vidsrc.to/embed/movie/927085`
>
> **GET /embed/tv/{id}.html** (legacy)
>
> **GET /embed/tv/{id}/{season}** (legacy)
>
> **GET /embed/tv/{id}/{season}/{episode}**
> Examples:
> - `https://vidsrc.to/embed/tv/tt18382028/1/1`
> - `https://vidsrc.to/embed/tv/158876/1/1`
> - `https://vidsrc.to/embed/tv/tt18382028/1`
> - `https://vidsrc.to/embed/tv/tt18382028/1/5`
> - `https://vidsrc.to/embed/tv/158876/1/5`
>
> **GET /vapi/movie/{type}/{page}** — `type` = "new" or "add".
> - `https://vidsrc.to/vapi/movie/new`
> - `https://vidsrc.to/vapi/movie/new/15`
> - `https://vidsrc.to/vapi/movie/add`
> - `https://vidsrc.to/vapi/movie/add/15`
>
> **GET /vapi/tv/{type}/{page}** — same.
>
> **GET /vapi/episode/latest/{page}**
> - `https://vidsrc.to/vapi/episode/latest`
> - `https://vidsrc.to/vapi/episode/latest/15`
>
> **Custom subtitles (single):**
> `?sub_file=https://domain.com/file.vtt&sub_label=English`
>
> **Custom subtitles (multiple):**
> `?sub.info={json}` where the JSON is:
> ```json
> [
>   { "file": "https://domain.com/file1.vtt", "label": "English", "kind": "captions" },
>   { "file": "https://domain.com/file2.vtt", "label": "Japanese", "kind": "captions" }
> ]
> ```
> Either `sub_file` or `sub.info` must have `Access-Control-Allow-Origin: *`.

### Doc 3 — Videasy (player.videasy.to) — the canonical Videasy docs

> **Welcome to VIDEASY documentation.** Our player can be easily integrated into any website using simple iframe embeds.
>
> **Basic Implementation:**
> ```html
> <iframe
>   src="https://player.videasy.to/movie/299534"
>   width="100%" height="100%"
>   frameborder="0" allowfullscreen
>   allow="encrypted-media"
> ></iframe>
> ```
>
> **URL Structure:**
>
> | Type | URL | Example |
> | --- | --- | --- |
> | Movies | `https://player.videasy.to/movie/{movie_id}` | `https://player.videasy.to/movie/299534` |
> | TV Shows | `https://player.videasy.to/tv/{show_id}/{season}/{episode}` | `https://player.videasy.to/tv/1399/1/1` |
> | Anime Shows | `https://player.videasy.to/anime/{anilist_id}/{episode}` | `https://player.videasy.to/anime/21/1` |
> | Anime Movies | `https://player.videasy.to/anime/{anilist_id}` | `https://player.videasy.to/anime/145139` |
> (Anime auto-provides subbed and dubbed; for shows include episode; for movies only the AniList ID.)
>
> **Customization:**
>
> | Parameter | Description |
> | --- | --- |
> | `?color=8B5CF6` | Accent color (hex without `#`). E.g. `8B5CF6` (purple), `3B82F6` (blue). |
> | `?progress=120` | Start at 2 minutes (seconds). |
> | `?nextEpisode=true` | Show "next episode" button. |
> | `?episodeSelector=true` | Show built-in season/episode selector. |
> | `?autoplayNextEpisode=true` | Auto-play next episode when current ends. |
> | `?overlay=true` | Netflix-style overlay when paused without interaction for 5s. |
>
> **Watch Progress Tracking** (postMessage):
> - Player sends `{ id, type, progress, timestamp, duration, season?, episode? }` to parent.
>
> **Finding Content IDs:**
> - TMDB: `themoviedb.org/movie/{id}` or `themoviedb.org/tv/{id}`
> - AniList: `anilist.co/anime/{id}`

### Doc 4 — VidLink (vidlink.pro) — already known docs

> Movie: `https://vidlink.pro/movie/{tmdbId}`
> TV: `https://vidlink.pro/tv/{tmdbId}/{season}/{episode}`
> Anime: `https://vidlink.pro/anime/{MALid}/{number}/{subOrDub}` with `?fallback=true`
> Customization: `?primaryColor=...&secondaryColor=...&icons=vid|default&iconColor=...&title=...&poster=...&autoplay=...&nextbutton=...&player=jw|default&startAt=60`
> Subtitle injection: `?sub_file=URL&sub_label=English&sub_lang=en`
> Fallback: `?fallback_url=URL`

### Doc 5 — VidFast (vidfast.pro) — the user-provided docs

> **Movie Embed**
> Endpoint: `https://vidfast.vc/movie/{id}?autoPlay=true`
> - `{id}` from IMDB or TMDB.
> - Optional: `title`, `poster`, `autoPlay`, `startAt`, `theme`, `server`, `hideServer`, `fullscreenButton`, `chromecast`, **`sub` (e.g. `en, es, fr`)**.
> Examples:
> - `https://vidfast.vc/movie/tt6263850`
> - `https://vidfast.vc/movie/533535?theme=16A085`
>
> **TV Show Embed**
> Endpoint: `https://vidfast.vc/tv/{id}/{season}/{episode}?autoPlay=true`
> Optional: `title`, `poster`, `autoPlay`, `startAt`, `theme`, `nextButton`, `autoNext`, `server`, `hideServer`, `fullscreenButton`, `chromecast`, `sub`.
> Examples:
> - `https://vidfast.vc/tv/tt4052886/1/5`
> - `https://vidfast.vc/tv/63174/1/5?nextButton=true&autoNext=true`
>
> **Color Themes:** hex without `#` (e.g. `16A085` green, `2980B9` blue, `9B59B6` purple).
>
> **Feature Compatibility:**
> | Feature | Movies | TV Shows |
> | --- | --- | --- |
> | Color Themes | ✓ | ✓ |
> | AutoPlay | ✓ | ✓ |
> | Start Time | ✓ | ✓ |
> | Poster Display | ✓ | ✓ |
> | Next Episode | ✗ | ✓ |
> | Auto Next | ✗ | ✓ |
>
> **Events & Progress Tracking** (postMessage to parent):
> - `play` / `pause` / `seeked` / `ended` / `timeupdate` / `playerstatus` events
> - Payload: `{ type: "PLAYER_EVENT", data: { event, currentTime, duration, tmdbId, mediaType, season?, episode?, playing, muted, volume } }`
>
> **Direct Media Data Event:**
> Payload: `{ type: "MEDIA_DATA", data: { ... } }` — full media info for saving watch progress.
>
> **PostMessage API Control** (for watch parties):
> - `iframe.contentWindow.postMessage({ command: 'play' }, '*')`
> - `iframe.contentWindow.postMessage({ command: 'pause' }, '*')`
> - `iframe.contentWindow.postMessage({ command: 'seek', time: 120 }, '*')`
> - `iframe.contentWindow.postMessage({ command: 'volume', level: 0.5 }, '*')`
> - `iframe.contentWindow.postMessage({ command: 'mute', muted: true }, '*')`
> - `iframe.contentWindow.postMessage({ command: 'getStatus' }, '*')`
> Works across all VidFast domains: `vidfast.pro`, `.in`, `.io`, `.me`, `.net`, `.pm`, `.xyz`, `.vc`, `.bz`.

### Doc 6 — YapGrid (yapgrid.com) — already known docs

> Server tokens: `sg_g4` (G, default, Vidrock Edge / direct MP4), `sx_a1` (X, Primary CDN), `sy_b2` (Y, Backup CDN), `sz_c3` (Z, Edge CDN).
> Short labels `x|y|z` are display-only and do NOT work as `?server=` values — they fall back to "auto" which is what gave us Hindi audio.
> URL: `https://yapgrid.com/embed/{movie|tv}/{id}/{se}/{ep}?server=sg_g4&lang=en`
> Optional: `?autoplay=true&title=...&theme=red&sub_url=...&sub_lang=sq&sub_label=Albanian`

---

## Verification checklist before pushing

After finishing the provider-registry migration (Step A), confirm:

1. `npm run build` succeeds — 72 routes generated.
2. `git show origin/master:src/lib/streamingSources.ts` shows the order:
   `vidsrc → vidsrc-to → videasy → vidlink → vidfast → yapgrid-g`
3. `git show origin/master:src/lib/streamingSources.ts | grep ALLOWED_EMBED_HOSTS` returns the canonical set:
   `["vidsrcme.ru", "vidsrc.to", "vidlink.pro", "videasy.to", "player.videasy.to", "vidfast.pro", "yapgrid.com"]`
4. `git show origin/master:src/lib/security-headers.ts | grep vidsrcme` shows the canonical domain in frame-src.
5. `git show origin/master:src/lib/player/providerRegistry.ts | grep "origins:"` shows the same canonical domains for the vidsrc and videasy entries.
6. `git show origin/master:src/lib/player/embedSeekUrls.ts | grep vidsrc` shows the regex updated to match `vidsrcme\.ru|vidsrc\.to|vidsrc\.me`.

---

## Final commit message to use

```
fix(sources): migrate provider registry to canonical vidsrcme.ru / vidsrc.to / player.videasy.to

- src/lib/player/providerRegistry.ts: replace vidsrc.me -> vidsrcme.ru
  (and add vidsrc.to + vidsrc.me as mirrors); replace player.videasy.net
  -> player.videasy.to (and add videasy.to as mirror). Drop dead entries
  (embedsu, superembed, twoembed).
- src/lib/player/embedSeekUrls.ts: update provider-detection regex to
  match the new canonical domains.

Together with the previous streamingSources.ts + security-headers.ts
+ ALLOWED_EMBED_HOSTS commit (4737eb6), this completes the migration to
the canonical domains documented by the providers. vidsrcme.ru is now
the primary subtitle-aware source, with vidsrc.to as fallback, videasy.to
as the canonical Videasy, and YapGrid / VidLink / VidFast as final
fallbacks.
```

---

## Honest note on what we couldn't do

The user has been asking for the audio track to be in the user's chosen language (English or Albanian) on every video. **None of the public embed providers expose audio-language selection in their public query API.** The `ds_lang` / `sub` parameters they expose only control **subtitle language** (which is what we wired up). The audio track is whatever the upstream source has, and the upstream's choice is opaque to us. So when the user picks "Albanian" via the in-player CC menu, they get **Albanian subtitles** on top of whatever audio the source has. If the audio itself is Hindi, that's a YapGrid server-level decision and we cannot override it without reverse-engineering their backend API. The closest thing to a workaround is the `?server=sg_g4` parameter which selects the server most likely to have English audio — and that's already in the YapGrid embed URL.
