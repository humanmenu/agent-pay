import { AgentPayConfig } from "../config.js";
export interface SendEthResult {
    txHash: string;
    amountUnits: bigint;
    to: string;
}
export declare function sendEth(to: string, amount: string, config: AgentPayConfig): Promise<SendEthResult>;
