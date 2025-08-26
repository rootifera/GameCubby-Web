"use client";

export default function BackButton() {
    return (
        <button 
            onClick={() => window.history.back()}
            style={{ 
                color: "#a0c4ff", 
                textDecoration: "none",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "inherit",
                fontFamily: "inherit",
                padding: 0,
                margin: 0
            }}
        >
            ← Back
        </button>
    );
}
