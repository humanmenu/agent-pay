import { AgentPayConfig } from "../config.js";
export interface DoctorResult {
    ok: boolean;
    chainId: number | null;
    address: string | null;
    ethBalance: string | null;
    usdcBalance: string | null;
    warnings: string[];
}
export declare function doctor(config: AgentPayConfig): Promise<DoctorResult>;
