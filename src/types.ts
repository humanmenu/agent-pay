export interface Invoice {
  ok?: boolean;
  error?: string;
  scheme?: string;
  network?: string;
  chainId?: number | string;
  amountRequired: string;
  asset: string;
  assetSymbol?: string;
  assetDecimals?: number | string;
  payTo: string;
  invoiceId: string;
  minConfirmations?: number | string;
  maxTimeoutSeconds?: number | string;
  expiresAt?: string;
  resource?: string;
  proof?: {
    type?: string;
    header?: string;
  };
  instructions?: string;
}

export interface PayUrlOptions {
  method?: string;
  headers?: Record<string, string>;
  data?: string;
  contentType?: string;
  timeoutSeconds?: number;
  allowlist?: string[];
  onInvoice?: (details: { amountRequired: string; payTo: string; invoiceId: string }) => Promise<boolean>;
}

export interface PayUrlResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  paid: boolean;
  txHash?: string;
  invoiceId?: string;
}
