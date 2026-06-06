type UpstashCommandPart = string | number;

type UpstashCommandResponse<T> = {
  result?: T;
  error?: string;
};

const isUpstashError = (value: unknown): value is { error: string } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error?: unknown }).error === 'string'
  );
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export class UpstashRestClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs: number,
    private readonly label: string
  ) {
    this.baseUrl = trimTrailingSlash(baseUrl);
  }

  async command<T>(parts: readonly UpstashCommandPart[]): Promise<T> {
    const payload = await this.postJson<UpstashCommandResponse<T>>('', parts);
    if (payload.error) {
      throw new Error(payload.error);
    }

    return payload.result as T;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const text = await response.text();
      let payload: unknown = null;

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(`${this.label} returned a non-JSON response with status ${response.status}`);
        }
      }

      if (!response.ok) {
        if (isUpstashError(payload)) {
          throw new Error(payload.error);
        }

        throw new Error(`${this.label} request failed with status ${response.status}`);
      }

      return payload as T;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: string }).name === 'AbortError'
      ) {
        throw new Error(`${this.label} request timed out`);
      }

      throw error instanceof Error ? error : new Error(`${this.label} request failed`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
