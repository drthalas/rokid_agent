# Current state

Updated: **2026-10-04 09:34 UTC** · Derived snapshot owned by Codex ([maintenance rules](development-workflow.md#current-state-snapshot)).
Scope: ALE-466 prototype checkpoint reconciliation; production/other-issue statements retain the prior ALE-468 evidence dates, with no fresh production inspection.

[Linear](https://linear.app/drthalas/project/rokid-agent-8d46c39dc1d2) owns task/product status;
[GitHub main](https://github.com/drthalas/rokid_agent/tree/main) owns code/history;
Spec Kit validation/evidence owns detailed checks; [setup status](setup-status.md) owns environment/bootstrap evidence.
This page summarizes those sources and never overrides them. Dates below describe evidence, not fresh verification.

## Source, runtime and candidate

| Layer | Latest established state |
|---|---|
| Main HEAD at reconciliation | [`62301b4`](https://github.com/drthalas/rokid_agent/commit/62301b481925689fe262d76896fa0d20e12122ec), fetched 2026-10-04; ALE-466 prototype branch fast-forwarded to this docs-only base. Its checkpoint SHA is in Git history. |
| Production gateway/runtime | Runtime bytes match **f65d152**, per [ALE-470 checkpoint](https://linear.app/drthalas/issue/ALE-470#comment-3405e437-6132-4873-8253-584531ebfc43), 2026-10-04 09:01 UTC. Local STT: large-v3-turbo / Metal / ru prompt; loopback Codex payload bound 16 MiB. All three sessions recovered to Done without reset/replay. |
| Active private AIX | Jarvis **1.2.0**, active cloud readback PASS; runtime/private-config equality verified in [release evidence](../specs/008-ale-470-stt-hud/evidence.md#one-private-cloud-deployment). Cloud readback does not prove glasses installation or physical success. |
| Current physical candidate | f65d152 runtime + private AIX 1.2.0, awaiting ALE-470 acceptance. No new runtime/AIX candidate from ALE-468. |
| Unreleased isolated candidate | [ALE-469](https://linear.app/drthalas/issue/ALE-469): `f49d22c` on `codex/ale-469-error-recovery`, Needs Test; outside main and undeployed. Rebase/integration waits until after ALE-470 physical acceptance and separate authorization. |

## Focus, acceptance and limits

- **Next physical priority: [ALE-470](https://linear.app/drthalas/issue/ALE-470), Needs Test.** Release/recovery/readback checks passed; real RV101 Russian speech, technical terms, multiline HUD and same-session continuity have not been accepted on 1.2.0.
- **[ALE-465](https://linear.app/drthalas/issue/ALE-465), Done:** owner accepted physical approvals, persistent per-app Always Allow, resolved prompt storm and practical agent/file-to-draft workflows on 2026-10-04. [Owner acceptance](https://linear.app/drthalas/issue/ALE-465#comment-4267de8c-e3d1-483c-a7d2-5899e0eebcb9) supersedes older pending-release statements in its checked-in validation; it does not accept screenshots or the new STT/HUD candidate.
- **Known defects:** [ALE-471](https://linear.app/drthalas/issue/ALE-471) is Backlog/deferred after physical screenshot failure on 1.1.17; local capture/draft proofs do not establish RV101 reliability. Terminal ERROR recovery remains ALE-469's isolated work.
- **Parallel focus:** ALE-468 docs checkpoint; [ALE-464](https://linear.app/drthalas/issue/ALE-464) session hygiene, [ALE-462](https://linear.app/drthalas/issue/ALE-462) migration preparation are In Codex. [ALE-466](https://linear.app/drthalas/issue/ALE-466) host prototype is Needs Test (review/integration pending, not a production candidate). They do not establish production deployment.
- **Evidence/status mismatch:** [ALE-472](https://linear.app/drthalas/issue/ALE-472) remains Ready for Codex although ALE-470 records its bounded transport fix/recovery at f65d152; reconcile in Linear before repeating work. [ALE-467](https://linear.app/drthalas/issue/ALE-467) remains Needs Test for measured workflow improvement.

## Architecture-affecting work

- Cloudflare audit [ALE-463](https://linear.app/drthalas/issue/ALE-463) is Done. **ALE-462 is preparation only:** authenticated account inventory awaits sign-in; named-tunnel cutover, AIX endpoint change and reboot acceptance wait for the production lane. Pre-login unattended recovery is unproven; no migration success is claimed.
- Meeting Recorder **ALE-466 has an isolated host prototype checkpoint** on `codex/ale-466-meeting-prototype`: durable chunks/reconnect, bounded capture model, 60-minute synthetic archive and real 65-second local STT passed. Synthetic Gmail draft/Drive local-file readbacks passed. [Evidence and limits](../specs/009-ale-466-meeting-recorder/evidence.md). RV101 adaptation/physical lifecycle, Opus decode, native Codex/provider integration, boundary quality and retention policy remain; no production/AIX changes.
- [ALE-454](https://linear.app/drthalas/issue/ALE-454) multi-chat lifecycle remains Backlog. Single-owner/shared-token and routing-only allowlist limits remain in [architecture](../ARCHITECTURE.md#security-and-persistence).

**Exact next recommended step:** owner-led ALE-470 session: update glasses resources to Jarvis 1.2.0,
test several natural Russian commands plus Codex/Gmail/Linear/Rokid terms, request a structured task list,
and verify readable multiline HUD plus same-session continuity. Record physical results in ALE-470 before
releasing its production lane. This recommendation does not authorize deployment or start another task.
