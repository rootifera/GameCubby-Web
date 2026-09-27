"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CoverThumb from "@/components/CoverThumb";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import type { WishlistItem, WishlistPlatform } from "@/lib/wishlist";
import { wishlistYear } from "@/lib/wishlist";

type IgdbResult = { id: number; name: string; cover_url?: string | null; release_date?: number | null; platforms?: WishlistPlatform[] };
type LinkDraft = { label: string; url: string };
type LibraryGame = { id: number; name: string; igdb_id?: number | null; platforms?: WishlistPlatform[] };
type PurchaseLinkShortcut = { id: number; label: string; sort_order?: number };

const button: React.CSSProperties = { border: "1px solid var(--gc-border)", background: "var(--gc-surface-raised)", color: "var(--gc-text)", borderRadius: 8, padding: "7px 10px", cursor: "pointer" };
const primaryButton: React.CSSProperties = { ...button, background: "var(--gc-accent-soft)", borderColor: "var(--gc-accent)", color: "#fff", fontWeight: 600 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--gc-border)", borderRadius: 8, padding: 9, background: "var(--gc-bg)", color: "var(--gc-text)" };

function messageFromResponse(res: Response) {
    return res.text().then((text) => text || `${res.status} ${res.statusText}`);
}

function yearFromIgdb(value?: number | null): number | undefined {
    if (!value) return undefined;
    if (value >= 1000 && value <= 3000) return value;
    return new Date(value >= 1_000_000_000_000 ? value : value * 1000).getUTCFullYear();
}

function validExternalUrl(value: string): string | null {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    } catch { return null; }
}

function parseIdsCSV(value: string): number[] {
    return value.split(",").map((item) => Number(item.trim())).filter((id) => Number.isInteger(id) && id > 0);
}

function LinksEditor({ links, onChange, shortcuts }: { links: LinkDraft[]; onChange: (links: LinkDraft[]) => void; shortcuts: PurchaseLinkShortcut[] }) {
    const update = (index: number, field: keyof LinkDraft, value: string) => onChange(links.map((link, i) => i === index ? { ...link, [field]: value } : link));
    return <div style={{ display: "grid", gap: 8 }}>
        <label style={{ opacity: 0.85 }}>Purchase links</label>
        {links.map((link, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(100px, .45fr) minmax(160px, 1fr) auto", gap: 8 }}>
            <select aria-label={`Link ${index + 1} label`} value={link.label} onChange={(event) => update(index, "label", event.target.value)} style={input}>{shortcuts.map((shortcut) => <option key={shortcut.id} value={shortcut.label}>{shortcut.label}</option>)}</select>
            <input aria-label={`Link ${index + 1} URL`} placeholder="https://…" type="url" value={link.url} onChange={(e) => update(index, "url", e.target.value)} style={input} />
            <button type="button" onClick={() => onChange(links.filter((_, i) => i !== index))} style={button}>Remove</button>
        </div>)}
        <button type="button" disabled={shortcuts.length === 0} onClick={() => onChange([...links, { label: shortcuts[0].label, url: "" }])} style={{ ...button, justifySelf: "start", opacity: shortcuts.length === 0 ? .55 : 1 }}>+ Add purchase link</button>
        {shortcuts.length === 0 ? <small style={{ opacity: .75 }}>Add a label in Shortcut Labels before adding a purchase link.</small> : null}
    </div>;
}

function ShortcutLabelsManager({ shortcuts, onCreate, onUpdate, onDelete }: { shortcuts: PurchaseLinkShortcut[]; onCreate: (label: string) => Promise<void>; onUpdate: (shortcut: PurchaseLinkShortcut, label: string) => Promise<void>; onDelete: (shortcut: PurchaseLinkShortcut) => Promise<void> }) {
    const [newLabel, setNewLabel] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingLabel, setEditingLabel] = useState("");
    return <div style={{ display: "grid", gap: 10 }}>
        <form onSubmit={(event) => { event.preventDefault(); const label = newLabel.trim(); if (!label) return; void onCreate(label).then(() => setNewLabel("")); }} style={{ display: "flex", gap: 8 }}><input aria-label="Shortcut label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Add shortcut label" style={input} /><button type="submit" style={primaryButton}>Add</button></form>
        {shortcuts.length === 0 ? <div style={{ opacity: .75 }}>No shortcut labels yet.</div> : shortcuts.map((shortcut) => <div key={shortcut.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>{editingId === shortcut.id ? <><input aria-label={`Edit ${shortcut.label} shortcut`} value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} style={input} /><button type="button" onClick={() => void onUpdate(shortcut, editingLabel).then(() => setEditingId(null))} style={primaryButton}>Save</button><button type="button" onClick={() => setEditingId(null)} style={button}>Cancel</button></> : <><div style={{ flex: 1 }}>{shortcut.label}</div><button type="button" onClick={() => { setEditingId(shortcut.id); setEditingLabel(shortcut.label); }} style={button}>Edit</button><button type="button" onClick={() => void onDelete(shortcut)} style={button}>Delete</button></>}</div>)}
    </div>;
}

