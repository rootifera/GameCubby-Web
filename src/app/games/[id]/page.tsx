import CoverThumb from "@/components/CoverThumb";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import { cookies } from "next/headers";
import {
    groupFiles,
    GroupKey,
    normalizeFiles,
    prettyCategory,
    UiFile,
} from "@/lib/files";
import BackButton from "@/components/BackButton";
import GameFileManageButton from "@/components/GameFileManageButton";
import GameMetadataUpdateNotice from "@/components/GameMetadataUpdateNotice";

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

/** Check if user is authenticated as admin */
async function isAdminAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    const token = cookieStore.get("__gcub_a")?.value || cookieStore.get("gc_at")?.value;
    if (!token) return false;
    
    try {
        const parts = token.split(".");
        if (parts.length < 2) return false;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "===".slice((base64.length + 3) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        const payload = JSON.parse(json) as { exp?: number };
        
        if (typeof payload.exp !== "number") return true; // treat as active if no exp
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    } catch {
        return false;
    }
}

/** Helper: basename from a path */
function basenameFromPath(p: string): string {
    const parts = p.split("/");
    return parts[parts.length - 1] || p;
}

/** Helper: suggest a nice download filename */
function suggestFilename(f: UiFile): string {
    const base = basenameFromPath(f.path);
    const dot = base.lastIndexOf(".");
    const ext = dot > -1 ? base.slice(dot) : "";
    const raw = f.label?.trim() ? f.label.trim() + ext : base;
    return raw.replace(/[\\/:*?"<>|]/g, "_");
}

export default async function GameDetailsPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
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
    const isAdmin = await isAdminAuthenticated();

    const grouped = groupFiles(files);
    const groupOrder: GroupKey[] = [
        "ISOs",
        "Images",
        "Save Files",
        "Patches and Updates",
        "Manuals and Docs",
        "Audio / OST",
        "Others",
    ];
    const hasAny = groupOrder.some((k) => grouped[k]?.length);

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
                <BackButton />
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
                <article className="gc-game-page">
                    <header className="gc-game-hero">
                        <div className="gc-detail-art"><CoverThumb name={game.name} coverUrl={game.cover_url} gameId={game.id} width={210} height={280} /></div>
                        <div className="gc-game-hero-content">
                            <span className="gc-eyebrow">In your collection</span>
                            <h1>{game.name}</h1>
                            <p className="gc-game-platforms">{game.platforms?.map((p) => p.name).join(" · ") || "Platform not specified"}</p>
                            <dl className="gc-game-facts">
                                <div><dt>Released</dt><dd>{toYear(game.release_date)}</dd></div>
                                <div><dt>IGDB rating</dt><dd>{typeof game.rating === "number" ? <>{game.rating}<small> / 100</small></> : "—"}</dd></div>
                                <div><dt>Condition</dt><dd>{game.condition != null ? <>{game.condition}<small> / 10</small></> : "Not set"}</dd></div>
                            </dl>
                            <div className="gc-game-actions">
                                <a href="#game-downloads" className="gc-primary-link">Downloads ({files.length})</a>
                                {game.igdb_id > 0 && <a href={igdbSearchUrl(game.name)} target="_blank" rel="noopener noreferrer" className="gc-text-link">View on IGDB ↗</a>}
                                {game.igdb_id > 0 && <GameMetadataUpdateNotice gameId={game.id} isAdmin={isAdmin} />}
                            </div>
                        </div>
                    </header>

                    <section className="gc-location-row" aria-labelledby="game-location">
                        <h2 id="game-location">Location</h2>
                        {game.location_path?.length ? (
                            <ol className="gc-location-path">{game.location_path.map((node, index) => (
                                <li key={node.id}>{index > 0 && <span aria-hidden="true">›</span>}{index === game.location_path!.length - 1 ? <strong>{node.name}</strong> : node.name}</li>
                            ))}</ol>
                        ) : <p className="gc-location-unassigned">No location assigned</p>}
                        {typeof game.order === "number" && <div className="gc-location-position"><span aria-hidden="true">|</span><strong>Order {game.order}</strong></div>}
                    </section>

                    <div className="gc-game-body">
                        <div className="gc-game-main-content">
                            <section className="gc-detail-section" aria-labelledby="game-about">
                                <h2 id="game-about">About this game</h2>
                                <GameDescription text={game.summary} />
                            </section>
                            <section className="gc-detail-section" aria-labelledby="game-details">
                                <div className="gc-section-heading"><h2 id="game-details">Game details</h2>{isAdmin && <Link href={`/admin/games/update/${game.id}`} className="gc-secondary-link gc-detail-action">Edit game</Link>}</div>
                                <dl className="gc-detail-metadata">
                                    <MetaRow label="Genres" items={game.genres?.map((x) => x.name)} />
                                    <MetaRow label="Modes" items={game.modes?.map((x) => x.name)} />
                                    <MetaRow label="Perspectives" items={game.playerperspectives?.map((x) => x.name)} />
                                    <MetaRow label="Collection" items={game.collection ? [game.collection.name] : []} />
                                    <MetaRow label="Developers" items={game.companies?.filter((c) => c.developer).map((c) => c.company.name)} />
                                    <MetaRow label="Publishers" items={game.companies?.filter((c) => c.publisher).map((c) => c.company.name)} />
                                    <div><dt>Tags</dt><dd>{game.tags?.length ? <ul className="gc-metadata-tags" aria-label="Game tags">{game.tags.map((tag) => <li key={tag.id}>{tag.name}</li>)}</ul> : <span className="gc-muted">No tags</span>}</dd></div>
                                </dl>
                                <details className="gc-secondary-details">
                                    <summary>Additional metadata</summary>
                                    <dl className="gc-detail-metadata">
                                        <MetaRow label="IGDB tags" items={game.igdb_tags?.map((x) => x.name)} />
                                        <MetaRow label="Porting" items={game.companies?.filter((c) => c.porting).map((c) => c.company.name)} />
                                        <MetaRow label="Supporting" items={game.companies?.filter((c) => c.supporting).map((c) => c.company.name)} />
                                        <MetaRow label="Other companies" items={game.companies?.filter((c) => !c.developer && !c.publisher && !c.porting && !c.supporting).map((c) => c.company.name)} />
                                        <MetaRow label="IGDB ID" items={game.igdb_id > 0 ? [String(game.igdb_id)] : []} />
                                    </dl>
                                </details>
                            </section>
                            <section id="game-downloads" className="gc-detail-section" aria-labelledby="game-downloads-title">
                                <div className="gc-section-heading"><h2 id="game-downloads-title">Downloads</h2><div className="gc-download-heading-actions"><span>{files.length} files</span>{isAdmin && <GameFileManageButton gameId={game.id} />}</div></div>
                                {filesError ? <p role="alert">Failed to load files. {filesError}</p> : !hasAny ? <p className="gc-muted">No files attached to this game.</p> : (
                                    <div className="gc-download-groups">{groupOrder.map((key) => grouped[key].length ? <FileGroup key={key} title={key} files={grouped[key]} /> : null)}</div>
                                )}
                            </section>
                        </div>

                    </div>
                </article>
            )}
        </div>
    );
}

