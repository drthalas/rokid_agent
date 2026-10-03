# Feature Specification: Reliable screenshots and draft attachments

**Feature Branch**: `main` (owner-requested current checkout)
**Created**: 2026-10-03
**Status**: Specified
**Input**: [ALE-471](https://linear.app/drthalas/issue/ALE-471), owner's screenshot checkpoint request.

## User Scenarios & Testing

### User Story 1 — Attach an application result (Priority: P1)
The owner calculates 20+30 and asks Jarvis to attach the visible result to a draft.
**Independent Test**: Operate real Calculator, capture its result, create and read back an unsent self-addressed Gmail draft.
**Acceptance**: 50 is visible in a real image; attached bytes match that image from the current turn; no screenshot utility or email send is used.

### User Story 2 — Attach the entire desktop (Priority: P1)
The owner explicitly requests the full desktop, including visible windows and desktop background.
**Independent Test**: Capture the real desktop, create and read back an unsent self-addressed draft.
**Acceptance**: A valid image of each attached display exists privately and reaches the draft; an application-only image does not satisfy this request. No interactive capture UI after permission provisioning.

### User Story 3 — Safe completion and useful failure (Priority: P1)
The owner can distinguish capture failure from attachment failure without seeing private paths or bytes.
**Acceptance**: Explain capture failures as “Не удалось сделать снимок рабочего стола” (or application equivalent), and attachment failures as “Не удалось прикрепить снимок к черновику”. Temporary copies are removed after handoff or bounded expiry, and native approval behavior remains unchanged.

### Edge Cases
Intermediate images before the final result; duplicate or malformed images; stale turn metadata; multiple displays; permission denial; sandbox display restriction; connector failure or uncertain draft response; process exit and expired temporary files. Never retry a declined native approval, send mail, choose unrelated older Desktop images, or create duplicate drafts after uncertain creation.

## Requirements
- **FR-001** Prefer the existing native application image for an application-result request; select the image that actually shows the requested result.
- **FR-002** Explicit desktop requests require a real full-display capture; never launch private screencaptureui.
- **FR-003** Preserve workspace-write/on-request/auto_review and exact-app persistent consent. Owner-only privacy provisioning, if needed, uses supported macOS settings.
- **FR-004** Validate image type, bytes and dimensions before attachment. Use existing structured Gmail integration; verify recipient, attachment and unsent state.
- **FR-005** Private temporary images must not enter source, public artifacts, logs or a desktop archive. Bound their lifetime to ten minutes; retain existing native artifact cleanup behavior.
- **FR-006** Capture and attachment failures return distinct terminal explanations; general ERROR recovery is out of scope.
- **FR-007** Both real local proofs and targeted regressions precede a checkpoint. Commit/push only when both pass; no package/release/deploy in this phase.

### Key Entities
Current-turn image (source, identity, scope, type, dimensions, private location, expiry); draft (recipient, attachment, unsent status); stage outcome (capture or attachment).

## Success Criteria
- **SC-001** A real Calculator image showing 50 is attached to an unsent self-addressed draft and verified by readback.
- **SC-002** A real full-desktop image is attached to another unsent self-addressed draft and verified by readback.
- **SC-003** Zero emails sent and zero new app-consent grants; native review remains active.
- **SC-004** No owned temporary file survives successful cleanup; expiry and failure cleanup have regression coverage.
- **SC-005** Regressions cover latest app image routing, desktop capture and validation, attachment handoff, stage errors, cleanup and unchanged approval policy.

## Assumptions
Existing connected Gmail account is the intended self recipient for proofs. Multiple displays require one image per display. No physical acceptance is claimed from local proof. Existing ALE-465 report changes are preserved. Session model/effort are recorded only when exposed.
