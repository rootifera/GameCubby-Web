"use client";

export function ToggleButton({ isOpen }: { isOpen: boolean }) {
    return (
        <button 
            type="button" 
            style={{
                background: "var(--gc-surface-raised)",
                color: "var(--gc-text-secondary)",
                border: "1px solid var(--gc-border)",
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
