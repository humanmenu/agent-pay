# agent-pay — Open Source USDC Autopay for AI Agents (v1 Spec)

**Note:** The v1 spec is frozen in `SPEC.md` and is the current source of truth. This document is legacy planning context.

This document is the **main source of truth** for building and publishing the `agent-pay` open‑source project.

`agent-pay` is a non‑custodial CLI + library that enables any autonomous agent (or human) running on a machine with terminal access to:

1. Send **USDC** on **Base** to any wallet
2. Automatically complete a **402 Payment Required → Pay → Retry** flow for paid HTTP APIs (x402‑style)

---

## 0. Philosophy & Scope

### Core Principles
- **Non‑custodial**: keys never leave the user machine
- **Agent‑native**: built for terminal agents that can run programs
- **Minimal**: small, auditable, composable
- **Open**: works for any recipient wallet, not vendor‑locked

### Non‑Goals
- No hosted payment service
- No wallet custody
- No dashboard/OAuth
- No compliance/KYC
- No guarantee of safety (operators assume risk)

---

## 1. Primary Use Cases

### Use Case A — Direct USDC Transfer
An agent pays a human wallet:

```bash
agent-pay send --to 0xRecipient --amount 0.10
```

### Use Case B — Paywall Unlock (402 Autopay)
Agent hits a paid endpoint:

```bash
agent-pay pay-url "https://human.menu/api/?action=unlock_deliverable&task_id=3"
```

Tool handles:

```
request → 402 invoice → pay USDC → retry → deliverable
```

---

## 2. Supported Networks & Assets (v1)

### Network
- Base Mainnet
- `chainId = 8453`

### Token
- USDC (ERC‑20)
- Decimals: 6

Default USDC contract (Base):

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

---

## 3. Payment Invoice Contract (Human Menu v1)

When an API requires payment, it returns HTTP **402** with this JSON payload:

```json
{
  "ok": false,
  "error": "payment_required",
  "scheme": "exact",
  "network": "eip155:8453",
  "chainId": 8453,
  "amountRequired": "0.10",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "assetSymbol": "USDC",
  "assetDecimals": 6,
  "payTo": "0x...",
  "invoiceId": "unlock_deliverable:task=3:nonce=...",
  "minConfirmations": 1,
  "maxTimeoutSeconds": 300,
  "expiresAt": "2026-02-03T11:26:06Z",
  "resource": "/api/?action=unlock_deliverable&task_id=3",
  "proof": {
    "type": "txHash",
    "header": "X-Payment"
  },
  "instructions": "Send USDC then retry with X-Payment (txHash) and X-Invoice-Id"
}
```

### Retry Contract
Client retries with:

```
X-Invoice-Id: <invoiceId>
X-Payment: 0x<txHash>
```

---

## 4. CLI Commands (v1)

### 4.1 `agent-pay init`
One-time setup.

Creates config at:

- `~/.agent-pay/config.json`

Prompts for:
- Base RPC URL
- Private key (hot wallet)
- Default token (USDC)

---

### 4.2 `agent-pay doctor`
Validates environment:
- RPC reachable
- Correct chainId
- Wallet address
- ETH balance (gas)
- USDC balance

---

### 4.3 `agent-pay address`
Print wallet address.

---

### 4.4 `agent-pay balance`
Print ETH + USDC balances.

---

### 4.5 `agent-pay send`
Send USDC.

```bash
agent-pay send --to 0xRecipient --amount 0.10
```

Validations:
- address valid
- amount > 0
- enforce max limits if configured

Outputs:
- txHash

---

### 4.6 `agent-pay pay-url`
Autopay HTTP endpoint.

```bash
agent-pay pay-url "https://..."
```

Flow:
1. Request URL
2. If 402 → parse invoice
3. Send USDC transfer
4. Wait confirmations
5. Retry with headers
6. Return final response

---

## 5. Core Library API (optional but recommended)

Package: `@agent-pay/core`

Exports:

```ts
sendUsdc(to, amount)
payUrl(url)
getBalances()
```

---

## 6. Implementation Choices

- TypeScript
- Node.js 18+
- `ethers` for signing + ERC‑20 calls
- `commander` for CLI
- native fetch for HTTP

---

## 7. Safety Guardrails (Operator Responsibility)

Optional config:

- `MAX_PER_TX_USDC`
- `MAX_PER_DAY_USDC`
- `ALLOWLIST_DOMAINS`

Local ledger:

`~/.agent-pay/spend-ledger.json`

---

## 8. Repository Setup

Structure:

```
agent-pay/
  packages/
    cli/
    core/
  README.md
  LICENSE
  SECURITY.md
```

---

## 9. Publishing Checklist

### GitHub
1. Create repo `agent-pay`
2. Add MIT license
3. Add README quickstart
4. Add SECURITY disclaimer

### npm Publish

```bash
npm login
npm publish --access public
```

### Release
- Tag v1.0.0
- GitHub Release notes

### Announcement
Post on:
- X (crypto + AI)
- Hacker News
- Reddit r/LocalLLaMA

Headline:
> Open-source USDC autopay client for autonomous agents (402/x402 compatible)

---

## 10. Next Steps

v1 goal:
- init
- doctor
- send
- pay-url

Once complete:
- add testnet mode
- add more chains/assets
- formal x402 header compatibility

---

**This document defines the full build + release plan for agent-pay.**
