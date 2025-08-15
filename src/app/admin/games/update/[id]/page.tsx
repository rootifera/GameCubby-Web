import React from "react";
import Link from "next/link";
import { headers, cookies } from "next/headers";

/* ------------ types shared with editor ------------ */
export type IdName = { id: number; name: string };

export type Game = {
    id: number;
    igdb_id: number;

    name: string;
    summary?: string | null;
    release_year?: number | null;   // some endpoints use year
    release_date?: number | null;   // some endpoints use unix or yyyy
    cover_url?: string | null;
    rating?: number | null;

    // editable-only fields
    condition?: number | null;
    location_id?: number | null;
    order?: number | null;

    // relations (IDs and/or expanded forms may be present)
    platform_ids?: number[];
    mode_ids?: number[];
    genre_ids?: number[];
    player_perspective_ids?: number[];
    company_ids?: number[];
    collection_id?: number | null;

    // optional expanded objects (if API includes them)
    platforms?: IdName[];
    modes?: IdName[];
    genres?: IdName[];
    player_perspectives?: IdName[];
    companies?: IdName[];
    collection?: IdName | null;

    // tags can be numeric ids or free-text strings
    tag_ids?: Array<number | string>;
    tags?: Array<{ id?: number; name: string }>;
};

type Lookups = {
    platforms: IdName[];
    modes: IdName[];
    genres: IdName[];
    perspectives: IdName[];
    companies: IdName[];
    collections: IdName[];
};

function baseUrl() {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (!host) throw new Error("Missing Host header");
    return `${proto}://${host}`;
}

function authHeaders() {
    const c = cookies();
    return {
        Accept: "application/json",
        Cookie: c.toString(), // forward all incoming cookies (admin/session)
    };
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store", headers: authHeaders() });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${t}`);
    }
    return (await res.json()) as T;
}

async function fetchGame(id: number): Promise<Game> {
    const base = baseUrl();
    return await fetchJson<Game>(`${base}/api/proxy/games/${id}`);
}

async function fetchLookups(): Promise<Lookups> {
    const base = baseUrl();
    const [platforms, modes, genres, perspectives, collections, companies] = await Promise.all([
        fetchJson<IdName[]>(`${base}/api/admin/lookups/platforms`),
        fetchJson<IdName[]>(`${base}/api/admin/lookups/modes`),
        fetchJson<IdName[]>(`${base}/api/admin/lookups/genres`),
        fetchJson<IdName[]>(`${base}/api/admin/lookups/perspectives`),
        fetchJson<IdName[]>(`${base}/api/admin/lookups/collections`),
        fetchJson<IdName[]>(`${base}/api/admin/lookups/companies`),
    ]);

    return {
        platforms: platforms ?? [],
        modes: modes ?? [],
        genres: genres ?? [],
        perspectives: perspectives ?? [],
        companies: companies ?? [],
        collections: collections ?? [],
    };
}

export const metadata = {
    title: "Admin • Game Management • Edit",
    description: "Edit game",
};

export default async function AdminGameEditorPage({ params }: { params: { id: string } }) {
    const idNum = Number(params.id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
        throw new Error("Invalid game id");
    }

    let game: Game | null = null;
    let lookups: Lookups | null = null;
    let error: string | null = null;

    try {
        [game, lookups] = await Promise.all([fetchGame(idNum), fetchLookups()]);
    } catch (e: any) {
        error = e?.message ?? "Failed to load game";
    }

    const titleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, marginBottom: 10 };
    const panel: React.CSSProperties = { background: "#0f0f0f", border: "1px solid #262626", borderRadius: 12, padding: 14 };
    const buttonStyle: React.CSSProperties = {
        display: "inline-block",
        background: "#1b1b1b",
        color: "#eaeaea",
        border: "1px solid #2e2e2e",
        borderRadius: 8,
        padding: "8px 12px",
        textDecoration: "none",
    };

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Link href="/admin/games/update" style={buttonStyle}>← Back</Link>
                <div style={titleStyle}>Edit Game #{params.id}</div>
            </div>

            <div style={panel}>
                {error ? (
                    <div style={{ color: "#ff6666" }}>{error}</div>
                ) : game && lookups ? (
                    <>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                            {game.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={game.cover_url}
                                    alt={game.name}
                                    style={{ width: 96, height: 128, objectFit: "cover", borderRadius: 8, border: "1px solid #262626" }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: 96,
                                        height: 128,
                                        borderRadius: 8,
                                        border: "1px solid #262626",
                                        display: "grid",
                                        placeItems: "center",
                                        opacity: 0.6,
                                    }}
                                >
                                    No cover
                                </div>
                            )}

                            <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>{game.name}</div>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>
                                    Local ID #{game.id}
                                    {typeof game.igdb_id === "number" ? ` • IGDB ${game.igdb_id}` : ""}
                                </div>
                            </div>
                        </div>

                        {/* Client form */}
                        {/* @ts-expect-error Server/Client boundary satisfied by default export */}
                        <GameEditor initialData={game} lookups={lookups} />
                    </>
                ) : (
                    <div style={{ opacity: 0.75 }}>No game found.</div>
                )}
            </div>
        </div>
    );
}

import GameEditor from "./GameEditor";
