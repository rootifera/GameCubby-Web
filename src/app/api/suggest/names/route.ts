import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    // Only suggest for length >= 2
    if (q.length < 2) {
        return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/search/suggest/names?q=${encodeURIComponent(q)}`,
            { cache: "no-store" }
        );

        if (!upstream.ok) {
            return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
        }

        const raw = await upstream.json();

        // Normalize shapes:
        // 1) ["Name A", "Name B"]
        // 2) { suggestions: ["Name A", "Name B"] }
        let list: string[] = [];
        if (Array.isArray(raw)) {
            list = raw.filter((x) => typeof x === "string");
        } else if (raw && typeof raw === "object" && Array.isArray((raw as any).suggestions)) {
            list = (raw as any).suggestions.filter((x: any) => typeof x === "string");
        }

        // Clean + de-duplicate (case-insensitive), preserve order
        const seen = new Set<string>();
        const unique = [];
        for (const s of list) {
            const t = s.trim();
            if (!t) continue;
            const key = t.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(t);
        }

        return NextResponse.json(unique.slice(0, 10), {
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }
}
