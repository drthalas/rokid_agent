# ALE-470 STT + HUD readability checkpoint

Date: 2026-10-04. SESSION: NEW SESSION. MODEL / EFFORT: actual runtime identifiers
UNAVAILABLE; requested GPT-6 Astra / Medium. WHY: isolated STT/HUD usability work.
Base: `7514d1617adebe9cb2c7a5bdf0f297bc59a369d5`, fetched origin/main and clean managed
worktree before changes. Branch: `codex/ale-470-stt-hud`. STANDARD process;
[scope and plan](brief.md). ALE-469 worktree untouched; inherited screenshot and
approval behavior unchanged. No production restart/config switch or cloud/AIX deploy.

## STT decision

Selected: **whisper.cpp large-v3-turbo full model, Metal, language=ru**, with prompt:

> Русская речь. Названия: Jarvis, Rokid, Codex, Gmail, Google Drive, Linear, GitHub, AIX, Computer Use, Mac mini.

This is a production recommendation for the next guarded integration phase, not an
already-applied configuration. Current production remains base / CPU / ru / no prompt.
The isolated candidate config and model remain in this worktree's ignored private storage.
Do not archive the worktree before transferring the selected model during integration.

Runtime: installed whisper.cpp **1.9.4**, ggml **0.25.3**, Apple **M4 / 24 GiB**.
Installed `--help` confirms `--prompt`, `-ng`, `-l`, `-otxt`, `-of`, `-nt`.
Metal **YES**: `whisper_backend_init_gpu: using MTL0 backend`, `MTL0 (Apple M4)` and
`whisper_model_load: MTL0 total size = 1623.92 MB`. The benchmark requires both backend
selection and weight placement, not merely a loaded Metal library. GPU jobs ran with
native approved hardware access; sandbox CPU defaults were not mistaken for GPU evidence.

[Exact transcripts, WAV SHA-256, errors, latency and RSS](benchmark.json).
10 identical canonical mono PCM16 16 kHz WAVs, 1.60–3.54 seconds each, generated locally
with macOS Milena at rate 165. **Synthetic speech, not RV101 microphone or owner speech.**
No private speech was collected. WER/CER normalize case, ё, punctuation and whitespace;
number words versus digits still count as errors. These practical corpus results are
not a population accuracy claim. Recognizer jobs were sequential.

| Candidate | Word errors / 66 | WER | CER | Median wall | Max wall | Mean load | Peak RSS |
|---|---:|---:|---:|---:|---:|---:|---:|
| base, CPU, no prompt | 28 | 42.42% | 28.03% | 1.036 s | 1.080 s | 56 ms | 0.349 GiB |
| full turbo, Metal, no prompt | 9 | 13.64% | 10.86% | 1.567 s | 1.745 s | 463 ms | 1.869 GiB |
| full turbo, Metal, bare English vocabulary | 10 | 15.15% | 11.87% | 1.565 s | 2.731 s | 483 ms | 1.869 GiB |
| **full turbo, Metal, Russian vocabulary context** | **9** | **13.64%** | **9.60%** | **1.538 s** | **2.718 s** | **447 ms** | **1.868 GiB** |

Mean selected CLI wall/internal time: 1.669 / 1.577 s. Relative literal WER reduction
versus base: 67.9%; CER reduction: 65.8%. Technical improvement is more useful than
small latency savings here. Quantization was not needed: full turbo was stable and interactive.

Bare English vocabulary is rejected: `Pocager`, `Nайdi`, `Pokajai списok` appeared in
otherwise Russian phrases. Adding the concise Russian context removed that regression.
It improves Linear/Codex spelling versus no prompt, with one extra `и` in the Linear
phrase. The ordinary Russian control sentence is correct. The selected run was repeated:
all 10 exact transcripts matched its first run. The initial plain turbo run's Metal
parser missed the digit in `MTL0`; raw diagnostics confirmed GPU and a corrected rerun
is the one retained in benchmark.json. Initial full-model first load was 954 ms /
2.634 s wall; results are not a claim of guaranteed cold-cache latency.

Representative comparisons:

| Expected | Base | Selected |
|---|---|---|
| Создай черновик Gmail самому себе и ничего не отправляй | создать Черновик Джимейл самому себе и ничего не отправляй. | Создай черновик Gmail самому себе и ничего не отправляй. |
| Продолжай работу в Codex | продолжай работу в Киодекс. | Продолжай работу в Codex. |
| Обнови ресурсы Jarvis на очках Rokid | обновь ресурсы джар-весначика хрокит. | Обнови ресурсы Jarvis на очках Rocket. |
| Покажи список задач и ничего не изменяй | Покажи список задачи ничего не изменяй. | Покажи список задач и ничего не изменяй. |

