import { AgentPayConfig } from "../config.js";
import { parseDecimalToUnits } from "../utils.js";
import { sumSpentTodayUTC } from "../ledger.js";
import { USDC_DECIMALS } from "../constants.js";
import { CliError } from "../errors.js";

export async function enforceLimits(amountUnits: bigint, config: AgentPayConfig): Promise<void> {
  if (config.maxPerTxUsdc) {
    const maxPerTxUnits = parseDecimalToUnits(config.maxPerTxUsdc, USDC_DECIMALS);
    if (amountUnits > maxPerTxUnits) {
      throw new CliError("max_per_tx_exceeded", "Amount exceeds MAX_PER_TX_USDC.");
    }
  }

  if (config.maxPerDayUsdc) {
    const maxPerDayUnits = parseDecimalToUnits(config.maxPerDayUsdc, USDC_DECIMALS);
    const spentToday = await sumSpentTodayUTC(config.usdcAddress);
    if (spentToday + amountUnits > maxPerDayUnits) {
      throw new CliError("max_per_day_exceeded", "Daily spend limit exceeded.");
    }
  }
}
