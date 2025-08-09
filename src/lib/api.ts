import { API_BASE_URL } from "@/lib/env";

/**
 * Fetch the list of games from the API.
 * - Uses the API base URL from .env.local
 * - No caching so you always see fresh data in dev
 */
export async function fetchGames() {
    const url = `${API_BASE_URL}/games/`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
        // Surface a readable error — we’ll improve this later
        throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    }

    // API returns an array of { id, name, ... } previews
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}