Remaining: `ALE-470` → `AL470`, `AIX` → `AX`, `Computer` partly Cyrillic and `Rokid` →
`Rocket`. Do not conceal those errors. Real voice, room noise and RV101 microphone
remain the decisive next-phase test. No substitution rules rewrite technical names.

Model sizes / SHA-256:

- Base: 147,951,465 bytes; `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`.
- Turbo: 1,624,555,275 bytes; `1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69`.
- Source: [official whisper.cpp model repository](https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-large-v3-turbo.bin).

Implementation: optional validated `stt.prompt` (max 512 chars, no control chars), literal
argv value with `shell:false`; boolean GPU config validation. CPU default remains until
an explicit private config switch. `/v1/stt` protocol changed: **NO**. Local-only/privacy:
**YES**. 30 s bounds, serialization, safe faults and finally cleanup preserved.

Real isolated `/v1/stt` smoke: TLS verified, unauthorized→401, invalid audio→400,
response retains only text/timing/clock, no Codex execution, new temp directories removed.
3.537 s WAV: 3.804 s wall, 1.415 s load (cold-ish post-layout workload).
28.299 s synthetic repetition: 1.798 s wall, 447 ms load. The latter tests audio-size
handling and runtime completion, not recognition quality of diverse 28-second speech.
Production was not restarted. Synthetic transcript output is confined to benchmark
fixtures/evidence; production still has no raw transcript/audio logging.

## HUD root cause and fix

Model formatting: previous developer guidance only required concise language, without
list-specific instructions. Sanitized structure-only inspection of current saved history
found one response with 7 newlines / 6 bullet items. The owner's exact Linear example
was not present, so its original model output is unknown. Model-side contribution to
that particular event is **not proven**. Guidance now asks for compact lists/short
sections, exact names/IDs/URLs, and avoids ordinary tables/code fences.

AIUI rendering: **confirmed collapse** in official `@yodaos-pkg/ink` 0.18.0, executed
as real WASM + QuickJS + native canvas under Node, without browser file access.
The original single `<text>` rendered meaningful newlines exactly like spaces.
The supported column-child fix uses separate `<text>` for each logical line and a
13px empty section element. No unsupported `white-space` workaround is used.

[Before](hud-before.png) · [After](hud-after.png)

Before: heading and three tasks run together and wrap into three dense lines.
After: one heading, blank section, three distinct task lines. Measured pixel bands:
old y=5–22 / 31–48 / 56–73; new y=5–22 / 44–61 / 69–82 / 95–112.
Ordinary prose has identical before/after pixel bands. This is real web runtime evidence,
**not proof of rendering on the currently installed RV101 firmware**.

Reproduce with Node 22, an extracted official `@yodaos-pkg/ink@0.18.0` npm tarball
and test-only `@napi-rs/canvas@1.0.10` under ignored private storage (neither is a
project/runtime dependency):

```sh
node scripts/hud-layout-check.mjs .local/ale-470/ink-runtime/package .local/ale-470/runtime-host/node_modules/@napi-rs/canvas/index.js .local/ale-470/hud
```

`hudHistory` is a bounded presentation projection; canonical assistant strings retain
newlines and exact names/IDs/URLs. Gateway state persistence, Codex history hydration,
frontend close/reopen, long-answer retention and arrow scroll are covered by tests.
TTS uses the original text through a small extractive transform which removes bullet /
numbering / Markdown separator artifacts. No extra model call. History/reopen **PASS**;
TTS formatting **PASS**; general UI redesign **NO**. Imported thread instruction policy
and approval instructions were not changed.

## Verification and artifact

Tested state: baseline plus this ALE-470 diff (runtime files unchanged after verification).

- Config/STT/history + AIUI HTTPS integration: 11/11 PASS; final STT bounds/privacy addition: 3/3 PASS.
- Affected gateway protocol/model/integration: 15/15 PASS.
- AIUI runtime suite: 56/56 PASS (includes live HUD/reopen/TTS, long answer and scroll).
- Official Ink WASM layout reproduction: PASS; syntax/import/manifest validation: PASS in isolated secret-free staging.
- Real local HTTPS STT smoke: PASS for short and 28.299 s input; cleanup/auth/privacy checks PASS.
- `git diff --check`: PASS. Full release matrix, real Codex inference, production/cloud/physical tests: NOT RUN by scope.

