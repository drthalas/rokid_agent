# ALE-469 — recoverable terminal errors

Canonical task: [ALE-469](https://linear.app/drthalas/issue/ALE-469).
Baseline: `953a790cd2d782cf0acadb71dc97be6882c14d47`; clean managed worktree,
matched to GitHub main on 2026-10-03. Mode: STANDARD, bounded client bug repair.

## Scope and acceptance

- A deliberate tap after a validated terminal error returns to READY. A second tap can
  record the next utterance in the same gateway session/thread. No session reset.
- Continuation requires a validated idle snapshot with explicit `uncertain=false`,
  valid authoritative history, and no pending mutation/approval. A failed read invalidates
  cached permission to submit; neither a stale terminal snapshot nor a malformed ACK
  authorizes a new turn.
- Connection/schema errors retry the same session. Pending mutation recovery uses the
  retained request UUID/body; no new mutation or approval replay is introduced.
- Uncertain outcomes remain blocked until reconciliation proves a terminal outcome.
- Preserve the error explanation in the HUD when acknowledging it and the canonical
  history across recovery/new turns. Do not upload local history as authority.
- Distinguish response decoding, snapshot shape and history failures in content-free
  local diagnostics with fixed stage/check codes and validated correlation UUIDs.
  Existing gateway telemetry schema remains unchanged.

Out of scope: ALE-471/Local checkout, gateway/Codex protocol or lifecycle changes,
native Computer Use state, production restart, package/deploy, credentials/cloud state.

## Plan and checks

1. Reproduce unsafe/stuck recovery paths using deterministic fixtures, including malformed
   responses/ACKs, uncertain interruption, and a terminal failure with useful history.
2. Add explicit client recovery and submission gating, retained HUD explanation and
   safe diagnostics. Files: AIUI gateway, page, voice UI, latency and their tests.
3. Run targeted regressions, then the AIUI suite including isolated HTTPS/mock-app-server
   integration, static validation with an isolated example config, and diff/secret checks.
4. Record limitations and physical acceptance checklist in this artifact and Linear.

Risks: accepting stale state could duplicate work; discarding pending requests could lose
identity; diagnostics could expose payloads. Tests must prove the negative cases. No new
dependencies or public API. AIX packaging is explicitly prohibited in this session.

## Physical incident evidence

Reported Calculator failure displayed «Не удалось прочитать ответ Mac». Baseline maps both
`invalid_response` and `invalid_snapshot` to that text. Existing issue has no timestamp,
UUID or diagnostic attachment; the wearer does not remember the time. No incident sample
is available in this managed worktree. Exact physical cause and turn correlation remain
UNAVAILABLE; reproducing a code path does not establish which path occurred on RV101.
Local checkout/runtime artifacts are not inspected while ALE-471 runs independently.

Code evidence: `open()` already restores a valid terminal snapshot to READY; repeated
schema failure instead repeats ERROR. `refresh()` also previously mapped
`turn_interrupted` to READY even with `uncertain=true`, and `submit()` could use an old
idle state after a failed refresh. Both cases are reproduced by the new regressions before the fix and pass afterward.


## Local verification — 2026-10-03

Candidate: base `953a790cd2d782cf0acadb71dc97be6882c14d47` plus uncommitted ALE-469
changes on `codex/ale-469-error-recovery`. Runtime/test content SHA-256:
`eec87b88b3976016861f915dc79575f8a5c8b012a25c31bba66cb8158e62a607`.
Digest input is each changed runtime/page/test path in sorted order, NUL, file bytes, NUL.

- PASS: 41 targeted client/page/diagnostic tests during the edit loop.
- PASS: all 66 AIUI tests across the full run plus the necessary integration retry.
  `npm --prefix aiui-agent test` initially passed 65 and encountered one environment
  failure (`listen EPERM` on a fixture loopback port). Only that test was rerun with
  native sandbox approval: `node --test aiui-agent/test/integration.test.mjs`, PASS.
  The isolated real HTTPS gateway/mock app-server proves terminal failure recovery,
  retained failure history, same session/thread, and no second native turn after a malformed
  ACK plus close/reopen. No production service or real Codex account was used.
- PASS: `npm --prefix <temporary-copy> run check`, copied runtime files plus example
  config only. Working/private config was not read, created or replaced; no package built.
- PASS: changed-file credential-pattern scan, relative documentation links, diff review
  including new files, and `git diff --check`. Source credentials were never inspected.
- Environment: installed the existing locked root `ws` dependency with `npm ci --ignore-scripts`
  in this worktree. Default sandbox DNS and offline-cache attempts failed; approved network
  install passed. Package manifests/locks unchanged.
- NOT RUN: AIX package/deploy (explicitly prohibited), RV101 physical acceptance, real
  Codex smoke (no gateway/Codex contract changes), root/Android suites (unchanged layers).
- No commit, push or merge. No Local checkout, gateway restart or shared native consent mutation.

## Remaining acceptance

ALE-469 requires physical confirmation; do not mark the issue Done from these tests.
After a separately authorized candidate package/deployment and when parallel runtime restrictions
are lifted, verify: terminal failure -> one tap READY with explanation -> second tap recording ->
new successful utterance in the same thread, preserved prior error history, no repeated action;
uncertain delivery -> recheck only, no recording/new turn until reconciliation.
If the original incident diagnostics become available, correlate its capture/request/session/turn
IDs and exact error code. Otherwise retain the explicit historical-cause limitation above.
A future recurrence can distinguish response parsing, snapshot fields and history envelope using
`mac-codex-last-error`; detailed `stage`/`check` values are local, not gateway telemetry fields.


## Completion audit — 2026-10-03 continuation

Runtime/test candidate digest is unchanged; earlier passing checks remain applicable.

| Issue requirement | Evidence | Completion boundary |
| --- | --- | --- |
| 1. Correlate original physical failure | Reported HUD text identifies two possible codes, with no device diagnostic sample | Not established; native turn history alone cannot identify the AIUI response/schema failure |
| 2. Recover terminal ERROR; uncertain delivery stays blocked | Client/page regressions and isolated HTTPS integration | Local behavior PASS; RV101 not tested |
| 3. Retain useful explanation/history | Page acknowledgement/next-recording test and canonical-history integration assertion | Local behavior PASS; RV101 not tested |
| 4. Distinguish safe diagnostics | Parsing/field fault injections and allowlisted local diagnostic tests | PASS locally; no deployed recurrence evidence |
| 5. No duplicate mutation regression | Retained-UUID tests, reopen integration, unchanged approval lost-ACK regression | PASS |

Bounded read-only follow-up found no device error code in the recent related technical chat.
The saved physical native chat contains execution history, but no demonstrated binding to this HUD
failure. No private runtime state or Local checkout was inspected. Stop historical correlation here
until the original device diagnostic sample or stronger incident evidence is available.

Independent Linear `fetch` readback confirmed Needs Test (updated 20:36:01 UTC); earlier
`get_issue`/`save_issue` responses were stale. No further status mutation is needed.
