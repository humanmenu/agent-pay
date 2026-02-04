export interface LedgerEntry {
    ts: string;
    to: string;
    amount: string;
    txHash: string;
    invoiceId?: string;
    chainId: number;
    asset: string;
    status: "submitted";
}
export declare function appendLedger(entry: LedgerEntry): Promise<void>;
export declare function sumSpentTodayUTC(assetAddress: string): Promise<bigint>;
