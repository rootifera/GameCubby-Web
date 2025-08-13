import AddFromIGDB from "./ui/AddFromIGDB";

export const metadata = {
    title: "Add Game • Admin • GameCubby",
};

export default function AdminAddGamePage() {
    return (
        <div style={{ padding: 16 }}>
            <h1 style={{ fontSize: 24, margin: "0 0 12px 0" }}>Add game from IGDB</h1>
            <p style={{ opacity: 0.8, marginTop: 0, marginBottom: 12 }}>
                Search IGDB, preview details in a side drawer, then (in the next step) add it to your library.
            </p>
            <AddFromIGDB />
        </div>
    );
}
