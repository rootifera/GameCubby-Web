import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";

export const metadata = {
    title: "First Run Setup • GameCubby",
    description: "Configure admin account and IGDB credentials",
};

/** Check first-run status. API returns plain "true" or "false". */
async function isFirstRunDone(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}/first_run/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = (await res.text()).trim().toLowerCase();
        if (text === "true") return true;
        if (text === "false") return false;

        // if backend ever switches to JSON: { done: boolean }
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed?.done === "boolean") return parsed.done;
        } catch {
            /* ignore */
        }
        return true; // unknown -> assume configured
    } catch {
        // fail open so the app is usable even if the status call fails
        return true;
    }
}

export default async function SetupPage({
                                            searchParams,
                                        }: {
    searchParams?: { error?: string };
}) {
    const alreadyDone = await isFirstRunDone();
    const errorMsg = searchParams?.error ? decodeURIComponent(searchParams.error) : "";

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
                <Link href="/" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    ← Back to Home
                </Link>
            </div>

            <h1 style={{ fontSize: 24, margin: "0 0 12px 0" }}>First Run Setup</h1>

            {/* If setup is already completed, show a friendly message and no form */}
            {alreadyDone ? (
                <div
                    style={{
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 12,
                        padding: 16,
                        maxWidth: 640,
                    }}
                >
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                        ✅ <strong>Setup is already completed.</strong>
                    </p>
                    <p style={{ opacity: 0.9, marginTop: 8, lineHeight: 1.6 }}>
                        You can manage or update your IGDB keys and other settings later in the{" "}
                        <Link href="/admin" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                            Admin
                        </Link>{" "}
                        page.
                    </p>
                    <div style={{ marginTop: 12 }}>
                        <Link
                            href="/"
                            style={{
                                display: "inline-block",
                                background: "#1e293b",
                                color: "#fff",
                                border: "1px solid #3b82f6",
                                borderRadius: 8,
                                padding: "10px 14px",
                                fontWeight: 600,
                                textDecoration: "none",
                            }}
                        >
                            Go to Home
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    <p style={{ opacity: 0.8, marginBottom: 16 }}>
                        Create your admin user and set IGDB credentials. This only needs to be done once.
                    </p>

                    {/* Error from submit handler, if any */}
                    {errorMsg ? (
                        <div
                            style={{
                                background: "#3b0f12",
                                border: "1px solid #5b1a1f",
                                color: "#ffd7d7",
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 12,
                                maxWidth: 640,
                            }}
                        >
                            {errorMsg}
                        </div>
                    ) : null}

                    <form
                        method="POST"
                        action="/setup/submit"
                        style={{
                            background: "#111",
                            border: "1px solid #262626",
                            borderRadius: 12,
                            padding: 16,
                            maxWidth: 640,
                        }}
                    >
                        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                            <legend style={{ fontWeight: 600, marginBottom: 10 }}>Admin User</legend>

                            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                                <label style={labelStyle}>
                                    <span>Username</span>
                                    <input
                                        type="text"
                                        name="admin_username"
                                        required
                                        minLength={3}
                                        placeholder="admin"
                                        style={inputStyle}
                                    />
                                </label>

                                <label style={labelStyle}>
                                    <span>Password</span>
                                    <input
                                        type="password"
                                        name="admin_password"
                                        required
                                        minLength={6}
                                        placeholder="••••••"
                                        style={inputStyle}
                                    />
                                </label>
                            </div>
                        </fieldset>

                        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                            <legend style={{ fontWeight: 600, marginBottom: 10 }}>IGDB Credentials</legend>

                            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                                <label style={labelStyle}>
                                    <span>Client ID</span>
                                    <input
                                        type="text"
                                        name="igdb_client_id"
                                        required
                                        placeholder="your IGDB client id"
                                        style={inputStyle}
                                    />
                                </label>

                                <label style={labelStyle}>
                                    <span>Client Secret</span>
                                    <input
                                        type="password"
                                        name="igdb_client_secret"
                                        required
                                        placeholder="your IGDB client secret"
                                        style={inputStyle}
                                    />
                                </label>

                                <label style={labelStyle}>
                                    <span>Query Limit</span>
                                    <input
                                        type="number"
                                        name="query_limit"
                                        defaultValue={100}
                                        min={1}
                                        max={200}
                                        style={inputStyle}
                                    />
                                </label>
                            </div>
                        </fieldset>

                        {/* New: Downloads settings */}
                        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                            <legend style={{ fontWeight: 600, marginBottom: 10 }}>Downloads</legend>
                            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                                <label style={labelStyle}>
                                    <span>Enable Public Downloads</span>
                                    <select
                                        name="public_downloads_enabled"
                                        defaultValue="false"
                                        style={inputStyle}
                                    >
                                        <option value="false">No</option>
                                        <option value="true">Yes</option>
                                    </select>
                                </label>
                            </div>
                        </fieldset>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button type="submit" style={buttonStyle}>
                                Run Setup
                            </button>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>
                Submits to <code>/setup/submit</code> and then calls your API.
              </span>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
};

const inputStyle: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "10px 12px",
    outline: "none",
};

const buttonStyle: React.CSSProperties = {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #3b82f6",
    borderRadius: 8,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
};
