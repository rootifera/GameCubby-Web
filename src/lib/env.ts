// Reads API base URL from the environment file (.env.local)
export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://gamecubby-api:8000";

// Later we'll add login/token handling; for now leave empty.
export const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "";

// Controls whether the app is running behind a reverse proxy (like HAProxy)
// When true: cookies will be set as secure regardless of protocol
// When false: cookies will only be secure when protocol is HTTPS
export const PROXY = process.env.PROXY === "true";
