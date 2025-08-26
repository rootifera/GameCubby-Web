"use client";

export function ToggleButton({ isOpen }: { isOpen: boolean }) {
    return (
        <button 
            type="button" 
            style={{
                background: "#151515",
                color: "#d8d8d8",
                border: "1px solid #2b2b2b",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
            }}
            onClick={(e) => {
                e.preventDefault();
                const details = e.currentTarget.closest('details') as HTMLDetailsElement;
                if (details) {
                    details.open = !details.open;
                }
            }}
        >
            {isOpen ? "Click to hide filters" : "Click to show filters"}
        </button>
    );
}
