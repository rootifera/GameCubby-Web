"use client";

export function ToggleButton() {
    const toggleButtonStyle: React.CSSProperties = {
        background: "var(--gc-surface-raised)",
        color: "var(--gc-text-secondary)",
        border: "1px solid var(--gc-border)",
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 13,
        cursor: "pointer",
    };

    return (
        <button 
            type="button" 
            style={toggleButtonStyle}
            onClick={(e) => {
                e.preventDefault();
                const details = e.currentTarget.closest('details');
                if (details) {
                    details.open = !details.open;
                }
            }}
        >
            Toggle
        </button>
    );
}
