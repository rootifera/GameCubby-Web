"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CoverThumb from "@/components/CoverThumb";
import type { WishlistItem, WishlistPlatform } from "@/lib/wishlist";
import { wishlistYear } from "@/lib/wishlist";

type IgdbResult = { id: number; name: string; cover_url?: string | null; release_date?: number | null; platforms?: WishlistPlatform[] };
type LinkDraft = { label: string; url: string };

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

function LinksEditor({ links, onChange }: { links: LinkDraft[]; onChange: (links: LinkDraft[]) => void }) {
    const update = (index: number, field: keyof LinkDraft, value: string) => onChange(links.map((link, i) => i === index ? { ...link, [field]: value } : link));
    return <div style={{ display: "grid", gap: 8 }}>
        <label style={{ opacity: 0.85 }}>Purchase links</label>
        {links.map((link, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(100px, .45fr) minmax(160px, 1fr) auto", gap: 8 }}>
            <input aria-label={`Link ${index + 1} label`} placeholder="Label, e.g. eBay" value={link.label} onChange={(e) => update(index, "label", e.target.value)} style={input} />
            <input aria-label={`Link ${index + 1} URL`} placeholder="https://…" type="url" value={link.url} onChange={(e) => update(index, "url", e.target.value)} style={input} />
            <button type="button" onClick={() => onChange(links.filter((_, i) => i !== index))} style={button}>Remove</button>
        </div>)}
        <button type="button" onClick={() => onChange([...links, { label: "", url: "" }])} style={{ ...button, justifySelf: "start" }}>+ Add purchase link</button>
    </div>;
}

function PlatformChoices({ platforms, selected, onChange }: { platforms: WishlistPlatform[]; selected: number[]; onChange: (ids: number[]) => void }) {
    return <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ marginBottom: 6, opacity: .85 }}>Platforms</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{platforms.map((platform) => <label key={platform.id} style={{ border: "1px solid var(--gc-border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.includes(platform.id)} onChange={(e) => onChange(e.target.checked ? [...selected, platform.id] : selected.filter((id) => id !== platform.id))} /> {platform.name}
        </label>)}</div>
    </fieldset>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 16 }}>
        <section style={{ width: "min(760px, 100%)", maxHeight: "90vh", overflow: "auto", background: "var(--gc-surface)", border: "1px solid var(--gc-border)", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16 }}><h2 style={{ margin: 0 }}>{title}</h2><button type="button" onClick={onClose} style={button}>Close</button></div>{children}
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

    function close() { setMode(null); setActive(null); setError(null); setSelectedIgdb(null); setSelectedPlatformIds([]); setLinks([]); }
    function openAdd() { setError(null); setNotice(null); setAddMethod("igdb"); setIgdbQuery(""); setIgdbResults([]); setLinks([]); setMode("add"); }
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
    const cleanLinks = () => links.map((link) => ({ label: link.label.trim(), url: link.url.trim() })).filter((link) => link.label && validExternalUrl(link.url));
    async function saveAdd(e: React.FormEvent) {
        e.preventDefault(); setSaving(true); setError(null);
        try {
            let endpoint: string; let payload: Record<string, unknown>;
            if (addMethod === "igdb") { if (!selectedIgdb) throw new Error("Select an IGDB result first."); endpoint = "/api/admin/wishlist/from_igdb"; payload = { igdb_id: selectedIgdb.id, platform_ids: selectedPlatformIds, links: cleanLinks() }; }
            else { const fd = new FormData(addForm.current!); const name = String(fd.get("name") ?? "").trim(); if (!name) throw new Error("A name is required."); endpoint = "/api/admin/wishlist"; payload = { name, release_year: Number(fd.get("release_year")) || undefined, cover_url: String(fd.get("cover_url") ?? "").trim() || undefined, platform_ids: selectedPlatformIds, links: cleanLinks() }; }
            const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error(await messageFromResponse(res));
            const created = await res.json().catch(() => null) as WishlistItem | null; if (created?.id) setItems((old) => [created, ...old]); else router.refresh(); setNotice("Wishlist item added."); close();
        } catch (e) { setError(e instanceof Error ? e.message : "Failed to add wishlist item"); } finally { setSaving(false); }
    }
    async function saveEdit(e: React.FormEvent) {
        e.preventDefault(); if (!active) return; setSaving(true); setError(null);
        try { const fd = new FormData(editForm.current!); const payload = { name: String(fd.get("name") ?? "").trim(), release_year: Number(fd.get("release_year")) || null, cover_url: String(fd.get("cover_url") ?? "").trim() || null, platform_ids: selectedPlatformIds, links: cleanLinks() }; const res = await fetch(`/api/admin/wishlist/${active.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error(await messageFromResponse(res)); const updated = await res.json().catch(() => ({ ...active, ...payload, platforms: platforms.filter((p) => selectedPlatformIds.includes(p.id)) })) as WishlistItem; setItems((old) => old.map((item) => item.id === active.id ? updated : item)); setNotice("Wishlist item updated."); close(); }
        catch (e) { setError(e instanceof Error ? e.message : "Failed to update wishlist item"); } finally { setSaving(false); }
    }
    async function deleteItem(item: WishlistItem) {
        if (!window.confirm(`Delete “${item.name}” from the wishlist?`)) return; setSaving(true); setError(null);
        try { const res = await fetch(`/api/admin/wishlist/${item.id}`, { method: "DELETE" }); if (!res.ok) throw new Error(await messageFromResponse(res)); setItems((old) => old.filter((entry) => entry.id !== item.id)); setNotice("Wishlist item deleted."); }
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
        {mode === "add" && <Modal title="Add to Wishlist" onClose={close}><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><button onClick={() => setAddMethod("igdb")} style={addMethod === "igdb" ? primaryButton : button}>Search IGDB</button><button onClick={() => setAddMethod("manual")} style={addMethod === "manual" ? primaryButton : button}>Manual entry</button></div>
            {error && <div role="alert" style={{ color: "#ffb4b4", marginBottom: 12 }}>{error}</div>}
            {addMethod === "igdb" && <form onSubmit={searchIgdb} style={{ display: "flex", gap: 8, marginBottom: 14 }}><input value={igdbQuery} onChange={(e) => setIgdbQuery(e.target.value)} placeholder="Search IGDB" style={input} /><button disabled={searching} style={button}>{searching ? "Searching…" : "Search"}</button></form>}
            {addMethod === "igdb" && igdbResults.length > 0 && <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>{igdbResults.map((result) => <button key={result.id} type="button" onClick={() => { setSelectedIgdb(result); setSelectedPlatformIds([]); }} style={{ ...button, textAlign: "left", borderColor: selectedIgdb?.id === result.id ? "var(--gc-accent)" : "var(--gc-border)" }}>{result.name} {yearFromIgdb(result.release_date) ? `(${yearFromIgdb(result.release_date)})` : ""}</button>)}</div>}
            <form ref={addForm} onSubmit={saveAdd} style={{ display: "grid", gap: 14 }}>{addMethod === "igdb" ? selectedIgdb && <><PlatformChoices platforms={selectedIgdb.platforms ?? []} selected={selectedPlatformIds} onChange={setSelectedPlatformIds} /><small style={{ opacity: .75 }}>Choose the platforms you want. Leaving this blank imports all platforms provided by IGDB.</small></> : <><label>Name<input required name="name" style={input} /></label><label>Release year<input name="release_year" type="number" min="1" max="3000" style={input} /></label><label>Cover URL<input name="cover_url" type="url" style={input} /></label>{loadingPlatforms ? <span>Loading platforms…</span> : <PlatformChoices platforms={platforms} selected={selectedPlatformIds} onChange={setSelectedPlatformIds} />}</>}<LinksEditor links={links} onChange={setLinks} /><button disabled={saving || (addMethod === "igdb" && !selectedIgdb)} style={primaryButton}>{saving ? "Saving…" : "Add to Wishlist"}</button></form>
        </Modal>}
        {mode === "edit" && active && <Modal title={`Edit ${active.name}`} onClose={close}><form ref={editForm} onSubmit={saveEdit} style={{ display: "grid", gap: 14 }}>{error && <div role="alert" style={{ color: "#ffb4b4" }}>{error}</div>}<label>Name<input required name="name" defaultValue={active.name} style={input} /></label><label>Release year<input name="release_year" type="number" min="1" max="3000" defaultValue={active.release_year ?? ""} style={input} /></label><label>Cover URL<input name="cover_url" type="url" defaultValue={active.cover_url ?? ""} style={input} /></label>{loadingPlatforms ? <span>Loading platforms…</span> : <PlatformChoices platforms={platforms} selected={selectedPlatformIds} onChange={setSelectedPlatformIds} />}<LinksEditor links={links} onChange={setLinks} /><button disabled={saving} style={primaryButton}>{saving ? "Saving…" : "Save changes"}</button></form></Modal>}
    </>;
}
