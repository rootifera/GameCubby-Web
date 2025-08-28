"use client";

import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";

type Named = { id: number; name: string };

const inputShort: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "12px 16px",
    outline: "none",
    maxWidth: 200,
};

const selectStyle: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "12px 16px",
    outline: "none",
};

function parseIdsCSV(csv: string): number[] {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
}

interface SearchFormWrapperProps {
    q: string;
    year: string;
    platform_id: string;
    match_mode: string;
    size: number;
    platforms: Named[];
    tagCsv: string;
}

export default function SearchFormWrapper({
    q,
    year,
    platform_id,
    match_mode,
    size,
    platforms,
    tagCsv,
}: SearchFormWrapperProps) {
    const router = useRouter();

    const handleReset = () => {
        // Clear form fields by navigating to the base search page without any parameters
        router.push("/search");
    };

    return (
        <div style={{ border: "1px solid #222", borderRadius: 10, background: "#121212", marginBottom: 16 }}>
            <form method="GET" action="/search" style={{ display: "grid", gap: 16, padding: "16px", marginBottom: 12, gridTemplateColumns: "1fr 1fr" }} onReset={handleReset}>
                {/* Search input */}
                <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85 }}>Search games</span>
                        <SearchBox 
                            defaultValue={q} 
                            wrapWithForm={false}
                            onSelectNavigateTo={null}
                        />
                    </label>
                </div>

                {/* Row 1 — Year + Platform */}
                <div style={{ display: "grid", gap: 16, gridTemplateColumns: "200px 1fr", gridColumn: "span 2" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85 }}>Year (exact)</span>
                        <input
                            name="year"
                            defaultValue={year}
                            inputMode="numeric"
                            placeholder="1998"
                            style={inputShort}
                        />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85 }}>Platform</span>
                        <select name="platform_id" defaultValue={platform_id} style={selectStyle}>
                            <option value="">Any</option>
                            {platforms
                                .slice()
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            }
                        </select>
                    </label>
                </div>

                {/* Row 2 — Tags + Match mode */}
                <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 200px", gridColumn: "span 2" }}>
                    <TagChipsAutocomplete
                        label="Tags"
                        name="tag_ids"
                        suggestKind="tags"
                        defaultSelectedIds={parseIdsCSV(tagCsv)}
                        searchOnly={true}
                    />
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85 }}>Tag match</span>
                        <select name="match_mode" defaultValue={match_mode} style={selectStyle}>
                            <option value="any">Any</option>
                            <option value="all">All</option>
                            <option value="exact">Exact</option>
                        </select>
                    </label>
                </div>

                {/* Page size control */}
                <div style={{ display: "grid", gap: 6, maxWidth: 200, gridColumn: "span 2" }}>
                    <span style={{ opacity: 0.85 }}>Page size</span>
                    <input name="size" defaultValue={String(size)} inputMode="numeric" style={inputShort} />
                </div>

                <div style={{ display: "flex", gap: 8, gridColumn: "span 2" }}>
                    <button
                        type="submit"
                        style={{
                            background: "#1e293b",
                            color: "#fff",
                            border: "1px solid #3b82f6",
                            borderRadius: 8,
                            padding: "10px 14px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Apply
                    </button>
                    <button
                        type="reset"
                        style={{
                            color: "#d8d8d8",
                            border: "1px solid #2b2b2b",
                            borderRadius: 8,
                            padding: "10px 14px",
                            background: "transparent",
                            cursor: "pointer",
                        }}
                    >
                        Reset
                    </button>
                </div>
            </form>
        </div>
    );
}
