# agent-pay v1 — Final Spec

This is the **source of truth** for the `agent-pay` v1 reference implementation.

## Summary
- Single npm package exporting a tiny core API and a CLI.
- Wizard‑first `init` for humans, fully scriptable for agents.
- Strict exact‑scheme 402 handling with header priority and base64‑canonical header encoding.
- Minimal deps (`ethers`, `commander`, native `fetch`).
- JSONL ledger, explicit confirmations, stable JSON output schemas with `schemaVersion` and `command`.

## Decisions Locked In
- Runtime: Node 18+ + TypeScript.
- Packaging: Single npm package with `agent-pay` binary.
- Protocol: Strict “exact” scheme only.
- Secret storage: Plain JSON config with best‑effort `0600` perms and warning on failure.
- Wizard: Interactive by default; non‑interactive via flags/env.
- Key input: Private key string only.
- Spending in non‑interactive: **requires `--yes`**.
- Post‑init: run `doctor` automatically.
- Ledger: JSONL (`spend-ledger.jsonl`), UTC day boundaries, **count submitted**.
- Ledger entries include `status: "submitted"` by default.
- `pay-url`: supports `--method`, `--header`, `--data`, `--content-type`, `--timeout`, `--allowlist`.
- JSON outputs: stable schemas **with `schemaVersion: 1` and `command`**.
- RPC UX: preset choice + manual entry; no silent default in non‑interactive mode.
- Canonical Base USDC address:
  - `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Public Interfaces

### CLI commands
1. `agent-pay init`
2. `agent-pay doctor`
3. `agent-pay address`
4. `agent-pay balance`
5. `agent-pay send --to <addr> --amount <decimal> [--yes] [--json]`
6. `agent-pay send-eth --to <addr> --amount <decimal> [--show-balance] [--confirmations <n>] [--yes] [--json]`
7. `agent-pay send-token --asset <address> --to <addr> --amount <decimal> [--confirmations <n>] [--yes] [--json]`
8. `agent-pay pay-url <url> [--method <M>] [--header "K: V"] [--data <raw>] [--content-type <mime>] [--timeout <sec>] [--allowlist <domains>] [--yes] [--json]`

### Core API
- `sendUsdc(to, amount)`
- `sendEth(to, amount)`
- `sendToken(asset, to, amount)`
- `payUrl(url, opts?)` with `{ method?, headers?, data?, contentType?, timeoutSeconds?, allowlist? }`
- `getBalances()`

### Config
- `~/.agent-pay/config.json` with `version, rpcUrl, privateKey, chainId, usdcAddress, assets, limits, allowlistDomains`
- Best‑effort `chmod 0600` with warning if not enforceable.

Assets allowlist:
```json
{
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { "symbol": "USDC", "decimals": 6 }
}
```
Invoices and `send-token` require the asset to be present in this allowlist.

### Ledger
- `~/.agent-pay/spend-ledger.jsonl` line‑delimited JSON events.
- UTC day boundary, count **submitted** spends.
- Each event includes `status: "submitted"`.

## JSON Output Schemas (Stable v1)

**Success**
```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "<command>",
  "...": "..."
}
```

**Error**
```json
{
  "schemaVersion": 1,
  "ok": false,
  "command": "<command>",
  "error": {
    "code": "<machine_code>",
    "message": "<human_message>",
    "details": {}
  }
}
```

## 402 / pay-url Contract

### Invoice source priority (header case-insensitive)
1. `PAYMENT-REQUIRED` (canonical)
2. `X-Payment-Required` (legacy/custom)
3. JSON body fallback

### Header parsing
- Canonical header value is **base64 JSON**.
- Also accept raw JSON if not base64‑encoded.

### Network validation (explicit CAIP‑2)
- If `network` present, require exact **"eip155:8453"** (CAIP‑2 Base mainnet).

### Chain ID validation
- If `chainId` present, require `8453`.
- If both `network` and `chainId` present, both must match.

### Asset validation
- `asset` must equal configured `usdcAddress`.
- If `assetDecimals` present and mismatch, fail.

### Amount parsing
- Strict decimal format, no floats.
- Use `ethers.parseUnits(amountRequired, assetDecimals)`.

### Expiry
- If `expiresAt` is already in the past before broadcast, fail.
- If it expires after broadcast but before confirmations, still retry.

### Confirmations
- Wait explicitly for `minConfirmations` via `tx.wait(minConfirmations)`.

### Retry
- Preserve original request exactly: method, headers, body, content‑type.
- Add `X-Payment: <0x txHash>` and `X-Invoice-Id: <invoiceId>`.
- If `resource` starts with `/`, retry `new URL(resource, originalOrigin)`.

### Timeout semantics
- Default timeout = `invoice.maxTimeoutSeconds`.
- If `--timeout` provided, use `min(userTimeout, invoice.maxTimeoutSeconds)`.

### Content‑Type
- If `--data` provided and `--content-type` absent, default to `application/json`.
