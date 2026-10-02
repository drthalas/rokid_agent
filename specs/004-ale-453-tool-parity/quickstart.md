# Native permission validation

Accepted frontend remains Jarvis1.0.19. Do not repackage for backend-only policy changes.

1. Read normal config and Desktop turn permission evidence in permission-inventory.json; do not infer policy from the mode label.
2. Run `npm test`, `npm --prefix aiui-agent test`, `npm --prefix aiui-agent run check`, `npm run smoke`.
3. `node scripts/tool-parity-smoke.mjs` proves native auto-review on a harmless in-memory MCP write, no gateway accept.
   `node scripts/tool-parity-dynamic-smoke.mjs` validates native enable/disable/policy inheritance across isolated restarts.
   `node scripts/permission-parity-smoke.mjs /absolute/new/test-file` explicitly opts into a safe outside-workspace Hello World test; never overwrite an existing file.
4. Deploy only idle gateway/owned app-server after source/secret checks. Preserve state IDs, protected configs and tunnel.
5. Inspect `npm run ctl -- runtime` for actual profiles/review metadata and `tool-events` for real calls. These routes are local admin-only.
6. Test production Gmail/Drive/Calendar/GitHub/Linear/MCP/skill and workspace/Desktop writes in the same Jarvis thread.
7. Create one Gmail draft-to-self, subject “Jarvis Test”, body “Hello from Jarvis”; never send. Let native policy auto-review or request a human; do not invent an extra gateway confirmation.
8. Test Chrome/public page and Calculator controls through app-server integration. Computer Use app grants require owner permission; unsupported built-in IAB is a surface limitation, not a reason for Full Access.
9. Real human RPCs remain pending, without a default120s timeout. Inspect locally, then decide one request. Voice is not approval. Unsafe probes must have no destructive execution path.
10. Record physical HUD/TTS/pending acceptance separately; keep Linear Needs Test until accepted.