function Modal({ title, children, onClose, onShortcuts }: { title: string; children: React.ReactNode; onClose: () => void; onShortcuts?: () => void }) {
    return <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,.72)", overflowY: "auto", padding: 16 }}>
        <section style={{ width: "min(760px, 100%)", margin: "auto", background: "var(--gc-surface)", border: "1px solid var(--gc-border)", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16 }}><h2 style={{ margin: 0 }}>{title}</h2><div style={{ display: "flex", gap: 8 }}>{onShortcuts ? <button type="button" onClick={onShortcuts} style={button}>Shortcut Labels</button> : null}<button type="button" onClick={onClose} style={button}>Close</button></div></div>{children}
        </section>
    </div>;
}

export default function WishlistClient({ initialItems, isAdmin }: { initialItems: WishlistItem[]; isAdmin: boolean }) {
    const router = useRouter();
    const [items, setItems] = useState(initialItems);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<"add" | "edit" | null>(null);
    const [active, setActive] = useState<WishlistItem | null>(null);
    const [platforms, setPlatforms] = useState<WishlistPlatform[]>([]);
    const [loadingPlatforms, setLoadingPlatforms] = useState(false);
    const [saving, setSaving] = useState(false);
    const [igdbQuery, setIgdbQuery] = useState("");
    const [igdbResults, setIgdbResults] = useState<IgdbResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [addMethod, setAddMethod] = useState<"igdb" | "manual">("igdb");
    const [selectedIgdb, setSelectedIgdb] = useState<IgdbResult | null>(null);
    const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
    const [existingLibraryGames, setExistingLibraryGames] = useState<LibraryGame[]>([]);
    const [shortcuts, setShortcuts] = useState<PurchaseLinkShortcut[]>([]);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [links, setLinks] = useState<LinkDraft[]>([]);
    const addForm = useRef<HTMLFormElement>(null);
    const editForm = useRef<HTMLFormElement>(null);

    async function loadPlatforms() {
        setLoadingPlatforms(true);
        try {
            const res = await fetch("/api/admin/platforms", { cache: "no-store" });
            if (!res.ok) throw new Error(await messageFromResponse(res));
            const data = await res.json() as WishlistPlatform[];
            setPlatforms(Array.isArray(data) ? data : []);
        } catch (e) { setError(e instanceof Error ? e.message : "Failed to load platforms"); }
        finally { setLoadingPlatforms(false); }
    }

    useEffect(() => { if (isAdmin && mode && (mode === "add" || mode === "edit")) void loadPlatforms(); }, [isAdmin, mode]);

    async function loadShortcuts() {
        const response = await fetch("/api/admin/purchase-link-shortcuts", { cache: "no-store" });
        if (!response.ok) throw new Error(await messageFromResponse(response));
        const data = await response.json() as PurchaseLinkShortcut[];
        setShortcuts(Array.isArray(data) ? data : []);
    }
    useEffect(() => { if (isAdmin && (mode === "add" || mode === "edit")) void loadShortcuts().catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load purchase link shortcuts")); }, [isAdmin, mode]);
    async function createShortcut(label: string) {
        const response = await fetch("/api/admin/purchase-link-shortcuts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
        if (!response.ok) throw new Error(await messageFromResponse(response));
        await loadShortcuts();
    }
    async function deleteShortcut(shortcut: PurchaseLinkShortcut) {
        if (!window.confirm(`Remove “${shortcut.label}” as a shortcut? Existing Wishlist links will not change.`)) return;
        const response = await fetch(`/api/admin/purchase-link-shortcuts/${shortcut.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(await messageFromResponse(response));
        setShortcuts((current) => current.filter((item) => item.id !== shortcut.id));
    }
    async function updateShortcut(shortcut: PurchaseLinkShortcut, label: string) {
        const response = await fetch(`/api/admin/purchase-link-shortcuts/${shortcut.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim(), sort_order: shortcut.sort_order ?? 0 }) });
        if (!response.ok) throw new Error(await messageFromResponse(response));
        await loadShortcuts();
    }
    async function saveNewLinkLabels(nextLinks: LinkDraft[]) {
        const existing = new Set(shortcuts.map((shortcut) => shortcut.label.trim().toLowerCase()));
        const labels = Array.from(new Set(nextLinks.map((link) => link.label.trim()).filter((label) => label && !existing.has(label.toLowerCase()))));
        for (const label of labels) await createShortcut(label);
    }
    function close() { setMode(null); setActive(null); setError(null); setSelectedIgdb(null); setSelectedPlatformIds([]); setExistingLibraryGames([]); setLinks([]); }
    function openAdd() { setError(null); setNotice(null); setAddMethod("igdb"); setIgdbQuery(""); setIgdbResults([]); setExistingLibraryGames([]); setLinks([]); setMode("add"); }
    async function openEdit(item: WishlistItem) {
        setError(null); setNotice(null); setMode("edit"); setActive(item); setLinks((item.links ?? []).map(({ label, url }) => ({ label, url }))); setSelectedPlatformIds((item.platforms ?? []).map((p) => p.id));
        try {
            const res = await fetch(`/api/proxy/wishlist/${item.id}`, { cache: "no-store" });
            if (!res.ok) throw new Error(await messageFromResponse(res));
            const full = await res.json() as WishlistItem;
            setActive(full); setLinks((full.links ?? []).map(({ label, url }) => ({ label, url }))); setSelectedPlatformIds((full.platforms ?? []).map((p) => p.id));
        } catch (e) { setError(e instanceof Error ? e.message : "Failed to load wishlist item"); }
    }
    async function searchIgdb(e: React.FormEvent) {
        e.preventDefault(); const q = igdbQuery.trim(); if (!q) return;
        setSearching(true); setError(null);
        try { const res = await fetch(`/api/admin/igdb/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }); if (!res.ok) throw new Error(await messageFromResponse(res)); const body = await res.json() as IgdbResult[] | { results?: IgdbResult[] }; setIgdbResults(Array.isArray(body) ? body : body.results ?? []); }
        catch (e) { setError(e instanceof Error ? e.message : "IGDB search failed"); } finally { setSearching(false); }
    }
    async function findExistingLibraryGames(igdbId: number): Promise<LibraryGame[]> {
        const listResponse = await fetch("/api/proxy/games", { cache: "no-store" });
        if (!listResponse.ok) return [];
        const games = await listResponse.json() as LibraryGame[];
        if (!Array.isArray(games)) return [];
        const previewMatches = games.filter((game) => game.igdb_id === igdbId);
        if (previewMatches.length) {
            return Promise.all(previewMatches.map(async (game) => {
                try {
                    const response = await fetch(`/api/proxy/games/${game.id}`, { cache: "no-store" });
                    return response.ok ? await response.json() as LibraryGame : game;
                } catch { return game; }
            }));
        }

        // Some API versions omit igdb_id from list previews. Check the detail
        // endpoint only when the preview data cannot answer the exact-ID query.
        if (games.some((game) => typeof game.igdb_id === "number")) return [];
        const matches: LibraryGame[] = [];
        for (let index = 0; index < games.length; index += 8) {
            const chunk = games.slice(index, index + 8);
            const details = await Promise.all(chunk.map(async (game) => {
                try {
                    const response = await fetch(`/api/proxy/games/${game.id}`, { cache: "no-store" });
                    return response.ok ? await response.json() as LibraryGame : null;
                } catch { return null; }
            }));
            matches.push(...details.filter((game): game is LibraryGame => game?.igdb_id === igdbId));
        }
        return matches;
    }
    function selectIgdbResult(result: IgdbResult) {
        setSelectedIgdb(result);
        setSelectedPlatformIds([]);
        setExistingLibraryGames([]);
        void findExistingLibraryGames(result.id).then(setExistingLibraryGames).catch(() => setExistingLibraryGames([]));
    }
    const cleanLinks = () => links.map((link) => ({ label: link.label.trim(), url: link.url.trim() })).filter((link) => link.label && validExternalUrl(link.url));
    async function saveAdd(e: React.FormEvent) {
        e.preventDefault(); setSaving(true); setError(null);
        try {
            let endpoint: string; let payload: Record<string, unknown>;
            if (addMethod === "igdb") { const platformIds = parseIdsCSV(String(new FormData(addForm.current!).get("platform_ids") || "")); if (!selectedIgdb) throw new Error("Select an IGDB result first."); if (!platformIds.length) throw new Error("Choose at least one platform for this Wishlist item."); endpoint = "/api/admin/wishlist/from_igdb"; payload = { igdb_id: selectedIgdb.id, platform_ids: platformIds, links: cleanLinks() }; }
            else { const fd = new FormData(addForm.current!); const name = String(fd.get("name") ?? "").trim(); if (!name) throw new Error("A name is required."); endpoint = "/api/admin/wishlist"; payload = { name, release_year: Number(fd.get("release_year")) || undefined, cover_url: String(fd.get("cover_url") ?? "").trim() || undefined, platform_ids: selectedPlatformIds, links: cleanLinks() }; }
            const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error(await messageFromResponse(res));
            const created = await res.json().catch(() => null) as WishlistItem | null; if (created?.id) setItems((old) => [created, ...old]); else router.refresh(); await saveNewLinkLabels(cleanLinks()); setNotice("Wishlist item added."); close();
        } catch (e) { setError(e instanceof Error ? e.message : "Failed to add wishlist item"); } finally { setSaving(false); }
    }
    async function saveEdit(e: React.FormEvent) {
        e.preventDefault(); if (!active) return; setSaving(true); setError(null);
        try { const fd = new FormData(editForm.current!); const links = cleanLinks(); const payload = active.igdb_id ? { platform_ids: selectedPlatformIds, links } : { name: String(fd.get("name") ?? "").trim(), release_year: Number(fd.get("release_year")) || null, cover_url: String(fd.get("cover_url") ?? "").trim() || null, platform_ids: selectedPlatformIds, links }; const res = await fetch(`/api/admin/wishlist/${active.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error(await messageFromResponse(res)); const updated = await res.json().catch(() => ({ ...active, ...payload, platforms: platforms.filter((p) => selectedPlatformIds.includes(p.id)) })) as WishlistItem; setItems((old) => old.map((item) => item.id === active.id ? updated : item)); await saveNewLinkLabels(links); setNotice("Wishlist item updated."); close(); }
        catch (e) { setError(e instanceof Error ? e.message : "Failed to update wishlist item"); } finally { setSaving(false); }
    }
    async function deleteItem(item: WishlistItem) {
        if (!window.confirm(`Delete “${item.name}” from the wishlist?`)) return; setSaving(true); setError(null);
        try {
            const res = await fetch(`/api/admin/wishlist/${item.id}`, { method: "DELETE" });
            if (!res.ok) {
                // A few API deployments commit DELETE before their connection
                // closes unexpectedly. Confirm the durable state before showing
                // an error, so a completed deletion is never reported as failed.
                const verify = await fetch(`/api/proxy/wishlist/${item.id}`, { cache: "no-store" });
                if (verify.status !== 404) throw new Error(await messageFromResponse(res));
            }
            setItems((old) => old.filter((entry) => entry.id !== item.id));
            setNotice("Wishlist item deleted.");
        }
        catch (e) { setError(e instanceof Error ? e.message : "Failed to delete wishlist item"); } finally { setSaving(false); }
    }
    return <>
        {notice && <div role="status" style={{ background: "#103720", border: "1px solid #236b3a", padding: 12, borderRadius: 8, marginBottom: 14 }}>{notice}</div>}
        {error && !mode && <div role="alert" style={{ background: "#3b0f12", border: "1px solid #5b1a1f", padding: 12, borderRadius: 8, marginBottom: 14 }}>{error}</div>}
        {isAdmin && <div style={{ marginBottom: 16 }}><button onClick={openAdd} style={primaryButton}>Add to Wishlist</button></div>}
        {items.length === 0 ? <div style={{ padding: 24, border: "1px solid var(--gc-border)", borderRadius: 12, background: "var(--gc-surface)" }}>No wishlist items yet.</div> : <div style={{ display: "grid", gap: 12 }}>{items.map((item) => <article key={item.id} style={{ display: "flex", gap: 14, padding: 14, border: "1px solid var(--gc-border)", borderRadius: 12, background: "var(--gc-surface)" }}>
            <CoverThumb name={item.name} coverUrl={item.cover_url} width={76} height={106} rounded />
            <div style={{ minWidth: 0, flex: 1 }}><h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{item.name}</h2><div style={{ opacity: .8, marginBottom: 8 }}>{wishlistYear(item.release_year)}{item.platforms?.length ? ` · ${item.platforms.map((p) => p.name).join(", ")}` : ""}</div>
                {item.links?.length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{item.links.map((link, index) => { const href = validExternalUrl(link.url); return href ? <a key={`${link.id ?? index}-${link.url}`} href={href} target="_blank" rel="noopener noreferrer" style={{ ...button, textDecoration: "none" }}>{link.label}</a> : null; })}</div> : null}
            </div>
            {isAdmin && <div style={{ display: "flex", gap: 7, alignSelf: "start", flexWrap: "wrap", justifyContent: "flex-end" }}><button onClick={() => router.push(`/admin/games/add?wishlist_id=${item.id}`)} style={primaryButton}>Purchased</button><button onClick={() => void openEdit(item)} style={button}>Edit</button><button disabled={saving} onClick={() => void deleteItem(item)} style={button}>Delete</button></div>}
        </article>)}</div>}
        {mode === "add" && <Modal title="Add to Wishlist" onClose={close} onShortcuts={() => setShortcutsOpen(true)}><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><button onClick={() => setAddMethod("igdb")} style={addMethod === "igdb" ? primaryButton : button}>Search IGDB</button><button onClick={() => setAddMethod("manual")} style={addMethod === "manual" ? primaryButton : button}>Manual entry</button></div>
            {error && <div role="alert" style={{ color: "#ffb4b4", marginBottom: 12 }}>{error}</div>}
            {addMethod === "igdb" && <form onSubmit={searchIgdb} style={{ display: "flex", gap: 8, marginBottom: 14 }}><input value={igdbQuery} onChange={(e) => setIgdbQuery(e.target.value)} placeholder="Search IGDB" style={input} /><button disabled={searching} style={button}>{searching ? "Searching…" : "Search"}</button></form>}
            {addMethod === "igdb" && igdbResults.length > 0 && <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>{igdbResults.map((result) => <button key={result.id} type="button" onClick={() => selectIgdbResult(result)} style={{ ...button, textAlign: "left", borderColor: selectedIgdb?.id === result.id ? "var(--gc-accent)" : "var(--gc-border)" }}>{result.name} {yearFromIgdb(result.release_date) ? `(${yearFromIgdb(result.release_date)})` : ""}</button>)}</div>}
            <form ref={addForm} onSubmit={saveAdd} style={{ display: "grid", gap: 14 }}>{addMethod === "igdb" ? selectedIgdb && <><MultiSelectDropdown key={`wishlist-igdb-platforms-${selectedIgdb.id}`} label="Platforms" name="platform_ids" options={selectedIgdb.platforms ?? []} defaultSelectedIds={selectedPlatformIds} multiple placeholder="Select platforms…" onSelectedIdsChange={(ids) => setSelectedPlatformIds(ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))} />{existingLibraryGames.length > 0 ? <div role="status" style={{ background: "#3b3210", border: "1px solid #826b22", color: "#fff0b3", padding: 10, borderRadius: 8 }}>Already in your library:<div style={{ display: "grid", gap: 5, marginTop: 8 }}>{existingLibraryGames.map((game, index) => <a key={game.id} href={`/games/${game.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#fff0b3" }}>Link {index + 1}: {game.name}{game.platforms?.length ? ` — ${game.platforms.map((platform) => platform.name).join(", ")}` : ""}</a>)}</div><div style={{ marginTop: 8 }}>You can still add this title to your Wishlist; this notification is information only.</div></div> : null}<small style={{ opacity: .75 }}>Choose the platforms you want. Leaving this blank imports all platforms provided by IGDB.</small></> : <><label>Name<input required name="name" style={input} /></label><label>Release year<input name="release_year" type="number" min="1" max="3000" style={input} /></label><label>Cover URL<input name="cover_url" type="url" style={input} /></label>{loadingPlatforms ? <span>Loading platforms…</span> : <MultiSelectDropdown key="wishlist-manual-platforms" label="Platforms" name="platform_ids" options={platforms} defaultSelectedIds={selectedPlatformIds} multiple placeholder="Select platforms…" onSelectedIdsChange={(ids) => setSelectedPlatformIds(ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))} />}</>}<LinksEditor links={links} onChange={setLinks} shortcuts={shortcuts} /><button disabled={saving || (addMethod === "igdb" && !selectedIgdb)} style={primaryButton}>{saving ? "Saving…" : "Add to Wishlist"}</button></form>
        </Modal>}
        {mode === "edit" && active && <Modal title={`Edit ${active.name}`} onClose={close} onShortcuts={() => setShortcutsOpen(true)}><form ref={editForm} onSubmit={saveEdit} style={{ display: "grid", gap: 14 }}>{error && <div role="alert" style={{ color: "#ffb4b4" }}>{error}</div>}{active.igdb_id ? <div style={{ opacity: .8 }}>IGDB metadata is read-only. Edit platforms and purchase links below.</div> : <><label>Name<input required name="name" defaultValue={active.name} style={input} /></label><label>Release year<input name="release_year" type="number" min="1" max="3000" defaultValue={active.release_year ?? ""} style={input} /></label><label>Cover URL<input name="cover_url" type="url" defaultValue={active.cover_url ?? ""} style={input} /></label></>}{loadingPlatforms ? <span>Loading platforms…</span> : <MultiSelectDropdown key={`wishlist-edit-platforms-${active.id}`} label="Platforms" name="platform_ids" options={platforms} defaultSelectedIds={selectedPlatformIds} multiple placeholder="Select platforms…" onSelectedIdsChange={(ids) => setSelectedPlatformIds(ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))} />}<LinksEditor links={links} onChange={setLinks} shortcuts={shortcuts} /><button disabled={saving} style={primaryButton}>{saving ? "Saving…" : "Save changes"}</button></form></Modal>}
        {shortcutsOpen && <Modal title="Shortcut Labels" onClose={() => setShortcutsOpen(false)}><ShortcutLabelsManager shortcuts={shortcuts} onCreate={createShortcut} onUpdate={updateShortcut} onDelete={deleteShortcut} /></Modal>}
    </>;
}
