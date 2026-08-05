/** Mirrors shared-java's ApiResponse<T> — same {success, data, error, timestamp} envelope every
 * Java service returns, so the frontends' apiFetch doesn't need a gateway-specific special case. */
export class ApiResponse<T> {
  constructor(
    public success: boolean,
    public data: T | null,
    public error: string | null,
    public timestamp: string,
  ) {}

  static success<T>(data: T): ApiResponse<T> {
    return new ApiResponse<T>(true, data, null, new Date().toISOString());
  }

  static error(message: string): ApiResponse<null> {
    return new ApiResponse<null>(false, null, message, new Date().toISOString());
  }
}
