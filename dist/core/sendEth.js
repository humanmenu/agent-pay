import { ethers } from "ethers";
import { CliError } from "../errors.js";
import { normalizeAddress, parseDecimalToUnits } from "../utils.js";
export async function sendEth(to, amount, config) {
    const normalizedTo = normalizeAddress(to);
    const amountUnits = parseDecimalToUnits(amount, 18);
    if (amountUnits <= 0n) {
        throw new CliError("invalid_amount", "Amount must be greater than 0.");
    }
    const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const tx = await wallet.sendTransaction({
        to: normalizedTo,
        value: amountUnits,
    });
    return {
        txHash: tx.hash,
        amountUnits,
        to: normalizedTo,
    };
}
