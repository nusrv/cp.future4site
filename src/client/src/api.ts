export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "content-type": "application/json" }),
      ...(options.headers ?? {})
    },
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function upload<T>(path: string, body: FormData): Promise<T> {
  return api<T>(path, { method: "POST", body });
}

export function remove<T>(path: string): Promise<T> {
  return api<T>(path, { method: "DELETE" });
}
