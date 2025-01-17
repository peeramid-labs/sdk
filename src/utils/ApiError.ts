import { BaseError, CallExecutionError, ContractFunctionExecutionError, ContractFunctionRevertedError } from "viem";

interface ErrorOptions {
  cause?: unknown;
}

export interface ApiErrorOptions extends ErrorOptions {
  status?: number;
}

interface ApiErrorResponse {
  msg?: string;
  status?: number;
}

export class ApiError extends Error {
  status: number | undefined;
  constructor(message: string, options?: ApiErrorOptions) {
    super(message);
    this.status = options?.status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getApiError(response: any): Promise<ApiError> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const body = (await response.json()) as ApiErrorResponse;
  return new ApiError(body.msg || "server_error", {
    status: body?.status,
  });
}

export async function handleRPCError(e: unknown) {
  if (e instanceof BaseError) {
    const revertError = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      if (!errorName) {
        const cause = revertError.cause as { signature?: string };
        if (cause?.signature) {
          const remoteAttempt = fetch(
            `https://www.4byte.directory/api/v1/signatures/?hex_signature=${cause.signature}`
          );
          const response = await remoteAttempt;
          const data = await response.json();
          return new Error(data.results[0].text_signature);
        } else return e;
      }
      return new Error(errorName);
    }
    if (revertError instanceof ContractFunctionExecutionError) {
      const errorName = revertError.name;
      if (!errorName) {
        const cause = revertError.cause as { signature?: string };
        if (cause?.signature) {
          const remoteAttempt = fetch(
            `https://www.4byte.directory/api/v1/signatures/?hex_signature=${cause.signature}`
          );
          const response = await remoteAttempt;
          const data = await response.json();
          return new Error(data.results[0].text_signature);
        } else return e;
      }
    }
    if (revertError instanceof CallExecutionError) {
      const cause = revertError.cause.cause as { signature?: string };
      if (!e.name) {
        const remoteAttempt = fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${cause.signature}`);
        const response = await remoteAttempt;
        const data = await response.json();
        return new Error(data.results[0].text_signature);
      } else return e;
    }
    const cause = e?.cause as { signature?: string };
    if (cause?.signature) {
      const remoteAttempt = fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${cause.signature}`);
      const response = await remoteAttempt;
      const data = await response.json();
      return new Error(data.results[0].text_signature);
    }
  }

  if (e && typeof e === "object" && "cause" in e && e.cause && typeof e.cause === "object" && "signature" in e.cause) {
    const remoteAttempt = fetch(
      `https://www.4byte.directory/api/v1/signatures/?hex_signature=${(e.cause as { signature: string }).signature}`
    );
    const response = await remoteAttempt;
    const data = await response.json();
    return new Error(data.results[0].text_signature);
  }

  throw e;
}
