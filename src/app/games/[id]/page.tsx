import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import {
    groupFiles,
    GroupKey,
    normalizeFiles,
    prettyCategory,
    UiFile,
} from "@/lib/files";

type LocationNode = { id: string; name: string };

type Named = { id: number; name: string };
type CompanyRole = {
    company: Named;
    developer: boolean;
    publisher: boolean;
    porting: boolean;
    supporting: boolean;
};

type Game = {
    id: number;
    igdb_id: number;
    name: string;
    summary?: string | null;
    release_date?: number | null;
    cover_url?: string | null;
    condition?: number | null;
    order?: number | null;
    rating?: number | null;
    platforms?: Named[];
    tags?: Named[];
    genres?: Named[];
    modes?: Named[];
    playerperspectives?: Named[];
    collection?: Named | null;
    companies?: CompanyRole[];
    igdb_tags?: Named[];
    location_path?: LocationNode[];
};

async function fetchGame(id: string): Promise<Game> {
    const url = `${API_BASE_URL}/games/${id}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as Game;
}

async function fetchGameFiles(id: string): Promise<UiFile[]> {
    const url = `${API_BASE_URL}/games/${id}/files/`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    return normalizeFiles(data);
}

function toYear(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}

function igdbSearchUrl(name: string) {
    return `https://www.igdb.com/search?q=${encodeURIComponent(name)}`;
}

