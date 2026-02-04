#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { BASE_CHAIN_ID, DEFAULT_PUBLIC_RPC, DEFAULT_USDC_ADDRESS } from "./constants.js";
import { resolveConfig, writeConfig, getConfigPath } from "./config.js";
import { sendUsdc } from "./core/send.js";
import { sendEth } from "./core/sendEth.js";
import { sendToken } from "./core/sendToken.js";
import { payUrl } from "./core/payUrl.js";
import { getBalances } from "./core/balances.js";
import { doctor } from "./core/doctor.js";
import { CliError, jsonError, jsonSuccess } from "./errors.js";
import { normalizeAddress } from "./utils.js";
import { prompt, promptHidden, promptSelect, promptYesNo } from "./prompts.js";
const program = new Command();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, "..", "package.json");
const getVersion = () => {
    try {
        const raw = fs.readFileSync(pkgPath, "utf8");
        const parsed = JSON.parse(raw);
        return parsed.version || "0.0.0";
    }
    catch {
        return "0.0.0";
    }
};
program
    .name("agent-pay")
    .description("Open-source USDC autopay client for agents (402 exact scheme).")
    .version(getVersion());
function outputJson(payload) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
function handleError(command, err, json) {
    const error = err instanceof Error ? err : new Error("Unknown error");
    if (json) {
        outputJson(jsonError(command, error instanceof CliError ? error : error));
    }
    else {
        const code = error instanceof CliError ? error.code : "unknown_error";
        console.error(`[${code}] ${error.message}`);
        if (error instanceof CliError && error.details) {
            console.error(JSON.stringify(error.details, null, 2));
        }
    }
    process.exitCode = 1;
}
function parseHeaders(values) {
    if (!values || values.length === 0)
        return undefined;
    const headers = {};
    for (const entry of values) {
        const idx = entry.indexOf(":");
        if (idx === -1) {
            throw new CliError("invalid_header", `Invalid header format: ${entry}. Use \"Key: Value\".`);
        }
        const key = entry.slice(0, idx).trim();
        const value = entry.slice(idx + 1).trim();
        if (!key || !value) {
            throw new CliError("invalid_header", `Invalid header format: ${entry}. Use \"Key: Value\".`);
        }
        headers[key] = value;
    }
    return headers;
}
function parseAllowlist(value) {
    if (!value)
        return undefined;
    const list = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return list.length ? list : undefined;
}
function requireYesWhenNonInteractive(isYes) {
    if (!process.stdin.isTTY && !isYes) {
        throw new CliError("non_interactive_requires_yes", "Non-interactive spending requires --yes.");
    }
}
program
    .command("init")
    .description("Initialize agent-pay configuration.")
    .option("--rpc-url <url>", "RPC URL")
    .option("--private-key <key>", "Private key")
    .option("--max-per-tx <amount>", "Max USDC per transaction")
    .option("--max-per-day <amount>", "Max USDC per day")
    .option("--allowlist <domains>", "Comma-separated allowlist domains")
    .option("--non-interactive", "Disable prompts and require flags/env")
    .option("--json", "Output JSON")
    .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
        const nonInteractive = Boolean(opts.nonInteractive) || !process.stdin.isTTY;
        let rpcUrl = opts.rpcUrl || process.env.AGENT_PAY_RPC_URL;
        let privateKey = opts.privateKey || process.env.AGENT_PAY_PRIVATE_KEY;
        let maxPerTx = opts.maxPerTx || process.env.AGENT_PAY_MAX_PER_TX_USDC;
        let maxPerDay = opts.maxPerDay || process.env.AGENT_PAY_MAX_PER_DAY_USDC;
        let allowlist = opts.allowlist || process.env.AGENT_PAY_ALLOWLIST_DOMAINS;
        if (nonInteractive) {
            if (!rpcUrl) {
                throw new CliError("missing_rpc_url", "RPC URL required in non-interactive mode.");
            }
            if (!privateKey) {
                throw new CliError("missing_private_key", "Private key required in non-interactive mode.");
            }
        }
        else {
            console.log("RPC URL is required to broadcast transactions on Base.");
            const selection = await promptSelect("Choose an RPC option:", [
                "Use Base public RPC (may rate limit)",
                "Enter my own RPC URL (recommended for reliability)",
            ]);
            if (selection === 0) {
                console.log("Note: public RPCs can rate-limit. For production agents, use a dedicated provider.");
                rpcUrl = DEFAULT_PUBLIC_RPC;
            }
            else {
                rpcUrl = await prompt("RPC URL", rpcUrl);
            }
            privateKey = await promptHidden("Private key (will be stored locally): ");
            maxPerTx = await prompt("Max USDC per transaction (optional)", maxPerTx);
            maxPerDay = await prompt("Max USDC per day (optional)", maxPerDay);
            allowlist = await prompt("Allowlist domains (comma-separated, optional)", allowlist);
        }
        const config = {
            version: 1,
            rpcUrl: rpcUrl?.trim() || "",
            privateKey: privateKey?.trim() || "",
            chainId: BASE_CHAIN_ID,
            usdcAddress: DEFAULT_USDC_ADDRESS,
            maxPerTxUsdc: maxPerTx?.trim() || undefined,
            maxPerDayUsdc: maxPerDay?.trim() || undefined,
            allowlistDomains: parseAllowlist(allowlist),
        };
        if (!config.rpcUrl) {
            throw new CliError("missing_rpc_url", "RPC URL required.");
        }
        if (!config.privateKey) {
            throw new CliError("missing_private_key", "Private key required.");
        }
        const { path, chmodOk } = await writeConfig(config);
        const doctorResult = await doctor(config);
        if (json) {
            outputJson(jsonSuccess("init", {
                configPath: path,
                chmodOk,
                doctor: doctorResult,
            }));
        }
        else {
            console.log(`Config saved to ${path}`);
            if (!chmodOk) {
                console.warn("Warning: unable to enforce file permissions. Secure this file manually.");
            }
            if (doctorResult.ok) {
                console.log("Doctor: OK");
            }
            else {
                console.log("Doctor: issues detected");
            }
            if (doctorResult.warnings.length) {
                doctorResult.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
            }
        }
    }
    catch (err) {
        handleError("init", err, json);
    }
});
program
    .command("doctor")
    .description("Validate RPC, chain, and balances.")
    .option("--json", "Output JSON")
    .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
        const config = await resolveConfig();
        const result = await doctor(config);
        if (json) {
            outputJson(jsonSuccess("doctor", result));
        }
        else {
            console.log(`Config: ${getConfigPath()}`);
            if (result.address)
                console.log(`Address: ${result.address}`);
            if (result.chainId)
                console.log(`Chain ID: ${result.chainId}`);
            if (result.ethBalance)
                console.log(`ETH: ${result.ethBalance}`);
            if (result.usdcBalance)
                console.log(`USDC: ${result.usdcBalance}`);
            if (!result.ok)
                console.log("Doctor: issues detected");
            if (result.warnings.length) {
                result.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
            }
        }
    }
    catch (err) {
        handleError("doctor", err, json);
    }
});
program
    .command("address")
    .description("Print wallet address.")
    .option("--json", "Output JSON")
    .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
        const config = await resolveConfig();
        const wallet = new ethers.Wallet(config.privateKey);
        const address = await wallet.getAddress();
        if (json) {
            outputJson(jsonSuccess("address", { address }));
        }
        else {
            console.log(address);
        }
    }
    catch (err) {
        handleError("address", err, json);
    }
});
program
    .command("balance")
    .description("Print ETH + USDC balances.")
    .option("--json", "Output JSON")
    .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
        const config = await resolveConfig();
        const balances = await getBalances(config);
        if (json) {
            outputJson(jsonSuccess("balance", balances));
        }
        else {
            console.log(`ETH: ${balances.eth}`);
            console.log(`USDC: ${balances.usdc}`);
        }
    }
    catch (err) {
        handleError("balance", err, json);
    }
});
program
    .command("send")
    .description("Send USDC.")
    .requiredOption("--to <address>", "Recipient address")
    .requiredOption("--amount <amount>", "Amount of USDC to send")
    .option("--yes", "Skip confirmation")
    .option("--json", "Output JSON")
    .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
        requireYesWhenNonInteractive(Boolean(opts.yes));
        const config = await resolveConfig();
        const to = normalizeAddress(opts.to);
        const amount = opts.amount;
        if (process.stdin.isTTY && !opts.yes) {
            const ok = await promptYesNo(`Send ${amount} USDC to ${to}?`);
            if (!ok) {
                throw new CliError("cancelled", "Transaction cancelled by user.");
            }
        }
        const result = await sendUsdc(to, amount, config);
        if (json) {
            outputJson(jsonSuccess("send", {
                txHash: result.txHash,
                to: result.to,
                amount,
                chainId: config.chainId,
                asset: config.usdcAddress,
            }));
        }
        else {
            console.log(`txHash: ${result.txHash}`);
        }
    }
    catch (err) {
        handleError("send", err, json);
    }
});
program
    .command("send-token")
    .description("Send an allowlisted ERC-20 token.")
    .requiredOption("--asset <address>", "Token contract address")
    .requiredOption("--to <address>", "Recipient address")
    .requiredOption("--amount <amount>", "Amount of token to send")
    .option("--confirmations <n>", "Wait for n confirmations before returning")
    .option("--yes", "Skip confirmation")
    .option("--json", "Output JSON")
    .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
        requireYesWhenNonInteractive(Boolean(opts.yes));
        const config = await resolveConfig();
        const asset = normalizeAddress(opts.asset);
        const to = normalizeAddress(opts.to);
        const amount = opts.amount;
        if (process.stdin.isTTY && !opts.yes) {
            const ok = await promptYesNo(`Send ${amount} token from ${asset} to ${to}?`);
            if (!ok) {
                throw new CliError("cancelled", "Transaction cancelled by user.");
            }
        }
        const result = await sendToken(asset, to, amount, config);
        let confirmed;
        let confirmations;
        if (opts.confirmations !== undefined) {
            const parsed = Number(opts.confirmations);
            if (!Number.isFinite(parsed) || parsed < 1) {
                throw new CliError("invalid_confirmations", "Confirmations must be a positive integer.");
            }
            confirmations = Math.floor(parsed);
            const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
            const receipt = await provider.waitForTransaction(result.txHash, confirmations);
            if (!receipt || receipt.status !== 1) {
                throw new CliError("tx_failed", "Token transfer failed or not confirmed.");
            }
            confirmed = true;
        }
        if (json) {
            outputJson(jsonSuccess("send-token", {
                txHash: result.txHash,
                to: result.to,
                amount,
                chainId: config.chainId,
                asset: result.asset,
                confirmed,
                confirmations,
            }));
        }
        else {
            console.log(`txHash: ${result.txHash}`);
        }
    }
    catch (err) {
        handleError("send-token", err, json);
    }
});
program
    .command("send-eth")
    .description("Send ETH.")
    .requiredOption("--to <address>", "Recipient address")
    .requiredOption("--amount <amount>", "Amount of ETH to send")
    .option("--show-balance", "Show ETH balance before sending")
    .option("--confirmations <n>", "Wait for n confirmations before returning")
    .option("--yes", "Skip confirmation")
    .option("--json", "Output JSON")
    .action(async (opts) => {
    const json = Boolean(opts.json);
    try {
        requireYesWhenNonInteractive(Boolean(opts.yes));
        const config = await resolveConfig();
        const to = normalizeAddress(opts.to);
        const amount = opts.amount;
        let preBalance;
        let provider;
        const getProvider = () => {
            if (!provider) {
                provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
            }
            return provider;
        };
        if (opts.showBalance) {
            const wallet = new ethers.Wallet(config.privateKey, getProvider());
            preBalance = ethers.formatEther(await getProvider().getBalance(await wallet.getAddress()));
            if (!json) {
                console.log(`ETH balance: ${preBalance}`);
            }
        }
        if (process.stdin.isTTY && !opts.yes) {
            const ok = await promptYesNo(`Send ${amount} ETH to ${to}?`);
            if (!ok) {
                throw new CliError("cancelled", "Transaction cancelled by user.");
            }
        }
        const result = await sendEth(to, amount, config);
        let confirmed;
        let confirmations;
        if (opts.confirmations !== undefined) {
            const parsed = Number(opts.confirmations);
            if (!Number.isFinite(parsed) || parsed < 1) {
                throw new CliError("invalid_confirmations", "Confirmations must be a positive integer.");
            }
            confirmations = Math.floor(parsed);
            const receipt = await getProvider().waitForTransaction(result.txHash, confirmations);
            if (!receipt || receipt.status !== 1) {
                throw new CliError("tx_failed", "ETH transfer failed or not confirmed.");
            }
            confirmed = true;
        }
        if (json) {
            outputJson(jsonSuccess("send-eth", {
                txHash: result.txHash,
                to: result.to,
                amount,
                chainId: config.chainId,
                asset: "ETH",
                balance: preBalance,
                confirmed,
                confirmations,
            }));
        }
        else {
            console.log(`txHash: ${result.txHash}`);
        }
    }
    catch (err) {
        handleError("send-eth", err, json);
    }
});
program
    .command("pay-url")
    .description("Autopay a 402 endpoint.")
    .argument("<url>", "URL to request")
    .option("--method <method>", "HTTP method", "GET")
    .option("--header <header...>", "HTTP header (Key: Value)")
    .option("--data <data>", "Request body data")
    .option("--content-type <type>", "Content-Type for request body")
    .option("--timeout <seconds>", "Request timeout in seconds")
    .option("--allowlist <domains>", "Override allowlist domains (comma-separated)")
    .option("--yes", "Skip confirmation")
    .option("--json", "Output JSON")
    .action(async (url, opts) => {
    const json = Boolean(opts.json);
    try {
        const config = await resolveConfig();
        const headers = parseHeaders(opts.header);
        const allowlist = parseAllowlist(opts.allowlist);
        let timeoutSeconds = undefined;
        if (opts.timeout !== undefined) {
            const parsed = Number(opts.timeout);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                throw new CliError("invalid_timeout", "Timeout must be a positive number of seconds.");
            }
            timeoutSeconds = parsed;
        }
        const result = await payUrl(url, {
            method: opts.method,
            headers,
            data: opts.data,
            contentType: opts.contentType,
            timeoutSeconds,
            allowlist,
            onInvoice: async (details) => {
                if (!process.stdin.isTTY && !opts.yes) {
                    throw new CliError("non_interactive_requires_yes", "Non-interactive spending requires --yes.");
                }
                if (!process.stdin.isTTY)
                    return Boolean(opts.yes);
                if (opts.yes)
                    return true;
                return promptYesNo(`Pay ${details.amountRequired} USDC to ${details.payTo} for invoice ${details.invoiceId}?`);
            },
        }, config);
        if (json) {
            outputJson(jsonSuccess("pay-url", {
                paid: result.paid,
                txHash: result.txHash,
                invoiceId: result.invoiceId,
                finalStatus: result.status,
            }));
        }
        else {
            console.log(`Status: ${result.status}`);
            if (result.txHash) {
                console.log(`txHash: ${result.txHash}`);
            }
            if (result.invoiceId) {
                console.log(`invoiceId: ${result.invoiceId}`);
            }
            if (result.body) {
                console.log(result.body);
            }
        }
    }
    catch (err) {
        handleError("pay-url", err, json);
    }
});
program.parseAsync(process.argv);
