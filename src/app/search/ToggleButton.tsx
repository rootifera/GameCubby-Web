"use client";

export function ToggleButton() {
    const toggleButtonStyle: React.CSSProperties = {
        background: "#151515",
        color: "#d8d8d8",
        border: "1px solid #2b2b2b",
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
