export declare function parseDecimalToUnits(value: string, decimals: number): bigint;
export declare function parsePositiveInt(value: number | string | undefined, fallback?: number): number | undefined;
export declare function normalizeAddress(address: string): string;
export declare function normalizeDomainList(domains?: string[]): string[] | undefined;
export declare function domainMatchesAllowlist(hostname: string, allowlist?: string[]): boolean;
export declare function sleep(ms: number): Promise<void>;
