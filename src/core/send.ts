import { ethers } from "ethers";
import { AgentPayConfig } from "../config.js";
import { ERC20_ABI } from "./erc20.js";
import { parseDecimalToUnits, normalizeAddress } from "../utils.js";
import { appendLedger } from "../ledger.js";
import { USDC_DECIMALS } from "../constants.js";
import { enforceLimits } from "./limits.js";

export interface SendResult {
  txHash: string;
  amountUnits: bigint;
  to: string;
}

export async function sendUsdc(to: string, amount: string, config: AgentPayConfig): Promise<SendResult> {
  const normalizedTo = normalizeAddress(to);
  const amountUnits = parseDecimalToUnits(amount, USDC_DECIMALS);
  await enforceLimits(amountUnits, config);

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const token = new ethers.Contract(config.usdcAddress, ERC20_ABI, wallet);

  const tx = await token.transfer(normalizedTo, amountUnits);

  await appendLedger({
    ts: new Date().toISOString(),
    to: normalizedTo,
    amount,
    txHash: tx.hash,
    chainId: config.chainId,
    asset: config.usdcAddress,
    status: "submitted",
  });

  return {
    txHash: tx.hash,
    amountUnits,
    to: normalizedTo,
  };
}
