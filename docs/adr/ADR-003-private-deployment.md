# ADR-003: Private configuration and verified cloud packages

Status: Accepted (existing implemented workflow, 2026-10-01).

## Context

AIUI requires an authenticated HTTPS origin, and packaged JavaScript is readable. Local source sync does not establish what a cloud package contains.

## Decision

Keep live config, tokens and private artifacts outside Git. Track safe examples; inject configuration only into a deliberate private build. After authorized cloud packaging, download the active AIX and verify identity/version/runtime and private configuration without logging its values. Never submit a credential-bearing package for public review/publication. Keep Camera and other approved cloud permissions intact.

## Alternatives and consequences

Committing credentials or trusting the Synced badge risks exposure/stale deployment. Gateway admin credentials must never enter the client. Private AIX remains sensitive in Rokid Cloud and local storage; distribution trust and device-token revocation are required. Changing a Quick Tunnel origin requires private reconfiguration and explicit session continuity. See [architecture](../../ARCHITECTURE.md), [workflow](../development-workflow.md) and [AIUI setup](../../AIUI_SETUP.md).
