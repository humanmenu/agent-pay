import { ethers } from "ethers";
import { AgentPayConfig } from "../config.js";
import { Invoice, PayUrlOptions, PayUrlResult } from "../types.js";
import { CliError } from "../errors.js";
import { domainMatchesAllowlist, normalizeAddress, parseDecimalToUnits, parsePositiveInt } from "../utils.js";
import { DEFAULT_USDC_ADDRESS } from "../constants.js";
import { ERC20_ABI } from "./erc20.js";
import { appendLedger } from "../ledger.js";
import { enforceLimits } from "./limits.js";
import { parseInvoiceFromBody, parseInvoiceFromHeader, validateInvoice } from "../invoice.js";

function buildHeaders(base?: Record<string, string>): Headers {
  const headers = new Headers();
  if (base) {
    for (const [key, value] of Object.entries(base)) {
      headers.set(key, value);
    }
  }
  return headers;
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseHeaderInvoice(res: Response): Invoice | null {
  const primary = res.headers.get("payment-required");
  if (primary) return parseInvoiceFromHeader(primary);
  const legacy = res.headers.get("x-payment-required");
  if (legacy) return parseInvoiceFromHeader(legacy);
  return null;
}

function parseTimeoutSeconds(input?: number): number | undefined {
  if (input === undefined) return undefined;
  const num = Number(input);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
}

function resolveTimeoutSeconds(invoiceTimeout: number, userTimeout?: number): number {
  if (userTimeout === undefined) return invoiceTimeout;
  return Math.min(userTimeout, invoiceTimeout);
}

export async function payUrl(url: string, options: PayUrlOptions, config: AgentPayConfig): Promise<PayUrlResult> {
  const targetUrl = new URL(url);
  const allowlist = options.allowlist ?? config.allowlistDomains;
  if (!domainMatchesAllowlist(targetUrl.hostname, allowlist)) {
    throw new CliError("domain_not_allowed", "URL domain is not in allowlist.", {
      domain: targetUrl.hostname,
    });
  }

  const method = (options.method || "GET").toUpperCase();
  const headers = buildHeaders(options.headers);
  const body = options.data;

  if (body !== undefined && body !== null) {
    const contentTypeHeader = headers.get("content-type");
    if (!contentTypeHeader) {
      headers.set("content-type", options.contentType || "application/json");
    }
  }

  const userTimeoutSeconds = parseTimeoutSeconds(options.timeoutSeconds);
  const initialTimeoutSeconds = userTimeoutSeconds ?? 300;

  const initialResponse = await fetchWithTimeout(
    targetUrl.toString(),
    {
      method,
      headers,
      body,
    },
    initialTimeoutSeconds * 1000
  );

  const initialBody = await initialResponse.text();

  if (initialResponse.status !== 402) {
    return {
      status: initialResponse.status,
      headers: normalizeHeaders(initialResponse.headers),
      body: initialBody,
      paid: false,
    };
  }

  let invoice: Invoice | null = null;
  try {
    invoice = parseHeaderInvoice(initialResponse);
  } catch (err) {
    throw err;
  }

  if (!invoice) {
    invoice = parseInvoiceFromBody(initialBody);
  }

  const validated = validateInvoice(
    invoice,
    config.assets || { [config.usdcAddress || DEFAULT_USDC_ADDRESS]: { decimals: 6 } }
  );

  if (validated.expiresAt) {
    const expiry = Date.parse(validated.expiresAt);
    if (Number.isNaN(expiry)) {
      throw new CliError("invalid_expires_at", "Invoice expiresAt is not a valid timestamp.");
    }
    if (Date.now() > expiry) {
      throw new CliError("invoice_expired", "Invoice already expired. Do not pay.");
    }
  }

  if (options.onInvoice) {
    const confirmed = await options.onInvoice({
      amountRequired: validated.amountRequired,
      payTo: validated.payTo,
      invoiceId: validated.invoiceId,
    });
    if (!confirmed) {
      throw new CliError("cancelled", "Payment cancelled by user.");
    }
  }

  const amountUnits = parseDecimalToUnits(validated.amountRequired, validated.assetDecimals);
  if (validated.asset === config.usdcAddress) {
    await enforceLimits(amountUnits, config);
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const token = new ethers.Contract(validated.asset, ERC20_ABI, wallet);

  const tx = await token.transfer(normalizeAddress(validated.payTo), amountUnits);

  await appendLedger({
    ts: new Date().toISOString(),
    to: normalizeAddress(validated.payTo),
    amount: validated.amountRequired,
    txHash: tx.hash,
    invoiceId: validated.invoiceId,
    chainId: config.chainId,
    asset: validated.asset,
    status: "submitted",
  });

  const minConfirmations = parsePositiveInt(validated.minConfirmations, 1) ?? 1;
  await tx.wait(minConfirmations);

  const invoiceTimeoutSeconds = parsePositiveInt(validated.maxTimeoutSeconds, 300) ?? 300;
  const effectiveTimeout = resolveTimeoutSeconds(invoiceTimeoutSeconds, userTimeoutSeconds);

  const retryHeaders = buildHeaders(options.headers);
  if (body !== undefined && body !== null) {
    const contentTypeHeader = retryHeaders.get("content-type");
    if (!contentTypeHeader) {
      retryHeaders.set("content-type", options.contentType || "application/json");
    }
  }
  const proofHeader =
    typeof invoice.proof?.header === "string" && invoice.proof.header.trim()
      ? invoice.proof.header.trim()
      : "X-Payment";
  retryHeaders.set(proofHeader, tx.hash);
  if (proofHeader.toLowerCase() !== "x-payment") {
    retryHeaders.set("X-Payment", tx.hash);
  }
  retryHeaders.set("X-Invoice-Id", validated.invoiceId);

  const retryUrl = validated.resource
    ? validated.resource.startsWith("/")
      ? new URL(validated.resource, targetUrl.origin).toString()
      : new URL(validated.resource, targetUrl.toString()).toString()
    : targetUrl.toString();

  const retryHost = new URL(retryUrl);
  if (!domainMatchesAllowlist(retryHost.hostname, allowlist)) {
    throw new CliError("domain_not_allowed", "Retry URL domain is not in allowlist.", {
      domain: retryHost.hostname,
    });
  }

  const retryResponse = await fetchWithTimeout(
    retryUrl,
    {
      method,
      headers: retryHeaders,
      body,
    },
    effectiveTimeout * 1000
  );

  const retryBody = await retryResponse.text();

  return {
    status: retryResponse.status,
    headers: normalizeHeaders(retryResponse.headers),
    body: retryBody,
    paid: true,
    txHash: tx.hash,
    invoiceId: validated.invoiceId,
  };
}
