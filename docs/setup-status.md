# Setup status

Product/task status is canonical in [Linear Rokid_agent](https://linear.app/drthalas/project/rokid-agent-8d46c39dc1d2).
This file records environment readiness and dated verification evidence. GitHub main is code/history;
Spec Kit carries medium/high-risk spec/plan/tasks. See [task lifecycle](development-workflow.md#linear-task-lifecycle).
The snapshot below is historical bootstrap evidence, not current issue completion or physical acceptance.

Evidence snapshot for architecture reconciliation on 2026-10-01, adapted from bootstrap methodology V5.0.0 for an existing product. This is not a fresh deployment or production-readiness claim. Do not refresh dates/versions without new evidence.

## Repository and environment

- Repository: [drthalas/rokid_agent](https://github.com/drthalas/rokid_agent), branch `main`.
- Inspected runtime/source baseline: `268d25a19fa090f62abd94491b2e791b70b47378`; local HEAD equals GitHub main by read-only `git ls-remote`. Original root commit `7b4a197432a876f4d598c698d18068de49a7973e` remains its parent.
- Initial worktree and index clean. Bootstrap preserves HEAD, branch, remotes and staged contents. Prepared changes remain local; no commit/push/cloud operations performed.
- Observed: Node `22.22.3`, npm `10.9.8`, Codex CLI `0.157.1`, uv `0.11.17`, system Python `3.14.5`; isolated Spec Kit runner uses Python `3.11.15` on macOS arm64.
- Manifests: gateway `0.1.0`, `ws 8.22.0`; AIUI source `0.2.0`, `aix-cli 0.10.1`. Application manifests/lockfiles are unchanged.

## Runtime, cloud and physical evidence

| Layer | Evidence and limit |
|---|---|
| Root tests | Previous GitHub-sync verification at baseline: 13 passed. This docs/tooling task did not rerun application tests. |
| AIUI tests/check/AIX | Previous verification: 18 tests, check and isolated secret-free AIX packaging passed. No new package built by architecture bootstrap. |
| Real Codex | Previous smoke passed: two prompts, same thread, full gateway/app-server restart; distinct from physical glasses. |
| Android | Previous tests/build/lint passed for both flavors; lint had 0 errors/5 warnings each. No physical APK/Nexus acceptance. |
| AIUI backend on RV101 | User explicitly reported AIUI → gateway → Codex → Done successful. This is user-reported physical backend evidence, not a new observation here. |
| Private cloud | Last retained readback report: cloud UX `1.0.8`, runtime files/private endpoint/auth matched, Camera/Network/Microphone/Speaker retained. Source package version `0.2.0` and cloud version are different identifiers. No live cloud inspection in this task. |
| New UX on RV101 | Pending: actual invocation/READY, temple recording/send/cancel/close/scroll, two same-thread utterances, readable HUD and automatic TTS. Resource-update acknowledgment alone does not pass these gates. |
| HTTP deploy CLI | Implemented prototype; complete unattended upload/save/readback path not validated. Previous cloud release used deterministic cloud-only Repackage/Save followed by readback. |

Local ignored evidence was inspected without credentials: `.local/github-sync-verification.json` and `.local/voice-ux-deploy-result.json`. Those reports/artifacts are not prerequisites for a fresh clone. [TEST_RESULTS.md](../TEST_RESULTS.md) preserves the older first-iteration Mac/Android evidence; its 11-test count and deferred Cloudflare statements are historical, not the current state. `DEVICE_TEST_RESULTS.md` does not exist.

## Spec Kit

| Property | Verified status |
|---|---|
| CLI | Initially absent from PATH and no uv tool manifest found. Official `specify-cli 1.0.13` built/run in an isolated temporary uv environment; `version` and `init --help` verified. No global installation and no application dependency added. |
| Project artifacts | `.specify/` installed from inspected temporary generation: templates, six executable Bash scripts, constitution, integration manifests, bundled speckit workflow. Ten native Codex skills under `.agents/skills/`. No feature spec/plan/tasks generated. |
| Integration | `codex`, skills mode explicitly selected, `sh` scripts. `specify integration list` recognizes codex as installed/default; manifest hashes and template resolution checked. No git/other extension, preset or MCP installed; no `.codex/config.toml` created. |
| Agent availability | **Discovered.** On the follow-up AGENTS adaptation turn, the environment-provided skill catalog automatically listed all ten `speckit-*` skills under this project’s `.agents/skills/`, including `speckit-constitution`. Project AGENTS instructions were also supplied in session context. This confirms discovery, not execution of every skill; no product feature workflow was run. |

Pinned official source: [v1.0.13](https://github.com/github/spec-kit/releases/tag/v1.0.13), commit `f1a548a39dba4e5e8600de1d2e0d3ff0c468d2a9`. Templates/scripts/skills come from the same built wheel's core pack, not an unpinned second download. Bundled workflow metadata version is `1.0.1`. MIT notice is preserved in [licenses](../licenses/spec-kit-MIT.txt).

Preparation used the following verified init arguments **in an empty temporary directory**, then copied only `.specify/` and `.agents/` after path/symlink/content inspection, preserving executable bits:

```text
specify init <temporary-directory> --integration codex --integration-options=--skills --script sh --non-interactive
```

There was no `--force` merge in the product repository. Version 1.0.13 has no `--no-git` init option; Git operations belong to an opt-in extension that was not installed. Constitution `1.0.0` records existing stable principles; template resolver succeeded and templates were not edited. Repeat bootstrap verifies manifests/content and retains this installation; it does not rerun init or refresh timestamps.

For later CLI maintenance a pinned ephemeral runner is sufficient (it is not an application dependency):

```sh
uvx --from 'git+https://github.com/github/spec-kit.git@f1a548a39dba4e5e8600de1d2e0d3ff0c468d2a9' specify version
```

The exact command above is reproducibility guidance; this task used a local checkout of that commit with an isolated `/private/tmp` uv cache. CLI/Python dependencies are tooling-only and not claimed to be a fully locked environment. Installed skills/scripts can be used without leaving the temporary runner permanently installed.

## Bootstrap checks and remaining gates

Checked local links (including new documents), secret exposure, tracked/untracked diff, runtime/private-config checksums, unchanged index/HEAD/git configuration, upstream tooling manifest hashes, Bash syntax and constitution-template resolution. No application/physical test rerun was needed because runtime/config behavior did not change. Reapplying the same document edits and checking installed files introduces no additional content diff. Ignore rules continue to protect private files.

Overall bootstrap status: **COMPLETE** for architecture reconciliation and Spec Kit readiness. The earlier discovery gate is closed by the subsequent environment-provided skill catalog, not inferred from a Markdown link or CLI success. Root AGENTS.md was adapted from AGENTS_COMPACT_V3_FINAL.md with concrete project context, verified command references and preserved Rokid tool/security/deployment rules; long architecture/procedures remain in linked canonical documents. Runtime and physical acceptance gates below remain separate.

Known runtime gaps and follow-up acceptance live in [architecture](../ARCHITECTURE.md#migration--architecture-gaps). Major limits: single owner/shared token, allowlist is routing not read isolation, uncertain send recovery requires local review, missing-state recovery policy is incomplete, response/capture bounded, no meeting/camera/notification implementation. Firmware/TTS and future privacy/retention policies remain TBD with conditions in [project brief](project-brief.md).

Bootstrap-era recommendation (current priorities are set in Linear): **unexpected gateway-state loss and uncertain-turn recovery**. Define first-run vs lost/corrupt state, preserved thread ownership, restart/ACK crash cases and no-duplicate acceptance before implementation. No feature spec has been started here.

## ALE-453 checkpoint — 2026-10-02

Native tool-parity implementation/evidence is tracked by [ALE-453](https://linear.app/drthalas/issue/ALE-453)
and [Spec Kit validation](../specs/004-ale-453-tool-parity/validation.md). Inventory found existing native
apps/MCP/plugin skills; real isolated approvals/continuity/dynamic-config checks passed. This checkpoint
is not production or physical acceptance. Accepted Jarvis UX remains cloud 1.0.19 / frontend baseline
5e38d93; no frontend or private cloud/config change is required by tool parity.
