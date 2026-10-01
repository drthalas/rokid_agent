# Rokid Agent Constitution

## Core Principles

### I. Preserve project and conversation ownership

Changes MUST preserve user work, Git history and staged contents. GitHub main is the reviewed source
of truth. A voice follow-up MUST retain its gateway session/Codex thread unless the user explicitly
starts a different conversation/project. Uncertain delivery MUST NOT silently create a duplicate turn.

### II. Enforce the network and approval boundaries

Codex app-server and admin API MUST remain loopback-only. Device access MUST authenticate through
the gateway; clients cannot grant execution approvals. Dangerous actions require an explicit local
human decision. Project routing MUST use the allowlist; no documentation may claim it provides
complete filesystem or tenant isolation.

### III. Keep private data outside published source

Credentials, private runtime config/AIX, account/browser state and private keys MUST stay out of Git
and logs. Use safe examples and isolated test fixtures. Private deployment MUST verify downloaded
active cloud artifacts/config without disclosing secrets; a Synced badge is not sufficient evidence.

### IV. Separate requirements, implementation and evidence

Specifications define expected behavior; code and tests establish actual behavior. Architecture/ADRs
record decisions and gaps. Checks MUST match changed risks/contracts. Unit/mock/build/cloud success
MUST NOT be represented as physical RV101 acceptance. Document-only work does not require live
inference or device tests. Failed, skipped and unavailable checks MUST be disclosed.

### V. Keep capabilities independent and changes bounded

Future voice/media/action capabilities MUST have boundaries independent of Cloudflare, UI framework
and Codex transport. Existing coupling is documented as migration work, not silently refactored.
Medium/high-risk privacy, permissions, data and architecture changes require a bounded specification
before implementation; small reversible edits may use a lighter process.

## Scope and operational constraints

Current product is short interactive voice work on an owner's Mac. Camera permission is retained;
meeting capture, vision and persistent actions are future scope requiring explicit requirements.
Local development uses filesystem/shell/git; Browser/CDP is only an authorized cloud fallback when
API/CLI is unavailable. No local browser editing, public credential-bearing builds or account/device
resets. Application dependencies/cloud settings MUST NOT change incidentally during documentation.

## Development workflow and quality gates

Follow [workflow](../../docs/development-workflow.md) and read relevant [context](../../docs/context-map.md).
Preserve working private config during checks. Review diff and new files, test affected behavior,
update canonical documentation and state verification limits. Before push scan index and history.
Do not infer deployment, commit or push permission from bootstrap. Self-review is not independent
approval where review is required. A checklist or skill execution never replaces tests.

## Governance

This initial 1.0.0 constitution codifies existing project constraints during architecture reconciliation.
Changes require stated rationale, impact on relevant specs/ADRs/workflow and review of compatibility.
Increment major for incompatible principle changes, minor for new substantive principles, patch for
clarifications. Every implementation/review checks applicable principles; exceptions need explicit
scope and risk justification, not silent weakening. User and environment instructions retain priority.
Preserve adoption/amendment dates on unchanged reruns. Do not regenerate templates or product specs
merely to update this document.

**Version**: 1.0.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-01
