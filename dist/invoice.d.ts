import { Invoice } from "./types.js";
import { AssetConfig } from "./config.js";
export declare function parseInvoiceFromHeader(value: string): Invoice;
export declare function parseInvoiceFromBody(bodyText: string): Invoice;
export declare function validateInvoice(invoice: Invoice, assets: Record<string, AssetConfig>): {
    amountRequired: string;
    payTo: string;
    invoiceId: string;
    minConfirmations: number;
    maxTimeoutSeconds: number;
    expiresAt?: string;
    resource?: string;
    asset: string;
    assetDecimals: number;
};