Local template AIX packaged once, no upload: `ale-470-template.aix`, VERSION
`fe542c91-2b67-43e5-989a-41aa853be4e7`, SHA-256
`71686d683689b6a555e753ef480409efb3cea247eaf611e7169bb848889bac80`.
Direct ZIP readback: 17 entries, new `lib/answer-lines.js`, expected page, empty origin/token,
no dev/private files. Existing pack-helper reports `package_contains_dev_files` because
its regex sees `.local/` in the CLI listing header. Artifact creation succeeded; independent
entry-based validation passed. No repack and no unrelated helper repair. This package is
unconfigured validation evidence, not a device candidate or active cloud AIX.

Environment failures: initial network/DNS, empty sandbox `say` output, sandbox loopback
EPERM, one automatic approval timeout; resolved via native escalation (one timeout retry).
No policy weakening. Node WASM required a minimal Web host and real canvas; Ink handled
all text/layout itself. The existing approval projection test caught accidental enrichment
of canonical history; separate `hudHistory` fixed it, all 56 AIUI tests then passed.

Secrets: full reachable HEAD history scanned (26 commits), two existing gitleaks findings:
`curl-auth-user` in synthetic `user:pw` fixture at 7b8c182; `generic-api-key` matching
old scanner-report prose at d97834c. Both manually verified non-secrets. Raw automated
history scan exits 1; do not label it a zero-finding PASS. Staged diff scan found zero
leaks; staged paths include no private config/model/audio/AIX, and an in-memory check
found zero matches for the current device/admin credentials. No model, private config,
audio, AIX or tokens enter Git.

## Next phase

Guarded integration/rebase if needed → apply selected private STT config → one private
AIX deploy for HUD → physical RV101 Russian STT and structured-answer comparison.
Keep ALE-470 Needs Test, not Done. No ALE-469 or ALE-471 scope was implemented here.
Recommend NEW SESSION at this checkpoint. Exact context/token/cached/reasoning/response/
tool counters and actual model/effort are UNAVAILABLE; no compaction occurred in this work.

## Guarded production release — 2026-10-04

SESSION: CONTINUE. MODEL / EFFORT: actual runtime identifiers UNAVAILABLE;
requested GPT-6 Astra / Medium. WHY: approved integration, bounded transport
compatibility prerequisite, and private HUD deployment; stop before physical testing.

Fetched origin/main was `7514d16`; local main fast-forwarded to `86701da75415dd06a67533b7986ccfb7c0623e0b`.
No push performed. Parked ALE-469 commit `f49d22c` is not an ancestor and its worktree
was untouched. No deferred ALE-471 work was added. Existing unstaged ALE-465/ALE-471
validation reports were preserved. Final runtime candidate is `86701da` plus exactly
one uncommitted line in `src/codex.mjs`: loopback WebSocket maxPayload 8→16 MiB.
Codex module SHA-256: `b19e5694c4b4cd0011fca60953050979e322931404fdd959a2ff0faedcdaaa13`.
New targeted test and this release documentation are also uncommitted.

### Verification and recovery

One initial release matrix on `86701da`: root 75/75, AIUI 56/56, AIUI check and real
Codex recovery smoke PASS. No matrix restart for frontend. After the explicitly approved
transport change, targeted payload/integration/protocol/history checks 20/20 and affected
full gateway suite 77/77 PASS. Diff review/check PASS. No public/device HTTP, auth,
sandbox, approval, exactly-once or uncertain-state implementation changed.

Transferred selected full turbo model to main's ignored private storage; exact model
SHA-256 matched the checkpoint. Only production STT fields changed: large-v3-turbo,
gpu=true, ru, selected Russian vocabulary prompt. Isolated authenticated HTTPS STT
smoke on transferred model PASS: 2.899375 s controlled synthetic input, 1824 ms wall;
TLS/auth, unchanged response protocol, no task execution and temporary cleanup PASS.
No private speech collected. Physical microphone quality remains unproven.

