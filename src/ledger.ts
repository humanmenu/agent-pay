import fs from "fs/promises";
import path from "path";
import { getLedgerPath } from "./config.js";
import { parseDecimalToUnits } from "./utils.js";
import { USDC_DECIMALS } from "./constants.js";

export interface LedgerEntry {
  ts: string;
  to: string;
  amount: string;
  txHash: string;
  invoiceId?: string;
  chainId: number;
  asset: string;
  status: "submitted";
}

export async function appendLedger(entry: LedgerEntry): Promise<void> {
  const line = JSON.stringify(entry);
  const dir = path.dirname(getLedgerPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(getLedgerPath(), `${line}\n`, "utf8");
}

export async function sumSpentTodayUTC(assetAddress: string): Promise<bigint> {
  try {
    const raw = await fs.readFile(getLedgerPath(), "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
    const normalizedAsset = assetAddress.toLowerCase();
    let total = 0n;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LedgerEntry;
        const ts = Date.parse(entry.ts);
        if (Number.isNaN(ts)) continue;
        if (entry.status !== "submitted") continue;
        if (entry.asset.toLowerCase() !== normalizedAsset) continue;
        if (ts >= start && ts < end) {
          total += parseDecimalToUnits(entry.amount, USDC_DECIMALS);
        }
      } catch {
        continue;
      }
    }
    return total;
  } catch {
    return 0n;
  }
}
