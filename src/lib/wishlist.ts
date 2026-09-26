export type WishlistPlatform = { id: number; name: string; slug?: string | null };

export type WishlistLink = { id?: number; label: string; url: string };

export type WishlistItem = {
    id: number;
    igdb_id?: number | null;
    name: string;
    release_year?: number | null;
    cover_url?: string | null;
    platforms?: WishlistPlatform[];
    links?: WishlistLink[];
    status?: "active" | "in_library";
    library_game_id?: number | null;
};

export function wishlistYear(value?: number | null): string {
    return typeof value === "number" && value > 0 ? String(value) : "—";
}
