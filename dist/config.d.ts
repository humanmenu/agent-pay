export interface AssetConfig {
    symbol?: string;
    decimals: number;
}
export interface AgentPayConfig {
    version: 1;
    rpcUrl: string;
    privateKey: string;
    chainId: number;
    usdcAddress: string;
    assets?: Record<string, AssetConfig>;
    maxPerTxUsdc?: string;
    maxPerDayUsdc?: string;
    allowlistDomains?: string[];
}
export declare function getConfigPath(): string;
export declare function getLedgerPath(): string;
export declare function readConfig(): Promise<AgentPayConfig | null>;
export declare function writeConfig(config: AgentPayConfig): Promise<{
    path: string;
    chmodOk: boolean;
}>;
export declare function configFromEnv(): Partial<AgentPayConfig>;
export declare function resolveConfig(): Promise<AgentPayConfig>;
