import { ethers } from "ethers";
import { AgentPayConfig } from "../config.js";
import { ERC20_ABI } from "./erc20.js";
import { USDC_DECIMALS } from "../constants.js";

export async function getBalances(config: AgentPayConfig): Promise<{ eth: string; usdc: string }> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const address = await wallet.getAddress();
  const ethBalance = await provider.getBalance(address);

  const token = new ethers.Contract(config.usdcAddress, ERC20_ABI, provider);
  const usdcBalance = await token.balanceOf(address);

  return {
    eth: ethers.formatEther(ethBalance),
    usdc: ethers.formatUnits(usdcBalance, USDC_DECIMALS),
  };
}