export default async function GameDetailsPage({ params }: { params: { id: string } }) {
    let game: Game | null = null;
    let files: UiFile[] = [];
    let error: string | null = null;
    let filesError: string | null = null;

    try {
        game = await fetchGame(params.id);
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    try {
        files = await fetchGameFiles(params.id);
    } catch (e: unknown) {
        filesError = e instanceof Error ? e.message : "Unknown error";
    }

    const grouped = groupFiles(files);
    const groupOrder: GroupKey[] = [
        "ISOs",
        "Images",
        "Save Files",
        "Patches and Updates",
        "Manuals and Docs",
        "Audio / OST",       // <-- added
        "Others",
    ];
    const hasAny = groupOrder.some((k) => grouped[k]?.length);

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
                <Link href="/games" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    ← Back to Games
                </Link>
            </div>

            {error ? (
                <div
                    style={{
                        background: "#3b0f12",
                        border: "1px solid #5b1a1f",
                        color: "#ffd7d7",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 16,
                    }}
                >
                    Failed to load game.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {!error && game && (
                <article
                    style={{
                        display: "grid",
                        gridTemplateColumns: "180px 1fr",
                        gap: 18,
                        alignItems: "start",
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    {/* Cover */}
                    <div>
                        {game.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={game.cover_url}
                                alt={game.name}
                                width={180}
                                height={240}
                                style={{
                                    width: 180,
                                    height: 240,
                                    objectFit: "cover",
                                    borderRadius: 10,
                                    border: "1px solid #2b2b2b",
                                    background: "#141414",
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: 180,
                                    height: 240,
                                    background: "#2b2b2b",
                                    borderRadius: 10,
                                    border: "1px solid #2b2b2b",
                                }}
                            />
                        )}
                    </div>

                    {/* Info */}
                    <div>
                        <h1 style={{ fontSize: 24, margin: "0 0 10px 0", letterSpacing: 0.2 }}>
                            {game.name}
                        </h1>

                        {/* Quick facts */}
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                fontSize: 14,
                                opacity: 0.95,
                                marginBottom: 12,
                            }}
                        >
                            <Pill label={`Year: ${toYear(game.release_date)}`} />
                            <Pill label={`Rating: ${typeof game.rating === "number" ? game.rating : "—"}`} />
                            <Pill label={`Condition: ${game.condition ?? "—"}`} />

                            <a
                                href={igdbSearchUrl(game.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    textDecoration: "none",
                                    background: "#1d1d1d",
                                    border: "1px solid #2b2b2b",
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    lineHeight: 1.2,
                                    color: "#eaeaea",
                                }}
                                title="Open on IGDB (search by name)"
                            >
                                IGDB: {game.igdb_id}
                            </a>
                        </div>

                        {/* Location (with Order) */}
                        <section
                            style={{
                                margin: "10px 0 14px 0",
                                padding: "10px 12px",
                                background: "#141414",
                                border: "1px solid #262626",
                                borderRadius: 10,
                            }}
                        >
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Location:</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                {game.location_path && game.location_path.length ? (
                                    <>
                                        {game.location_path.map((node, idx) => (
                                            <span key={node.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                            style={{
                                background: "#1e1e1e",
                                border: "1px solid #2b2b2b",
                                borderRadius: 999,
                                padding: "4px 10px",
                                fontSize: 12,
                            }}
                        >
                          {node.name}
                        </span>
                                                {idx < game.location_path!.length - 1 ? (
                                                    <span style={{ opacity: 0.6 }}>›</span>
                                                ) : null}
                      </span>
                                        ))}
                                    </>
                                ) : (
                                    <span style={{ opacity: 0.7 }}>Not set</span>
                                )}

                                {typeof game.order === "number" ? (
                                    <>
                                        <span style={{ opacity: 0.6 }}>·</span>
                                        <span
                                            style={{
                                                background: "#1e1e1e",
                                                border: "1px solid #2b2b2b",
                                                borderRadius: 999,
                                                padding: "4px 10px",
                                                fontSize: 12,
                                            }}
                                        >
                      Order: {game.order}
                    </span>
                                    </>
                                ) : null}
                            </div>
                        </section>

                        {/* Summary */}
                        {game.summary ? (
                            <p style={{ lineHeight: 1.55, opacity: 0.95, marginBottom: 14 }}>{game.summary}</p>
                        ) : (
                            <p style={{ opacity: 0.6 }}>No summary.</p>
                        )}

                        {/* Structured metadata sections */}
                        <MetaRow label="Platforms" items={game.platforms?.map((x) => x.name)} />
                        <MetaRow label="Collection" items={game.collection ? [game.collection.name] : []} />
                        <MetaRow label="Genres" items={game.genres?.map((x) => x.name)} />
                        <MetaRow label="Modes" items={game.modes?.map((x) => x.name)} />
                        <MetaRow label="Perspectives" items={game.playerperspectives?.map((x) => x.name)} />
                        <MetaRow label="Tags" items={game.tags?.map((x) => x.name)} />
                        <MetaRow label="IGDB Tags" items={game.igdb_tags?.map((x) => x.name)} />

                        {game.companies && game.companies.length ? (
                            <MetaRow
                                label="Companies"
                                items={game.companies.map((c) => {
                                    const roles = [
                                        c.developer ? "dev" : "",
                                        c.publisher ? "pub" : "",
                                        c.porting ? "port" : "",
                                        c.supporting ? "supp" : "",
                                    ]
                                        .filter(Boolean)
                                        .join("/");
                                    return roles ? `${c.company.name} (${roles})` : c.company.name;
                                })}
                            />
                        ) : null}

                        {/* Downloads (grouped) */}
                        <section
                            style={{
                                marginTop: 14,
                                padding: "10px 12px",
                                background: "#141414",
                                border: "1px solid #262626",
                                borderRadius: 10,
                            }}
                        >
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Downloads</div>

                            {filesError ? (
                                <div style={{ fontSize: 12, color: "#fca5a5" }}>
                                    Failed to load files. <span style={{ opacity: 0.8 }}>{filesError}</span>
                                </div>
                            ) : !hasAny ? (
                                <div style={{ opacity: 0.7, fontSize: 13 }}>No files attached.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 12 }}>
                                    {groupOrder.map((key) =>
                                        grouped[key].length ? (
                                            <FileGroup key={key} title={key} files={grouped[key]} />
                                        ) : null
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                </article>
            )}
        </div>
    );
}

function Pill({ label }: { label: string }) {
    return (
        <span
            style={{
                background: "#1d1d1d",
                border: "1px solid #2b2b2b",
                borderRadius: 999,
                padding: "4px 10px",
                lineHeight: 1.2,
            }}
        >
      {label}
    </span>
    );
}

function MetaRow({ label, items }: { label: string; items?: string[] }) {
    if (!items || items.length === 0) return null;
    return (
        <div style={{ margin: "10px 0" }}>
            <div style={{ opacity: 0.8, marginBottom: 4, fontWeight: 600 }}>{label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map((txt, i) => (
                    <span
                        key={`${label}-${i}-${txt}`}
                        style={{
                            background: "#1e1e1e",
                            border: "1px solid #2b2b2b",
                            borderRadius: 8,
                            padding: "4px 8px",
                            fontSize: 13,
                        }}
                    >
            {txt}
          </span>
                ))}
            </div>
        </div>
    );
}

function FileGroup({ title, files }: { title: string; files: UiFile[] }) {
    if (!files || files.length === 0) return null;
    return (
        <div>
            <div style={{ opacity: 0.85, marginBottom: 6, fontWeight: 600 }}>
                {title} <span style={{ opacity: 0.6, fontWeight: 400 }}>({files.length})</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {files.map((f) => (
                    <li
                        key={f.file_id}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 10px",
                            border: "1px solid #232323",
                            background: "#1a1a1a",
                            borderRadius: 8,
                            marginBottom: 6,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span
                  style={{
                      background: "#101010",
                      border: "1px solid #2b2b2b",
                      borderRadius: 6,
                      padding: "2px 6px",
                      fontSize: 11,
                      whiteSpace: "nowrap",
                  }}
                  title={f.category}
              >
                {prettyCategory(f.category)}
              </span>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.label || f.path.split("/").pop()}
              </span>
                        </div>

                        <a
                            href={`/api/proxy/downloads/${encodeURIComponent(String(f.file_id))}`}
                            title={`file_id: ${f.file_id} • row id: ${f.id}`}
                            style={{
                                textDecoration: "none",
                                background: "#1e293b",
                                border: "1px solid #3b82f6",
                                color: "#e5f0ff",
                                padding: "6px 10px",
                                borderRadius: 8,
                                fontSize: 13,
                            }}
                        >
                            Download
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
