# Validation guide

Baseline: accepted Jarvis 1.0.19 / 5e38d93. Keep frontend/cloud/tunnel/config and state intact.

1. Run `npm test` and `npm --prefix aiui-agent test`; integration fixtures need loopback bind permission.
2. Run the inventory/smoke scripts described in tasks after implementation; store sanitized evidence only.
   Native discovery is separate from successful invocation; isolated proof is separate from production.
3. Record running gateway PID/revision and state metadata before the authorized deployment. Ensure no
   turn or pending approval is active. Restart only gateway/owned app-server; never restart cloudflared.
4. Confirm health/auth/loopback bindings, same sessions/threads and unchanged private AIX configuration.
5. Through Jarvis, test recent Gmail read, a safe owner-selected Drive document and repository/issue read.
   Correlate actual tool events to the same session/thread. Also prove one existing MCP and discovered skill.
6. Request a Gmail draft to self with subject “Jarvis Tool Parity Test”. Inspect pending approval locally;
   do not accept until the owner explicitly approves this action separately. Never send the email.
7. Verify disable/re-enable across isolated restarts without editing normal user configuration.
8. Report each gate as PASS / FAIL / NOT RUN / BLOCKED; do not turn unavailable infrastructure into a fabricated result.

Rollback: restore previous gateway code/process after checking active turn state; preserve state file and
thread IDs. New tool approvals are not durable; disconnect invalidates them. No voice approval shortcut.
