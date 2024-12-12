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
