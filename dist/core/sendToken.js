import { ethers } from "ethers";
import { CliError } from "../errors.js";
import { normalizeAddress, parseDecimalToUnits } from "../utils.js";
import { ERC20_ABI } from "./erc20.js";
import { enforceLimits } from "./limits.js";
import { appendLedger } from "../ledger.js";
function getAssetConfig(asset, assets) {
    if (!assets) {
        throw new CliError("asset_not_allowed", "No assets allowlist configured.");
    }
    const normalized = normalizeAddress(asset);
    const entry = assets[normalized];
    if (!entry) {
        throw new CliError("asset_not_allowed", "Asset is not in allowlist.", { asset: normalized });
    }
    return { address: normalized, config: entry };
}
export async function sendToken(asset, to, amount, config) {
    const normalizedTo = normalizeAddress(to);
    const { address: assetAddress, config: assetConfig } = getAssetConfig(asset, config.assets);
    const amountUnits = parseDecimalToUnits(amount, assetConfig.decimals);
    if (amountUnits <= 0n) {
        throw new CliError("invalid_amount", "Amount must be greater than 0.");
    }
    if (assetAddress === config.usdcAddress) {
        await enforceLimits(amountUnits, config);
    }
    const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const token = new ethers.Contract(assetAddress, ERC20_ABI, wallet);
    const tx = await token.transfer(normalizedTo, amountUnits);
    await appendLedger({
        ts: new Date().toISOString(),
        to: normalizedTo,
        amount,
        txHash: tx.hash,
        chainId: config.chainId,
        asset: assetAddress,
        status: "submitted",
    });
    return {
        txHash: tx.hash,
        amountUnits,
        to: normalizedTo,
        asset: assetAddress,
    };
}
