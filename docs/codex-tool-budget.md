# ALE-467 Codex tool budget

Development tooling only. The project hook reserves each supported local tool call
under an atomic per-session lock. Defaults in `.codex/hooks/limits.json`: 20 total,
5 Browser/Computer/UI. UI calls also consume the total budget. Counters persist
across turns and compaction; a new session gets a separate budget.

`PreToolUse` denies the next call when a cap is exhausted. `PostToolUse` returns
`continue: false` after the final permitted total call, requesting that Codex end
that turn. CLI 0.157.1 did not stop the model loop in the host fixture; this
output is emitted but is not claimed as verified run interruption. Rejected UI calls leave remaining CLI/API/MCP capacity available.
The guard never returns an approval or changes native tool permissions.

## Activation

Use a trusted project `.codex/` layer with hooks enabled and review/trust this
hook through Codex's native hook trust flow. Reload/start a session in this
worktree after activation. Merely adding these files does not activate them in
an already running session in another checkout. Do not bypass native tool
approvals. A CLI hook trust bypass is used only by the disposable host fixture
for the inspected deny-only hook, never installed as a runtime default.

## Verification

- `python3 -m unittest discover -s tests -p test_tool_budget.py -v`
- `python3 tests/tool_budget_host_fixture.py` (installed Codex CLI, local fake
  Responses server, disposable marker files; no account inference)

The fixture tests the exact boundary, separate UI cap, parallel reservations,
session isolation and call-ID deduplication. Host fixture success requires first
marker present, second marker absent, and a native host hook-denial diagnostic. The mock emits a final response
after the denied second call, bounding the fixture to three requests.

## Limits

This covers supported local function/MCP hook paths, including nested code-mode
calls. Hosted tools and specialized paths that skip hooks are outside coverage.
UI detection uses tool names and known browser automation words in Bash command
text; arbitrary shell scripts can hide UI actions. Choosing CLI/API/MCP first
remains advisory; recognized UI calls are capped, not semantically rerouted.

Hook trust/enablement is a required deployment gate. Host timeouts or failures
before invoking this script cannot be made fail-closed by its JSON output.
Corrupt state or invalid input is denied by the script. Missing state starts
a fresh counter; removing state resets the budget. The scope key also includes
the working directory, so changing worktrees creates a separate counter. Counters are in
an OS temporary directory and writable by the same user: this is a cooperative
budget guard, not a tamper-proof security boundary. No request/input circuit
breaker is implemented here. No claim is made that the present desktop run is
already guarded.

## Observed host evidence (2026-10-05)

CLI 0.157.1, hooks feature enabled: PreToolUse denied commands after the first
permitted call before their marker files were created. The initial fixture
hit a 35-second environment/startup timeout. A second bounded fixture delivered
353 local fake-model requests in 20 seconds while every over-budget command was
denied. Thus tool denial works; PostToolUse continue:false did not terminate
that installed-host loop. No account inference was used. The final fixture
returns a final mock response after one permitted and one denied call.

Residual: denial feedback can trigger further model requests. A stop-capable
external supervisor or verified turn/interrupt integration is still required
for request/input enforcement. This change does not satisfy that remaining
ALE-467 acceptance criterion.
