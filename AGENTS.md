# Working in this repository

## Tools and boundaries

- Do not use Browser Use / Computer Use for local source editing or inspection.
- Local code, files, tests, searches, builds and diffs use filesystem tools, shell, npm, aix-cli and git.
- Use git CLI or the GitHub integration for repository operations; do not browse GitHub to edit code.
- Browser/CDP is reserved for Rokid cloud operations when a working CLI/HTTP API is unavailable: upload, package/repackage, save cloud metadata, inspect status, download and diagnose cloud artifacts.
- Prefer deterministic HTTP/CDP/Playwright scripts over AI-guided clicking. Never use a browser code editor as the development environment.

## Preserve the working integration

Inspect `git status`, `git diff` and relevant source before making changes. Preserve existing work and history. Do not change gateway business logic, Codex thread integration, the active tunnel endpoint/process or bearer token unless the user explicitly authorizes that scope.

Keep Camera and other approved cloud permissions unless the user requests a change. Never submit a private credential-bearing AIX for public review/publication without explicit authorization.

## Secrets

`aiui-agent/config.js`, `.local/`, private AIX, authentication/session data, browser profiles, logs and private keys must remain untracked. Do not print credentials in tool output or logs. Use safe examples for source control. Before a push, scan both the index and reachable history; ignoring a file does not remove it from history. Never force-push or rewrite history to hide a leak without explicit authorization.

## Validation and deployment

Run relevant checks: `npm test`, `npm --prefix aiui-agent test`, `npm --prefix aiui-agent run check`, and AIX packaging validation. Run real Codex smoke or Android tests/build/lint when their layers change or the user requests a full verification. Private runtime configuration must not be overwritten for testing; use an isolated secret-free staging copy when needed.

Cloud “Synced” is not deployment proof. Download the active cloud AIX and verify version, runtime files and private config in memory without exposing the token. Separate unit/mock/build results from physical RV101 acceptance. No automatic GitHub→AIUI synchronization is assumed.
