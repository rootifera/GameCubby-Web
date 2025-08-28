"use client";

import { useState } from "react";

interface ExportButtonsProps {
    btnStyle: React.CSSProperties;
}

export function ExportButtons({ btnStyle }: ExportButtonsProps) {
    const [loadingStates, setLoadingStates] = useState({
        json: false,
        csv: false,
        xlsx: false
    });

    const handleDownload = async (format: 'json' | 'csv' | 'xlsx') => {
        if (loadingStates[format]) return;

        // Set loading state
        setLoadingStates(prev => ({ ...prev, [format]: true }));

        try {
            // Map xlsx format to 'excel' endpoint
            const endpoint = format === 'xlsx' ? 'excel' : format;
            const url = `/api/admin/export/games/${endpoint}`;
            const filename = `games.${format === 'xlsx' ? 'xlsx' : format}`;
            
            // Fetch the file
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            
            // Create blob and trigger download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
        } catch (error) {
            console.error(`Export failed for ${format}:`, error);
            // You could add error handling here if needed
        } finally {
            // Reset loading state after a short delay to ensure download starts
            setTimeout(() => {
                setLoadingStates(prev => ({ ...prev, [format]: false }));
            }, 1000);
        }
    };

    const getButtonText = (format: 'json' | 'csv' | 'xlsx') => {
        if (loadingStates[format]) {
            return "Please wait...";
        }
        return `Download ${format.toUpperCase()}`;
    };

    const getButtonStyle = (format: 'json' | 'csv' | 'xlsx') => {
        if (loadingStates[format]) {
            return {
                ...btnStyle,
                opacity: 0.6,
                cursor: 'not-allowed',
                background: '#374151'
            };
        }
        return btnStyle;
    };

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <div style={{ background: "#111", border: "1px solid #262626", borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>JSON export</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                    Full game dataset as JSON.
                </div>
                <button 
                    onClick={() => handleDownload('json')}
                    disabled={loadingStates.json}
                    style={getButtonStyle('json')}
                >
                    {getButtonText('json')}
                </button>
            </div>

            <div style={{ background: "#111", border: "1px solid #262626", borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>CSV export</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                    Flat table of games in CSV format.
                </div>
                <button 
                    onClick={() => handleDownload('csv')}
                    disabled={loadingStates.csv}
                    style={getButtonStyle('csv')}
                >
                    {getButtonText('csv')}
                </button>
            </div>

            <div style={{ background: "#111", border: "1px solid #262626", borderRadius: 12, padding: 14, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>XLSX export</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                    Spreadsheet-friendly export (Excel).
                </div>
                <button 
                    onClick={() => handleDownload('xlsx')}
                    disabled={loadingStates.xlsx}
                    style={getButtonStyle('xlsx')}
                >
                    {getButtonText('xlsx')}
                </button>
            </div>
        </div>
    );
}
