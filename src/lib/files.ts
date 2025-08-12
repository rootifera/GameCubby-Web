// src/lib/files.ts

/** ---- API types (kept broad for safety) ---- */
export type FileCategory =
    | "audio_ost"
    | "patch_update"
    | "saves"
    | "disc_image"
    | "screenshots"
    | "manuals_docs"
    | "artwork_covers"
    | "other"
    | string;

export type FileRow = {
    id: number;                 // DB row id
    file_id?: number;           // preferred download id (may be missing on some servers)
    game: string;
    label: string;
    path: string;
    category?: FileCategory;
};

export type UiFile = FileRow & {
    file_id: number;            // guaranteed after normalization
    category: FileCategory;     // guaranteed after normalization
};

/** ---- Group keys (UI sections) ---- */
export type GroupKey =
    | "ISOs"
    | "Images"
    | "Save Files"
    | "Patches and Updates"
    | "Manuals and Docs"
    | "Audio / OST"
    | "Others";

/** ---- Normalizers ---- */

/** Ensure every file has file_id (fallback to id) and a category string */
export function normalizeFiles(rows: FileRow[] | unknown): UiFile[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
        ...r,
        file_id: typeof r.file_id === "number" ? r.file_id : r.id,
        category: (r.category ?? "other") as FileCategory,
    }));
}

/** Human-friendly per-item category label chip */
export function prettyCategory(cat: FileCategory): string {
    switch (String(cat).toLowerCase()) {
        case "disc_image":
            return "Disc Image";
        case "screenshots":
            return "Screenshot";
        case "artwork_covers":
            return "Artwork / Cover";
        case "manuals_docs":
            return "Manual / Doc";
        case "audio_ost":
            return "Audio / OST";
        case "patch_update":
            return "Patch / Update";
        case "saves":
            return "Save File";
        default:
            return "Other";
    }
}

/** Map a raw API category to a UI group */
function categoryToGroup(cat: FileCategory): GroupKey {
    switch (String(cat).toLowerCase()) {
        case "disc_image":
            return "ISOs";
        case "screenshots":
        case "artwork_covers":
            return "Images";
        case "saves":
            return "Save Files";
        case "patch_update":
            return "Patches and Updates";
        case "manuals_docs":
            return "Manuals and Docs";
        case "audio_ost":
            return "Audio / OST";
        default:
            return "Others";
    }
}

/** Group files for display sections */
export function groupFiles(files: UiFile[]): Record<GroupKey, UiFile[]> {
    const out: Record<GroupKey, UiFile[]> = {
        "ISOs": [],
        "Images": [],
        "Save Files": [],
        "Patches and Updates": [],
        "Manuals and Docs": [],
        "Audio / OST": [],
        "Others": [],
    };
    for (const f of files) out[categoryToGroup(f.category)].push(f);
    return out;
}
