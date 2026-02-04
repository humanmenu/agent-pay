import fs from "fs/promises";
import path from "path";
import os from "os";
import { DEFAULT_USDC_ADDRESS, BASE_CHAIN_ID, USDC_DECIMALS } from "./constants.js";
import { CliError } from "./errors.js";
import { normalizeAddress } from "./utils.js";

export interface AssetConfig {
  symbol?: string;
  decimals: number;
}

export interface AgentPayConfig {
  version: 1;
  rpcUrl: string;
  privateKey: string;
  chainId: number;
  usdcAddress: string;
  assets?: Record<string, AssetConfig>;
  maxPerTxUsdc?: string;
  maxPerDayUsdc?: string;
  allowlistDomains?: string[];
}

const CONFIG_DIR = path.join(os.homedir(), ".agent-pay");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const LEDGER_PATH = path.join(CONFIG_DIR, "spend-ledger.jsonl");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getLedgerPath(): string {
  return LEDGER_PATH;
}

export async function readConfig(): Promise<AgentPayConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as AgentPayConfig;
    return parsed;
  } catch (err) {
    return null;
  }
}

export async function writeConfig(config: AgentPayConfig): Promise<{ path: string; chmodOk: boolean }> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  let chmodOk = true;
  try {
    await fs.chmod(CONFIG_PATH, 0o600);
  } catch {
    chmodOk = false;
  }
  return { path: CONFIG_PATH, chmodOk };
}

function parseAllowlist(value?: string): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseChainId(value?: string): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export function configFromEnv(): Partial<AgentPayConfig> {
  const env = process.env;
  const overrides: Partial<AgentPayConfig> = {};
  if (env.AGENT_PAY_RPC_URL) overrides.rpcUrl = env.AGENT_PAY_RPC_URL;
  if (env.AGENT_PAY_PRIVATE_KEY) overrides.privateKey = env.AGENT_PAY_PRIVATE_KEY;
  const chainId = parseChainId(env.AGENT_PAY_CHAIN_ID);
  if (chainId) overrides.chainId = chainId;
  if (env.AGENT_PAY_USDC_ADDRESS) overrides.usdcAddress = env.AGENT_PAY_USDC_ADDRESS;
  if (env.AGENT_PAY_MAX_PER_TX_USDC) overrides.maxPerTxUsdc = env.AGENT_PAY_MAX_PER_TX_USDC;
  if (env.AGENT_PAY_MAX_PER_DAY_USDC) overrides.maxPerDayUsdc = env.AGENT_PAY_MAX_PER_DAY_USDC;
  const allowlist = parseAllowlist(env.AGENT_PAY_ALLOWLIST_DOMAINS);
  if (allowlist) overrides.allowlistDomains = allowlist;
  if (env.AGENT_PAY_ASSETS_JSON) {
    try {
      const parsed = JSON.parse(env.AGENT_PAY_ASSETS_JSON);
      const normalized = normalizeAssets(parsed);
      if (!normalized) {
        throw new CliError("invalid_assets_json", "AGENT_PAY_ASSETS_JSON must be a JSON object of assets.");
      }
      overrides.assets = normalized;
    } catch (err) {
      if (err instanceof CliError) throw err;
      throw new CliError("invalid_assets_json", "AGENT_PAY_ASSETS_JSON must be valid JSON.");
    }
  }
  return overrides;
}

function normalizeAssets(raw: unknown): Record<string, AssetConfig> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const entries = Object.entries(raw as Record<string, AssetConfig>);
  if (entries.length === 0) return undefined;
  const out: Record<string, AssetConfig> = {};
  for (const [address, value] of entries) {
    if (!value || typeof value !== "object") {
      throw new CliError("invalid_asset_config", "Asset config must be an object.", { address });
    }
    const decimals = Number((value as AssetConfig).decimals);
    if (!Number.isFinite(decimals) || decimals < 0) {
      throw new CliError("invalid_asset_decimals", "Asset decimals must be a non-negative integer.", { address });
    }
    const normalized = normalizeAddress(address);
    const symbol = typeof (value as AssetConfig).symbol === "string" ? (value as AssetConfig).symbol : undefined;
    out[normalized] = {
      decimals: Math.floor(decimals),
      ...(symbol ? { symbol } : {}),
    };
  }
  return out;
}

export async function resolveConfig(): Promise<AgentPayConfig> {
  const fileConfig = await readConfig();
  const envConfig = configFromEnv();
  const merged: Partial<AgentPayConfig> = {
    version: 1,
    chainId: BASE_CHAIN_ID,
    usdcAddress: DEFAULT_USDC_ADDRESS,
    ...fileConfig,
    ...envConfig,
  };

  if (!merged.rpcUrl) {
    throw new CliError("missing_rpc_url", "RPC URL missing. Run agent-pay init or set AGENT_PAY_RPC_URL.");
  }
  if (!merged.privateKey) {
    throw new CliError("missing_private_key", "Private key missing. Run agent-pay init or set AGENT_PAY_PRIVATE_KEY.");
  }
  if (!merged.chainId) {
    throw new CliError("missing_chain_id", "Chain ID missing. Set AGENT_PAY_CHAIN_ID or re-run init.");
  }
  if (!merged.usdcAddress) {
    throw new CliError("missing_usdc_address", "USDC address missing. Set AGENT_PAY_USDC_ADDRESS or re-run init.");
  }

  const chainIdNum = Number(merged.chainId);
  if (!Number.isFinite(chainIdNum)) {
    throw new CliError("invalid_chain_id", "Chain ID must be a number.");
  }
  merged.chainId = chainIdNum;
  merged.usdcAddress = normalizeAddress(merged.usdcAddress);

  const defaultAssets: Record<string, AssetConfig> = {
    [normalizeAddress(DEFAULT_USDC_ADDRESS)]: { symbol: "USDC", decimals: USDC_DECIMALS },
  };
  const fileAssets = normalizeAssets((fileConfig as AgentPayConfig | null)?.assets);
  const envAssets = normalizeAssets((envConfig as AgentPayConfig).assets);
  const mergedAssets: Record<string, AssetConfig> = {
    ...defaultAssets,
    ...(fileAssets || {}),
    ...(envAssets || {}),
  };
  if (!mergedAssets[merged.usdcAddress]) {
    mergedAssets[merged.usdcAddress] = { symbol: "USDC", decimals: USDC_DECIMALS };
  }
  merged.assets = mergedAssets;

  return merged as AgentPayConfig;
}
