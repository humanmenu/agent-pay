import { AgentPayConfig } from "../config.js";
export interface SendTokenResult {
    txHash: string;
    amountUnits: bigint;
    to: string;
    asset: string;
}
export declare function sendToken(asset: string, to: string, amount: string, config: AgentPayConfig): Promise<SendTokenResult>;
