# Obsidian Collaborative Folders

[![Obsidian Collaborative Folders](apps/server/media/collaborativefolders_header.png)](https://collaborativefolders.com)

Real-time, multiplayer shared folders and notes for [Obsidian](https://obsidian.md/). Deploy it yourself or use our hosted service — and either way, notes are encrypted end-to-end. Everything you love about Google Docs, but in your lovely local Obsidian instance. Fully MIT-licensed. 

**Warning: Beta software.** This project is still in active development and may contain bugs, breaking changes, data leakage, or data-loss risks; use at your own risk and keep backups of important vaults.

> **Note:** This is a personal fork of [abromberg/obsidian-collaborative-folders](https://github.com/abromberg/obsidian-collaborative-folders) maintained by [@aRandomHumanoid](https://github.com/aRandomHumanoid). It adds support for syncing tldraw-based Ink drawings without conflict-copy spam. See [Fork changes](#fork-changes) and [Known gaps](#known-gaps) below.

After installing the plugin, right click on a folder and select `Share folder...`. Send the invite URL to a friend or teammate and the folder will appear in their vault. You can see each others' cursors in the file and edit collaboratively in realtime. 

As long as Obsidian is open, updates you make will be synced to other people shared on the folder, so feel free to use Claude Code or your favorite AI tools on the shared folders and the changes will propagate automatically.

## Demo

https://github.com/user-attachments/assets/16018201-8fa3-456d-89f8-67fc776045ae

[Open demo video directly](https://collaborativefolders.com/media/collab_demo.mp4)

_This is a community plugin maintained by [Andy Bromberg](https://andybromberg.com) at Experimental LLC. Neither Andy nor Experimental LLC are affiliated with Obsidian._

## Fork Changes

This fork's diff against upstream is scoped to making the [Ink](https://github.com/daledesilva/obsidian_ink) plugin (tldraw-based handwriting/drawing) play nicely with shared folders. Upstream's blob sync creates a `(conflict N).<ext>` copy whenever local and remote bytes diverge for non-CRDT files. Ink saves a `.drawing` (or `.writing`) and a paired `.png` preview every 0.5–2 seconds while drawing, so each save would produce one or more conflict copies on the other device.

Versions are tagged on this fork's releases.

| Version | Change |
|---|---|
| `0.1.24` | Added `LWW_BLOB_EXTENSIONS = { '.drawing', '.writing' }` to [`packages/shared/src/constants.ts`](packages/shared/src/constants.ts). [`SharedFolderWatcher.applyRemoteBlob`](apps/plugin/src/collab/file-watcher.ts) now skips `preserveConflictCopy` for these extensions, and for `.png` files that have a sibling `.drawing`/`.writing` (Ink's auto-generated preview). Last-write-wins instead of conflict copies — acceptable because Ink doesn't support concurrent drawing on the same file anyway. |
| `0.1.25` | After writing an LWW blob, call `previewMode.rerender(true)` on open markdown views so embedded Ink renders pick up the new file content without needing to navigate away and back. |
| `0.1.26` | Replaced `previewMode.rerender(true)` (Reading mode only) with `leaf.rebuildView()`. Live Preview embeds now refresh too. Scroll position captured/restored via `currentMode.getScroll()` / `applyScroll()`. |
| `0.1.27` | Debounced the rebuild by 250ms so Ink's paired `.drawing` + `.png` save produces one rebuild instead of two. Switched scroll-restore timing from `setTimeout(0)` to double `requestAnimationFrame` for slower devices. |
| `0.1.28` | Replaced `getScroll`/`applyScroll` (unit-mismatched across modes, raced against `rebuildView`'s async file reload) with `leaf.getEphemeralState()` / `setEphemeralState()` — Obsidian's own scroll+cursor preservation mechanism, applied immediately and again on the second rAF as a safety net. |

## Known Gaps

Things known to be imperfect but not currently fixed. Listed roughly in order of impact.

- **Binary uploads have no persistent retry queue.** [`uploadBlobWithRetry`](apps/plugin/src/collab/blob-sync.ts) attempts each upload 3 times with exponential backoff (up to ~14 seconds total), then gives up. If you draw a lot while the server is unreachable, those drawings stay on local disk but never sync. Workaround: edit each file once more after reconnecting to retrigger the upload. Proper fix: a persisted "pending uploads" set drained on WebSocket reconnect and plugin startup.
- **Embed refresh scope is broad.** `refreshOpenMarkdownPreviews` rebuilds *every* open markdown view when an LWW blob lands, not just the views that actually embed the changed file. Wasteful when many notes are open. A proper fix would parse open notes' cached metadata for `handdrawn-ink` / `handwritten-ink` code blocks and rebuild only the matching ones.
- **No active-edit detection.** If you're typing in a markdown view in another tab when a `.drawing` lands from a remote device, the rebuild still fires and briefly disrupts your editor focus / selection. Could be skipped (or deferred) when the leaf has focus and the user is mid-edit.
- **Per-watcher debounce, not global.** Each shared folder gets its own `SharedFolderWatcher` with its own 250ms debounce timer. If two folders update simultaneously, you'd see two rebuild bursts. Trivial cost for the common case of one shared folder, but a singleton debounce would be cleaner.
- **`redeemInvite` doesn't normalize the Server URL.** [`apps/plugin/src/utils/auth.ts`](apps/plugin/src/utils/auth.ts) concatenates `serverUrl + '/api/invite/redeem'` directly. If the user's Server URL setting has a trailing slash, this produces `http://host:1234//api/invite/redeem` — a double-slash path Express 404s with HTML, which the plugin then surfaces as "Unknown error". The Test-Connection button uses `normalizeUrl()`, so the discrepancy is silent. Easy fix: normalize on read or at all HTTP call sites. (Hit this during initial setup of this fork.)
- **Conflict copies on non-Ink binaries still happen.** The LWW carve-out only covers `.drawing`, `.writing`, and their paired `.png`. Other frequently-rewritten binary formats (some image editors, file types with auto-saving) would still produce conflict copies. Not a regression — that's upstream behavior — just worth noting if someone runs into it.

## Installing Before Obsidian Community Approval

The valiant Obsidian plugin reviewing team is facing an onslaught of submissions. It may be weeks or months until they get to this one and add it to the real directory. Until then, you can install it with a helper plugin called [BRAT](https://tfthacker.com/BRAT).

1. [Install BRAT](https://obsidian.md/plugins?id=brat). Alternatively, in Obsidian, open `Settings` -> `Community plugins` and install `BRAT`. (You'll have to turn on `Community plugins` first if you haven't already)
2. Toggle BRAT "on" in the community plugins list.
3. Open BRAT settings and choose `Add beta plugin`.
4. Enter the BRAT-installable repo and hit `Add`:
   - For this fork (with Ink LWW fixes): `aRandomHumanoid/obsidian-collaborative-folders`
   - For upstream: `abromberg/obsidian-collaborative-folders-plugin`
5. On first launch the plugin opens an onboarding modal — enter your display name and choose a service mode:
   - **Hosted service** (recommended): enter your email, then verify it with a one-time code in plugin settings and subscribe
   - **Self-deployment**: follow the Server Deployment section below and enter your deployment URL

## (Optional) Server Deployment

[Render](https://render.com/) blueprint is included at [render.yaml](render.yaml). All you need to do is set up a new "Blueprint" deployment on Render, pasting in this repo's GitHub URL (`https://github.com/abromberg/obsidian-collaborative-folders`). Running such a server costs ~$9/month in Render costs (as of February 2026).

The hosted deployment URL is `https://collaborativefolders.com`. Paste that into Collaborative Folders plugin settings in Obsidian, then reload Obsidian.

## What This Repo Contains

- Obsidian plugin for sharing folders and the notes within them, with live collaborative editing.
- Collaboration server for auth, membership, invites, key lifecycle, encrypted document/blob relay, and realtime awareness signaling.
- Shared TypeScript package for protocol constants, payload types, and room naming.

> [!NOTE]
> There is a read-only sister repo https://github.com/abromberg/obsidian-collaborative-folders-plugin that houses plugin releases. Code changes, issues, and PRs should be made in the monorepo in which you're reading this (https://github.com/abromberg/obsidian-collaborative-folders), and updates are then regularly pushed to the sister repo for plugin releases.

## Security & Policy Disclosures

This section is intended to satisfy Obsidian's disclosure expectations for community plugins, based on the implementation in this repository.

- Network use: The plugin makes outbound HTTPS/WSS requests to the configured `Server URL` for invite creation/redeem, token refresh, folder membership APIs, key lifecycle APIs, realtime relay (encrypted document updates/snapshots plus awareness signaling), and encrypted blob upload/download.
- Account requirements:
  - Self-hosted mode: no account is required
  - Managed service mode (`https://collaborativefolders.com`): hosted account linking is required for invite redemption and billing access; each collaborator needs their own active subscription.
- Payments and paid features:
  - Self-hosted mode: no payments are required to run this code or use the product.
  - Managed service mode: no free tier, `$9 USD / subscribed user / month`, owner-level `3GB` total storage cap across owned shared folders, and `25MB` max uploaded blob size.
  - Managed service mode: when a hosted subscription becomes inactive (for example after cancellation period end), collaborator access is automatically offboarded (editor memberships removed, pending invites revoked). Existing local vault copies remain local but stop syncing.
- External file access:
  - Reads/writes only files and folders in the active Obsidian vault via Obsidian APIs.
  - Does not intentionally access files outside the vault.
- Ads: no advertising.
- Telemetry/analytics:
  - Plugin: no third-party analytics SDK or telemetry collector is integrated.
  - Server: writes security/audit events (for auth denials, invite/member mutations, rate-limit events, blob access, token lifecycle events)
- Data processed by the collaboration backend:
  - Control-plane metadata: folder IDs, room names (doc room names encode relative paths), member/client IDs, display names, roles, invite metadata (including optional invite labels), token-version state, and timestamps.
  - Credential artifacts: hashed invite tokens, hashed refresh tokens (with token families), revoked access-token JTIs, one-time WS tickets (stored hashed in-memory).
  - Key lifecycle data: client public keys, folder key epochs, and per-member wrapped content-key envelopes.
  - Content artifacts: encrypted document updates/snapshots and encrypted blobs (`ciphertext`, `nonce`, `aad`, `keyEpoch`, `digest` metadata).
  - Blob metadata: digest hashes, sizes, and storage paths.
- Retention and deletion:
  - Self-hosted mode: you (the operator) control retention/deletion of DB rows and blob files.
  - Managed service mode: policy is documented at https://collaborativefolders.com/privacy
- Privacy policy:
  - Self-hosted mode: governed by the operator of the server you deploy.
  - Managed service mode: https://collaborativefolders.com/privacy
- Source availability:
  - Plugin source: open source (MIT) in this repository.
  - Server source: open source (MIT) in this repository.

## Data Flow

For protocol details, see [Data Flow and Encryption](documentation/security/data-flow-encryption.md).

At a high level:
- Clients encrypt note and blob content locally before syncing.
- The server handles auth, membership, invites, key lifecycle, encrypted relay/storage, and awareness signaling.
- The server cannot read note/blob plaintext in transit or at rest.

## Monorepo Layout

```text
apps/
  plugin/    # Obsidian plugin (@obsidian-teams/plugin)
  server/    # REST + WebSocket server (@obsidian-teams/server)
packages/
  shared/    # Shared protocol/types/constants (@obsidian-teams/shared)
```

_Note: there is a [separate repo](https://github.com/abromberg/obsidian-collaborative-folders-plugin) with only the plugin code that is used for releases. This is to satisfy Obsidian's plugin-reviewing agent that doesn't handle the monorepo server code well._

## Tech Stack

- TypeScript (workspace-wide)
- `pnpm` workspaces + Turborepo
- Yjs CRDT sync + CodeMirror 6 integration
- Express + `ws` on the server
- SQLite (`better-sqlite3`) for server state

## Local Development

For prerequisites and quickstart setup, see [Local Development](documentation/local-development.md).

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a PR, and include clear reproduction steps or tests for bug fixes. Using AI is great, but please make sure you (the human) understand the existing codebase and the code you are submitting. I would strongly recommend writing the PR description yourself to ensure this is true.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
