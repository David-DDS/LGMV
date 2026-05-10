export function extractApiError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const e = err as {
    response?: { data?: { error?: string } | string };
    message?: string;
    status?: number;
    statusCode?: number;
  };
  const data = e?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }
  if (typeof e?.message === "string" && e.message.trim() && e.message !== "Failed to fetch") {
    return e.message;
  }
  return fallback;
}

export async function readErrorFromResponse(res: Response, fallback: string): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error.trim()) return body.error;
    } else {
      const text = await res.text();
      if (text.trim()) return text;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}
