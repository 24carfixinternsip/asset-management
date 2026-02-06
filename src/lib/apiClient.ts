const isDev = import.meta.env.DEV;
const nativeFetch = globalThis.fetch.bind(globalThis);

const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const formatBody = (body: BodyInit | null | undefined) => {
  if (!body) return undefined;
  if (typeof body === "string") return safeJsonParse(body);
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) return Object.fromEntries(body.entries());
  if (body instanceof Blob) return `[Blob ${body.type || "unknown"}, ${body.size} bytes]`;
  if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength} bytes]`;
  if (ArrayBuffer.isView(body)) return `[ArrayBufferView ${body.byteLength} bytes]`;
  return "[Body]";
};

const redactHeaders = (headers: HeadersInit | undefined) => {
  const result: Record<string, string> = {};
  if (!headers) return result;
  const normalized = new Headers(headers);
  normalized.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower.includes("authorization") || lower.includes("apikey") || lower.includes("api-key")) {
      result[key] = "[redacted]";
    } else {
      result[key] = value;
    }
  });
  return result;
};

const resolveUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

export async function fetchWithLogging(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isDev) return nativeFetch(input, init);

  const method = init?.method ?? "GET";
  const url = resolveUrl(input);
  const requestBody = formatBody(init?.body ?? null);
  const headers = redactHeaders(init?.headers);

  console.groupCollapsed(`[API] ${method} ${url}`);
  console.debug("Request", { method, url, headers, body: requestBody });

  try {
    const response = await nativeFetch(input, init);
    const clone = response.clone();

    let responseBody: unknown = null;
    try {
      const text = await clone.text();
      responseBody = text ? safeJsonParse(text) : null;
    } catch {
      responseBody = "[Unreadable body]";
    }

    console.debug("Response", {
      status: response.status,
      ok: response.ok,
      body: responseBody,
    });
    console.groupEnd();
    return response;
  } catch (error) {
    console.error("Network error", error);
    console.groupEnd();
    throw error;
  }
}
