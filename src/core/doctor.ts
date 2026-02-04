import { ethers } from "ethers";
import { AgentPayConfig } from "../config.js";
import { ERC20_ABI } from "./erc20.js";
import { USDC_DECIMALS } from "../constants.js";

export interface DoctorResult {
  ok: boolean;
  chainId: number | null;
  address: string | null;
  ethBalance: string | null;
  usdcBalance: string | null;
  warnings: string[];
}

export async function doctor(config: AgentPayConfig): Promise<DoctorResult> {
  const warnings: string[] = [];
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  let chainId: number | null = null;
  let address: string | null = null;
  let ethBalance: string | null = null;
  let usdcBalance: string | null = null;

  try {
    const network = await provider.getNetwork();
    chainId = Number(network.chainId);
    if (chainId !== config.chainId) {
      warnings.push(`RPC chainId ${chainId} does not match config chainId ${config.chainId}.`);
    }
  } catch (err: any) {
    const message = err?.message || "Unknown RPC error";
    if (message.includes("429") || message.toLowerCase().includes("rate") || message.toLowerCase().includes("too many")) {
      warnings.push("RPC rate-limited. Use a dedicated RPC provider.");
    }
    return {
      ok: false,
      chainId,
      address,
      ethBalance,
      usdcBalance,
      warnings,
    };
  }

  try {
    const wallet = new ethers.Wallet(config.privateKey, provider);
    address = await wallet.getAddress();
    const eth = await provider.getBalance(address);
    ethBalance = ethers.formatEther(eth);

    const token = new ethers.Contract(config.usdcAddress, ERC20_ABI, provider);
    const usdc = await token.balanceOf(address);
    usdcBalance = ethers.formatUnits(usdc, USDC_DECIMALS);

    return {
      ok: true,
      chainId,
      address,
      ethBalance,
      usdcBalance,
      warnings,
    };
  } catch (err: any) {
    const message = err?.message || "Unknown wallet error";
    warnings.push(message);
    return {
      ok: false,
      chainId,
      address,
      ethBalance,
      usdcBalance,
      warnings,
    };
  }
}
