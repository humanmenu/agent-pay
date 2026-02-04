export declare class CliError extends Error {
    code: string;
    details?: unknown;
    constructor(code: string, message: string, details?: unknown);
}
export declare function jsonSuccess<T extends object>(command: string, data: T): {
    schemaVersion: number;
    ok: true;
    command: string;
} & T;
export declare function jsonError(command: string, error: CliError | Error): Record<string, unknown>;
