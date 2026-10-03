# Development workflow

## Source and tools

[Linear project Rokid_agent](https://linear.app/drthalas/project/rokid-agent-8d46c39dc1d2) owns product/task status.
GitHub main owns code/history; Spec Kit owns versioned spec/plan/tasks for medium/high-risk features.
Architecture remains in ARCHITECTURE.md. Repository reports are dated evidence, not a parallel live backlog.

[GitHub main](https://github.com/drthalas/rokid_agent/tree/main) is the source of truth for reviewed source. Check local status/diff/branch and remote identity before changing files; preserve user work and staged state. A task may prepare local changes without committing or deploying. Push, review submission and cloud mutations require task authorization; never infer them from running a test or bootstrap.

Use filesystem, shell, rg, npm, aix-cli and git for local code/documents. Use GitHub CLI/integration for repository operations. Browser/CDP is only a Rokid cloud fallback when an API/CLI path is unavailable; never edit local source in a browser. Do not change account binding, credentials, tunnel or gateway policy as a shortcut around a client problem.

Read task-relevant portions of the [context map](context-map.md), [constitution](../.specify/memory/constitution.md) and other sources only as needed. Prefer search/ranges and bounded output over large dumps. Do not reread unchanged evidence without a stated reason; batch independent read-only checks when useful. Requirements/specs express intended behavior; code/tests show implementation; [architecture](../ARCHITECTURE.md) and ADRs record decisions. Record conflicts explicitly instead of rewriting requirements to match a bug. Keep environment/tool readiness and dated verification evidence in [setup status](setup-status.md); current product/task status lives in Linear.

## Linear task lifecycle

Before meaningful work, open the corresponding existing issue, read description/status/comments needed
for scope, and set the actual working state (for this team, `In Codex`). Search/reuse existing issues;
create one only when the work has none. A local spec/plan links the issue and supports it without
becoming another status tracker. Parent milestone: [ALE-451](https://linear.app/drthalas/issue/ALE-451).

At each stage, leave a concise result, checks, commit/PR link, limitations and next issue in Linear.
Use `Spec Needed`, `Ready for Codex`, `In Codex`, `Needs Test`, `Done` or other available states according
to actual evidence. Unit/build/cloud-package success does not imply physical RV101 acceptance.
If hardware acceptance is required and pending, use `Needs Test`, not `Done`; docs-only acceptance
can be Done after its checks and requested delivery. Never invent physical results to close an issue.
Reference the Linear identifier in commit subjects/PRs when practical. Keep credentials, private
config/AIX and conversation contents out of Linear as well as Git. Use one issue as the ongoing task
record, with linked repository specifications/evidence where needed.

Stage report: LINEAR → RESULT → CHECKS → GIT → PHYSICAL (PASS / NEEDS TEST / NOT RUN) → NEXT LINEAR ISSUE, with the session header and checkpoint metrics below.

## Choose the process

| Mode | Risk and uncertainty | Process |
|---|---|---|
| FAST | Small, clear, reversible local change | State goal, scope and verification; implement/review. No mandatory standalone spec/ADR. |
| STANDARD | Bounded behavior or substantial normal development requiring acceptance detail | Lightweight brief: goal, in/out, behavior, constraints, risks, files/contracts, checks and open questions. Use one issue/PR or future `specs/<id>-<name>/brief.md` (project convention, not a Spec Kit command). |
| DEEP | Medium/high risk, unclear architecture, privacy/permissions, public contracts, migrations or coupled components | Full Spec Kit: specify → clarify as needed → plan → tasks → analyze as needed → implement in small stages → converge and review. |

For installed Codex skills, invocation is `$speckit-specify`, `$speckit-plan`, `$speckit-tasks`, `$speckit-implement`, `$speckit-converge`; optional `$speckit-clarify`, `$speckit-analyze`, `$speckit-checklist`. Check discovery first per setup status. These are agent skills, not shell commands. Constitution is already prepared; do not regenerate it on every task. Meeting transcription, camera/live vision and persistent actions require full specifications before implementation. No such feature workflow runs during bootstrap.

Before implementation: agree observable behavior, boundaries and acceptance; resolve uncertainties that would change the design. Label reversible assumptions. Before each diagnostic, state question → expected evidence → timeout → stop condition. After two equivalent failures without new evidence, change hypothesis/method or report a blocker with verified facts and missing evidence. Stop when the question is answered or the stop condition is met; continue independent safe work. Modes reduce unnecessary process, never required correctness/security/release checks or authorization. Increase process depth if risk emerges. Choose tools/stack from constraints, not templates. Significant changed decisions merit an ADR; ordinary edits do not.

## Verification and review

During the edit loop, run targeted checks for the behavior being changed. At a stable candidate, run the full applicable matrix once, including required integration/release checks. Repeat the full matrix only when a later change or failure justifies it; rerun affected checks after subsequent edits. Record the reason for a full rerun. A stable candidate is required before delivery even when no deployment is planned. Documentation-only changes need link, factual consistency, secret and diff checks, not a new inference or physical test. Runtime tests should test behavior/contracts rather than mirror implementation; add a regression check for a reproducible bug when useful. Preserve checks rather than weakening them for a green run.

| Changed area | Relevant verification before deployment |
|---|---|
| Gateway/protocol/security/Codex | `npm test`; `npm run smoke` when the Codex contract changes (and for applicable real integration changes), after accounting for local account usage/test history |
| AIUI runtime/config/packaging | `npm --prefix aiui-agent test`, `npm --prefix aiui-agent run check`, isolated AIX packaging/readback |
| Android | Flavor unit tests/build/lint in [runbook](../RUNBOOK.md); device acceptance when behavior changes |
| Pure docs / Spec Kit service files | Relative links, source evidence, secret scan, diff/untracked review; shell syntax/manifests/template resolution for added tooling |

Use fixtures/mocks and isolated safe configuration. Real smoke leaves Codex test history and is distinct from live glasses testing. Report passed/failed/skipped/unavailable and tested revision. Checklist/agent review is not a test or independent approval of one's own change. When independent review is required, self-review does not satisfy it. Do not require a universal coverage percentage.

## Private deployment

Declare the candidate SHA and artifact identity before package/deploy; record significant uncommitted state if present. Package and active-cloud readback once per actual physical candidate. Repeat only after an artifact change or demonstrated cloud failure; record that reason. This cadence does not waive readback or physical acceptance.

1. Review source diff and applicable tests. Preserve existing private runtime configuration; use isolated secret-free staging for template packaging, never overwrite working config to run tests.
2. Inject device token, trusted HTTPS origin and optional project/session through the existing configure tool into a private build. Details: [AIUI setup](../AIUI_SETUP.md). No credentials/live endpoint in tracked source; no admin token on RV101.
3. Only within an authorized deployment, upload/repackage/save for the existing private agent. Preserve approved permissions including Camera; do not submit for public review. The HTTP uploader is a prototype until its complete path is verified; cloud-only fallback has separate prerequisites.
4. Download the active cloud AIX, check identity/version/hash, runtime files and exact private config equality in memory. Log booleans, not credentials. “Synced” or local AIX success alone is insufficient.
5. Update resources through Hi Rokid and separately verify real RV101 invocation, two utterances in one thread, gestures, HUD, cancel/reconnect and TTS. Acknowledged update is not proof of installed version or completed behavior.
6. Keep rollback targeted to the deployment; preserve gateway state/thread mappings. GitHub push does not auto-deploy AIUI. Never reset accounts/glasses or restart a working tunnel without scope/necessity.

## Session policy and reporting

Use one coherent Linear issue/objective per session. Keep continuity for small edits within that objective; an in-progress steer remains the same context and is not a fresh session. Choose:

| SESSION | Use |
|---|---|
| CONTINUE | Same bounded task before a stable checkpoint, with useful context and no compaction pressure. |
| COMPACT THEN CONTINUE | Same task with bloated context/tool history but no meaningful phase boundary; retain a compact task record. |
| NEW SESSION | Normally after a major checkpoint, physical feedback, phase change, repeated compaction or a new Linear issue; also consider for very large context/tool history. |

**PROVISIONAL heuristics to validate in ALE-467, not hard limits:** around 150k context tokens, review whether continuity still helps; around 250k context tokens or ~30 model responses, actively consider compacting or a fresh session. Task boundaries, risk and evidence govern the decision; unavailable counters do not prevent it. Context capacity is a ceiling, not a target working set. These numbers are workflow experiments, not model specifications.

A fresh-session compact handoff contains: issue ID, HEAD SHA, objective, changes, checks already run and their revision, known failures/blockers, touched files and next smallest step. Preserve relevant uncommitted/staged state and authorization scope. Read canonical Linear/spec/Git instead of replaying the transcript.

Every future task prompt and report includes this header (prompts recommend; reports state actual visible settings):

```text
SESSION: NEW SESSION / CONTINUE / COMPACT THEN CONTINUE
MODEL: available model
EFFORT: available effort level
WHY: one sentence tied to scope, complexity and risk
```

| Model route | Task |
|---|---|
| Luna | Narrow, mechanical or repetitive work. |
| Terra, when available | Routine work with established patterns. |
| GPT-6.1 Sol | Default for substantial normal development. |
| Astra | Ambiguous security/protocol/architecture work or hard debugging. |

Choose the lightest available model/effort sufficient for acceptance; maximum model/effort is not the default. Escalate when uncertainty/risk warrants it, de-escalate for bounded mechanical work. This is project routing policy, not a requirement to switch the running model automatically.

Every checkpoint/final report appends:

```text
SESSION / CONTEXT REPORT
Model:
Effort:
Context used/max:
Utilization:
Compactions:
Wall time:
Input/cached/output/reasoning:
Responses:
Tool calls:
Git state:
Next-session recommendation: CONTINUE / COMPACT / NEW SESSION
Reason:
```

Use exposed counters only; unavailable values are `UNAVAILABLE`. Never infer exact context/token/response/tool counters from transcript size or guessed model capacity. Utilization may be calculated from exposed used/max values; label measured intervals and counter scope. Report git HEAD/branch and clean/dirty/staged state as observed. Keep metrics and handoffs free of credentials, private paths and conversation contents.

ALE-467 Phase 2 installs the reviewed Phase 1 policy; practical improvement remains unproven until one comparable real development task records before/after wall time, usage, cycles and preserved acceptance checks. Keep ALE-467 open until that measurement is reviewed.

## Completion and future infrastructure

Complete a task when scoped acceptance/checks/diff/docs are satisfied and limitations are explicit. Implemented locally, committed, merged, deployed and physically accepted are separate states. Before any push scan index and reachable history, not only working files; no force-push/history rewrite without explicit authorization.

Tests already exist: CI is a recorded cleanup gap, not silently added here. When future changes introduce dependencies/CI, verify provenance/pin versions; prefer SHA-pinned third-party actions. Collaboration needs bounded branches/review; data changes need compatibility, migration and rollback; releases need diagnostics and targeted rollback. Do not prescribe Kubernetes/staging/SLOs without a concrete need. Skills/MCP require a relevant task and trusted source. Parallel agents, if explicitly authorized, need independent ownership and must not race shared Spec Kit feature state.
