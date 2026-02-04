import { SCHEMA_VERSION } from "./constants.js";
export class CliError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}
export function jsonSuccess(command, data) {
    return {
        schemaVersion: SCHEMA_VERSION,
        ok: true,
        command,
        ...data,
    };
}
export function jsonError(command, error) {
    const cliError = error instanceof CliError ? error : new CliError("unknown_error", error.message || "Unknown error");
    return {
        schemaVersion: SCHEMA_VERSION,
        ok: false,
        command,
        error: {
            code: cliError.code,
            message: cliError.message,
            details: cliError.details ?? {},
        },
    };
}