function GameDescription({ text }: { text?: string | null }) {
    if (!text) return <p className="gc-muted">No description available.</p>;
    if (text.length <= 400) return <p className="gc-game-description">{text}</p>;
    const wordBreak = text.lastIndexOf(" ", 320);
    const splitAt = wordBreak > 200 ? wordBreak : 320;
    return <div><p className="gc-game-description">{text.slice(0, splitAt)}…</p><details className="gc-secondary-details"><summary>Read full description</summary><p className="gc-game-description">{text}</p></details></div>;
}

function MetaRow({ label, items }: { label: string; items?: string[] }) {
    return <div><dt>{label}</dt><dd>{items?.length ? items.join(", ") : "—"}</dd></div>;
}

function FileGroup({ title, files }: { title: string; files: UiFile[] }) {
    if (!files || files.length === 0) return null;
    return (
        <div>
            <div style={{ opacity: 0.85, marginBottom: 6, fontWeight: 600 }}>
                {title} <span style={{ opacity: 0.6, fontWeight: 400 }}>({files.length})</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {files.map((f) => {
                    const fid = f.file_id;
                    const displayName = f.label || basenameFromPath(f.path);
                    const fileName = basenameFromPath(f.path);
                    const downloadName = suggestFilename(f);

                    return (
                        <li
                            key={fid}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 10px",
                                border: "1px solid #232323",
                                background: "var(--gc-field)",
                                borderRadius: 8,
                                marginBottom: 6,
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                      style={{
                          background: "#101010",
                          border: "1px solid var(--gc-border)",
                          borderRadius: 6,
                          padding: "2px 6px",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                      }}
                      title={f.category}
                  >
                    {prettyCategory(f.category)}
                  </span>
                                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>
                    {displayName}
                  </span>
                                </div>
                                {/* NEW: show the actual filename */}
                                <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {fileName}
                                </div>
                            </div>

                            <a
                                href={`/api/proxy/downloads/${encodeURIComponent(String(fid))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`file_id: ${f.file_id} • row id: ${f.id}`}
                                style={{
                                    textDecoration: "none",
                                    background: "var(--gc-accent-soft)",
                                    border: "1px solid var(--gc-accent)",
                                    color: "#e5f0ff",
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Download
                            </a>

                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
