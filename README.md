# agent-pay

Open-source USDC autopay client for agents (402 exact scheme) on Base.

## Highlights
- Non-custodial: keys never leave your machine.
- Wizard-first `init` with non-interactive flags for agents.
- Strict exact 402 scheme, fail-closed parsing.
- Minimal dependencies: `ethers`, `commander`, native `fetch`.

## Install

```bash
npm install -g @humanmenu/agent-pay
```

The binary is still `agent-pay`.

## Canonical Base USDC

Default USDC address (Base mainnet):

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## Quickstart

```bash
agent-pay init
agent-pay doctor
agent-pay send --to 0xRecipient --amount 0.10
agent-pay pay-url "https://example.com/api/paid"
```

## How It Works
`agent-pay` supports two payment modes:
1. **Direct USDC transfer** with `agent-pay send`.
2. **402 autopay** with `agent-pay pay-url`. Flow: request URL → if 402 parse invoice → transfer USDC → wait confirmations → retry with `X-Payment` and `X-Invoice-Id`.

The 402 flow is strict by design: if an invoice field is missing or mismatched, the client fails closed.

## Config

Config path:

```
~/.agent-pay/config.json
```

Environment overrides:
- `AGENT_PAY_RPC_URL`
- `AGENT_PAY_PRIVATE_KEY`
- `AGENT_PAY_CHAIN_ID`
- `AGENT_PAY_USDC_ADDRESS`
- `AGENT_PAY_ASSETS_JSON`
- `AGENT_PAY_MAX_PER_TX_USDC`
- `AGENT_PAY_MAX_PER_DAY_USDC`
- `AGENT_PAY_ALLOWLIST_DOMAINS`

Defaults:
- `AGENT_PAY_CHAIN_ID` defaults to `8453` (Base mainnet)
- `AGENT_PAY_USDC_ADDRESS` defaults to Base USDC

Assets allowlist (optional):
```bash
export AGENT_PAY_ASSETS_JSON='{
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { "symbol": "USDC", "decimals": 6 }
}'
```
Only assets in this allowlist can be paid via invoices or sent with `send-token`.

## CLI Commands

### `agent-pay init`
Interactive wizard (or `--non-interactive`). Writes config and runs `doctor`.

### `agent-pay doctor`
Validates RPC, chain ID, address, ETH + USDC balances.

### `agent-pay address`
Prints the configured wallet address.

### `agent-pay balance`
Prints ETH and USDC balances.

### `agent-pay send`
```bash
agent-pay send --to 0xRecipient --amount 0.10
```

Notes:
- Sends **USDC on Base** (ERC‑20).
- Enforces optional limits (`MAX_PER_TX_USDC`, `MAX_PER_DAY_USDC`) if configured.

### `agent-pay send-eth`
```bash
agent-pay send-eth --to 0xRecipient --amount 0.001
```

Options:
- `--show-balance` (print ETH balance before sending)
- `--confirmations <n>` (wait for n confirmations)

Notes:
- Sends **native ETH** on the configured chain (Base by default).
- Use `--confirmations 1` if you want the command to block until confirmed.

### `agent-pay send-token`
```bash
agent-pay send-token --asset 0xToken --to 0xRecipient --amount 1.5
```

Options:
- `--confirmations <n>` (wait for n confirmations)

Notes:
- Only **allowlisted assets** can be sent.
- Use `AGENT_PAY_ASSETS_JSON` to add assets.

### `agent-pay pay-url`
```bash
agent-pay pay-url "https://example.com/paid" \
  --method POST \
  --header "Authorization: Bearer ..." \
  --data '{"task_id": 3}' \
  --content-type application/json \
  --timeout 120
```

Options:
- `--method <M>`
- `--header "K: V"` (repeatable)
- `--data <raw>`
- `--content-type <mime>`
- `--timeout <seconds>`
- `--allowlist <domains>`
- `--yes` (skip confirmation)
- `--json` (machine output)

Note: In non-interactive environments, spending actions require `--yes`.

## Common Gotchas
- **Invoice expiry**: `expiresAt` must be in the future. If it’s “right now,” clients may reject it.
- **Allowlist**: if `ALLOWLIST_DOMAINS` is set, the target domain must match.
- **Assets**: invoices for non‑allowlisted assets will be rejected.
- **Custodial wallets**: exchange deposit addresses can delay/deny small deposits. For payouts, use a self‑custody Base wallet when possible.

## JSON Output
All JSON output includes:
- `schemaVersion: 1`
- `ok: boolean`
- `command: string`

Errors include:
```json
{
  "schemaVersion": 1,
  "ok": false,
  "command": "send",
  "error": {
    "code": "...",
    "message": "...",
    "details": {}
  }
}
```

## Security
`agent-pay` is non-custodial and intentionally minimal. You are responsible for key safety, RPC trust, and operational security.

See `SECURITY.md` for disclaimers.

## Spec
Full v1 spec lives in `SPEC.md`.
