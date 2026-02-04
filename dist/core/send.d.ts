import { AgentPayConfig } from "../config.js";
export interface SendResult {
    txHash: string;
    amountUnits: bigint;
    to: string;
}
export declare function sendUsdc(to: string, amount: string, config: AgentPayConfig): Promise<SendResult>;
