import { SCHEMA_VERSION } from "./constants.js";

export class CliError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function jsonSuccess<T extends object>(command: string, data: T): { schemaVersion: number; ok: true; command: string } & T {
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: true,
    command,
    ...data,
  };
}

export function jsonError(command: string, error: CliError | Error): Record<string, unknown> {
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
