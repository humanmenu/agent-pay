import { ethers } from "ethers";
import { CliError } from "./errors.js";
export function parseDecimalToUnits(value, decimals) {
    const trimmed = value.trim();
    if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
        throw new CliError("invalid_amount_format", "Amount must be a decimal string (digits with optional dot).", {
            value,
        });
    }
    const parts = trimmed.split(".");
    if (parts[1] && parts[1].length > decimals) {
        throw new CliError("invalid_amount_precision", `Amount has more than ${decimals} decimal places.`, {
            value,
        });
    }
    return ethers.parseUnits(trimmed, decimals);
}
export function parsePositiveInt(value, fallback) {
    if (value === undefined || value === null || value === "")
        return fallback;
    const num = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(num) || num <= 0)
        return fallback;
    return Math.floor(num);
}
export function normalizeAddress(address) {
    try {
        return ethers.getAddress(address);
    }
    catch {
        throw new CliError("invalid_address", "Invalid Ethereum address.", { address });
    }
}
export function normalizeDomainList(domains) {
    if (!domains)
        return undefined;
    const cleaned = domains
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
}
export function domainMatchesAllowlist(hostname, allowlist) {
    if (!allowlist || allowlist.length === 0)
        return true;
    const host = hostname.toLowerCase();
    return allowlist.some((domain) => {
        const normalized = domain.toLowerCase();
        return host === normalized || host.endsWith(`.${normalized}`);
    });
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
