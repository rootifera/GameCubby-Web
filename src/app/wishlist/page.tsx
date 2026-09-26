import PageIntro from "@/components/PageIntro";
import WishlistClient from "@/components/WishlistClient";
import { API_BASE_URL } from "@/lib/env";
import { isJwtActive, readToken } from "@/lib/auth";
import type { WishlistItem } from "@/lib/wishlist";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
    let items: WishlistItem[] = [];
    let error: string | null = null;
    try {
        const res = await fetch(`${API_BASE_URL}/wishlist/`, { cache: "no-store" });
        if (!res.ok) throw new Error(`GET /wishlist/ -> ${res.status} ${res.statusText}`);
        const data = await res.json();
        items = Array.isArray(data) ? data : [];
    } catch (e) { error = e instanceof Error ? e.message : "Failed to load wishlist"; }
    const token = await readToken();
    const isAdmin = token ? isJwtActive(token) : false;
    return <div><PageIntro eyebrow="Future additions" title="Wishlist" description="Games you want to add to your collection." />{error ? <div role="alert" style={{ background: "#3b0f12", border: "1px solid #5b1a1f", padding: 12, borderRadius: 8, marginBottom: 14 }}>Failed to load wishlist.<div style={{ marginTop: 6, fontSize: 12 }}>{error}</div></div> : <WishlistClient initialItems={items} isAdmin={isAdmin} />}</div>;
}
