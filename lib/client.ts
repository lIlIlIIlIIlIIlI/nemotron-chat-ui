export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401 && !path.startsWith('/api/auth/')) window.location.assign('/login'); throw new Error(data.error || `요청 실패 (${response.status})`); }
  return data as T;
}
export function download(name: string, content: string, type = 'text/plain') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name.replace(/[\\/]/g, '_'); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function copyText(content: string) { return navigator.clipboard.writeText(content); }
