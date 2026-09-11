"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function LibraryControls({ sort, size, page, view }: { sort: string; size: number; page: number; view: "grid" | "list" }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    function update(name: "sort" | "size" | "view", value: string) {
        const params = new URLSearchParams({ sort, size: String(size), page: name === "view" ? String(page) : "1", view });
        params.set(name, value);
        if (name === "view") document.cookie = `gc_library_view=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
        startTransition(() => router.push(`/games?${params.toString()}`, { scroll: false }));
    }

    return <div className="gc-sort-bar gc-library-controls" aria-busy={pending}>
        <div className="gc-library-control"><label htmlFor="library-sort">Sort by</label>
            <select id="library-sort" value={sort} disabled={pending} onChange={(event) => update("sort", event.target.value)}>
                <option value="recent_desc">Recently added</option>
                <option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option>
                <option value="year_desc">Newest release</option><option value="year_asc">Oldest release</option>
                <option value="rating_desc">Highest rating</option><option value="rating_asc">Lowest rating</option>
            </select>
        </div>
        <span role="status" className="gc-library-update-status">{pending ? "Updating games…" : ""}</span>
        <div className="gc-library-control"><label htmlFor="library-size">Page size</label>
            <select id="library-size" value={String(size)} disabled={pending} onChange={(event) => update("size", event.target.value)}>
                {[10, 20, 50, 100].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
        </div>
        <div className="gc-view-toggle" role="group" aria-label="Games display">
            <button type="button" aria-pressed={view === "grid"} disabled={pending} onClick={() => update("view", "grid")}>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z" stroke="currentColor" strokeWidth="1.5" /></svg>Large covers
            </button>
            <button type="button" aria-pressed={view === "list"} disabled={pending} onClick={() => update("view", "list")}>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3 4h2v2H3zM3 9h2v2H3zM3 14h2v2H3zM8 5h9M8 10h9M8 15h9" stroke="currentColor" strokeWidth="1.5" /></svg>List
            </button>
        </div>
    </div>;
}
