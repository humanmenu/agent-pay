import { AgentPayConfig } from "../config.js";
export declare function getBalances(config: AgentPayConfig): Promise<{
    eth: string;
    usdc: string;
}>;
