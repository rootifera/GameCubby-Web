import React from "react";
import Link from "next/link";
import { headers } from "next/headers";

type Named = { id: number; name: string };
type CompanyRole = {
    company: Named;
    developer: boolean;
    publisher: boolean;
    porting: boolean;
    supporting: boolean;
};

export type Game = {
    id: number;
    igdb_id: number;
    name: string;
    summary?: string | null;
    release_year?: number | null;
    release_date?: number | null;
    cover_url?: string | null;
    rating?: number | null;
    platforms?: Named[];
    genres?: Named[];
    modes?: Named[];
    companies?: CompanyRole[];
};

function getBaseUrlFromHeaders() {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (!host) throw new Error("Missing Host header");
    return `${proto}://${host}`;
}

async function fetchGame(id: number): Promise<Game> {
    const base = getBaseUrlFromHeaders();
    const res = await fetch(`${base}/api/proxy/games/${id}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GET /api/proxy/games/${id} failed (${res.status}) ${text}`);
    }
    return (await res.json()) as Game;
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
    let error: string | null = null;

    try {
        game = await fetchGame(idNum);
    } catch (e: any) {
        error = e?.message ?? "Failed to load game";
    }

    const titleStyle: React.CSSProperties = {
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 10,
    };

    const panel: React.CSSProperties = {
        background: "#0f0f0f",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
    };

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
                ) : game ? (
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
                        <GameEditor initialData={game} />
                    </>
                ) : (
                    <div style={{ opacity: 0.75 }}>No game found.</div>
                )}
            </div>
        </div>
    );
}

import GameEditor from "./GameEditor";
