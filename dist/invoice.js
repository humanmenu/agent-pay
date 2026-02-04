import { BASE_CHAIN_ID, BASE_NETWORK } from "./constants.js";
import { CliError } from "./errors.js";
import { normalizeAddress, parsePositiveInt } from "./utils.js";
export function parseInvoiceFromHeader(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new CliError("empty_invoice_header", "Invoice header is empty.");
    }
    const tryParse = (input) => {
        try {
            const parsed = JSON.parse(input);
            return parsed;
        }
        catch {
            return null;
        }
    };
    const fromRaw = tryParse(trimmed);
    if (fromRaw)
        return fromRaw;
    const base64Decoded = Buffer.from(trimmed, "base64").toString("utf8");
    const fromBase64 = tryParse(base64Decoded);
    if (fromBase64)
        return fromBase64;
    throw new CliError("invalid_invoice_header", "Invoice header is not valid JSON or base64 JSON.");
}
export function parseInvoiceFromBody(bodyText) {
    try {
        return JSON.parse(bodyText);
    }
    catch {
        throw new CliError("invalid_invoice_body", "Invoice body is not valid JSON.");
    }
}
export function validateInvoice(invoice, assets) {
    if (!invoice.amountRequired) {
        throw new CliError("missing_amount", "Invoice is missing amountRequired.");
    }
    if (!invoice.asset) {
        throw new CliError("missing_asset", "Invoice is missing asset.");
    }
    if (invoice.scheme !== undefined && invoice.scheme !== "exact") {
        throw new CliError("unsupported_scheme", "Invoice scheme must be \"exact\".", { scheme: invoice.scheme });
    }
    if (!invoice.payTo) {
        throw new CliError("missing_pay_to", "Invoice is missing payTo.");
    }
    if (!invoice.invoiceId) {
        throw new CliError("missing_invoice_id", "Invoice is missing invoiceId.");
    }
    if (invoice.network !== undefined && invoice.network !== BASE_NETWORK) {
        throw new CliError("network_mismatch", `Invoice network must be \"${BASE_NETWORK}\".`, {
            network: invoice.network,
        });
    }
    if (invoice.chainId !== undefined) {
        const chainIdNum = Number(invoice.chainId);
        if (!Number.isFinite(chainIdNum) || chainIdNum !== BASE_CHAIN_ID) {
            throw new CliError("chain_id_mismatch", `Invoice chainId must be ${BASE_CHAIN_ID}.`, {
                chainId: invoice.chainId,
            });
        }
    }
    const normalizedAsset = normalizeAddress(invoice.asset);
    const assetConfig = assets[normalizedAsset];
    if (!assetConfig) {
        throw new CliError("asset_not_allowed", "Invoice asset is not in allowlist.", {
            asset: normalizedAsset,
        });
    }
    const assetDecimals = assetConfig.decimals;
    if (invoice.assetDecimals !== undefined) {
        const dec = Number(invoice.assetDecimals);
        if (!Number.isFinite(dec) || dec !== assetDecimals) {
            throw new CliError("asset_decimals_mismatch", `Invoice assetDecimals must be ${assetDecimals}.`, {
                assetDecimals: invoice.assetDecimals,
            });
        }
    }
    const minConfirmations = parsePositiveInt(invoice.minConfirmations, 1) ?? 1;
    const maxTimeoutSeconds = parsePositiveInt(invoice.maxTimeoutSeconds, 300) ?? 300;
    const payTo = normalizeAddress(invoice.payTo);
    return {
        amountRequired: invoice.amountRequired,
        payTo,
        invoiceId: invoice.invoiceId,
        minConfirmations,
        maxTimeoutSeconds,
        expiresAt: invoice.expiresAt,
        resource: invoice.resource,
        asset: normalizedAsset,
        assetDecimals,
    };
}