First guarded restart exposed an existing 8 MiB transport ceiling: one thread/read
response disconnected the loopback client, causing three resume_failed/uncertain sessions.
Original private config/state were backed up. No cloud deployment occurred while blocked.
Owner explicitly approved only 8→16 MiB after diagnosis. Bounded 16 MiB read-only probes
measured the three real payloads: 9,974,764 / 3,106 / 3,106 bytes. All fit the new ceiling;
each latest native completed turn matched its saved turn ID. Regression coverage verifies
large-history recovery with no duplicate turn/start, and rejects a response above 16 MiB.

Guarded restart with the one-line fix used the existing state as-is. **No manual clearing,
reset, backup restoration or request replay.** Native recovery reconciled all three sessions
to Done, error=null, uncertain=false. Session/thread/turn mappings, final texts and request
deduplication map preserved. Bounded history is semantically exact against pre-failure backup:
one previously absent optional approvalNotice became null, all other fields equal. Initial
byte-for-byte history assertion detected this normalization; read-only semantic verification
confirmed it without another restart. Local/public authenticated health 200, unauthenticated
401; codex/loggedIn/stt true. All three runtime profiles workspaceWrite/on-request/auto_review.
Private frontend config unchanged; endpoint/project/session/TTS and credentials preserved.
Tunnel/account/device binding and native consent configuration were not changed.

### One private cloud deployment

The one local private AIX validation package was retained throughout the gateway-only fix:
VERSION `b5bcf7fa-c251-46e0-9db9-774a47896f8d`, SHA-256
`59a33e64de536b55a5bb359db311096a25caacf2d01c1b0a54128caca20c1220`.
Isolated staging contained only candidate frontend runtime and existing private config.
Working `aiui-agent/config.js` was never replaced. No local repack after gateway fix.

Imported that staging into existing private Jarvis, one explicit Upload to cloud, one
Package AIX, one Save Details. Package action also performs its built-in source upload.
Native picker focus and stale debugger failures were resolved by a fresh foreground Studio
tab; no source upload/package had occurred in those failed attempts. Automatic approval
review once stopped an unexecuted menu click because of a usage limit; owner then requested
continuation, and the same native review path succeeded. No review bypass. No public
Submit for Review. Existing Network/Camera/Microphone/Speaker permissions retained.

Saved private Draft version **1.2.0** (prior 1.1.17). Authoritative agent metadata returned
its ACTIVE artifact MD5 and URL. Downloaded that exact artifact once into private storage:

- VERSION: `d3dd71bf-150d-48ba-b37a-c85b2be6427f`
- MD5: `229c9c8cff4b3488f525ce9555f341dd`
- SHA-256: `92eb142a4ba66876f044c560a2c08dc610ba4ca3d6a62c2e256abe904f4e6c54`

ACTIVE readback PASS: 14 runtime/metadata/license files match candidate staging; expected
hudHistory/assistantLines/section-space and executable line projection; persistent consent
and second confirmation preserved. Exact semantic private config/device token matches;
admin/old tokens absent; endpoint/project/session/TTS retained; dev files excluded. No token
or private AIX contents disclosed. This proves cloud artifact identity, not installation or
physical behavior on RV101.

Physical testing **NOT RUN**, intentionally. ALE-470 ready for Needs Test. Next owner-led
phase: update glasses resources, compare real Russian microphone transcription and multiline
HUD/history/TTS behavior. No ALE-469 merge/deploy, no screenshot/email work.

Final checkpoint: Linear Needs Test confirmed. End-to-end wall interval approximately
48 minutes (includes owner/usage-limit pauses, not active compute time). Actual model/effort,
context used/max/utilization, input/cached/output/reasoning tokens, model-response count and
tool-call count UNAVAILABLE. Observed compactions: 0. Git main `86701da`, empty index,
new fix/test/docs uncommitted plus preserved pre-existing report diffs; no push. Recommendation:
NEW SESSION for physical acceptance because this authorized release phase is complete.

## Reproducibility checkpoint — 2026-10-04

Owner requested committing/pushing the already-deployed compatibility change before
physical acceptance. This checkpoint records only that one-line loopback 8→16 MiB fix,
its existing regression tests and ALE-470 runbook/release evidence. Runtime and test
bytes remain identical to the verified deployment. The preceding uncommitted/no-push
statements describe the earlier release checkpoint, not a new pending deployment.
No AIX repackage/redeploy, production restart, state reset or full release-matrix rerun
is needed for this source checkpoint. Keep the unrelated ALE-465/ALE-471 reports unstaged.
The resulting commit and production-source verification are recorded in Linear ALE-470.
