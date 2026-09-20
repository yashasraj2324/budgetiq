// Token / API-key helpers.

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateKey(): string {
  return `biq_${generateToken()}`;
}

export function hashKey(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  return crypto.subtle.digest("SHA-256", data).then((digest) =>
    Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}
