import { AgentPayConfig } from "../config.js";
import { PayUrlOptions, PayUrlResult } from "../types.js";
export declare function payUrl(url: string, options: PayUrlOptions, config: AgentPayConfig): Promise<PayUrlResult>;
