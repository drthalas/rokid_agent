# ADR-001: AIUI is the primary RV101 client

Status: Accepted (existing decision reconciled, 2026-10-01).

## Context

The owner uses iPhone and needs installation through official AIUI Studio/Craft and Hi Rokid, without ADB. AIUI source and verified private cloud packaging exist; the user confirmed its backend chain reaches Done. The original direct-APK decision predates this path.

## Decision

Use AIUI as primary. Keep direct RV101 APK and Nexus as optional adapters/fallbacks sharing gateway contracts. Nexus requires an Android phone hub. No runtime restructuring is authorized by this ADR.

## Alternatives and consequences

Direct APK as primary would require sideload/provisioning and separate physical verification; Nexus as primary requires hardware the owner lacks. AIUI instead depends on Rokid account/resource distribution, trusted HTTPS and supported native APIs. Gesture/TTS acceptance remains separate from package/backend evidence. See [canonical architecture](../../ARCHITECTURE.md) and [status](../setup-status.md).
