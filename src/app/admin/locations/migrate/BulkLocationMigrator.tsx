"use client";

import React, { useState, useEffect, useRef } from "react";
import LocationTreePicker from "@/components/LocationTreePicker";

type GamePreview = {
    id: number;
    name: string;
};

type LocationNode = {
    id: number;
    name: string;
    parent_id: number | null;
    type?: string | null;
};

type MigrationResponse = {
    migrated: number;
};

export default function BulkLocationMigrator() {
    const [sourceLocationId, setSourceLocationId] = useState<number | undefined>(undefined);
    const [targetLocationId, setTargetLocationId] = useState<number | undefined>(undefined);
    const [sourceGames, setSourceGames] = useState<GamePreview[] | null>(null);
    const [targetGames, setTargetGames] = useState<GamePreview[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [sourceLocationName, setSourceLocationName] = useState<string>("");
    const [targetLocationName, setTargetLocationName] = useState<string>("");
    
    // Refs for the location picker containers
    const sourcePickerRef = useRef<HTMLDivElement | null>(null);
    const targetPickerRef = useRef<HTMLDivElement | null>(null);

    // Fetch games for a specific location
    const fetchGamesByLocation = async (locationId: number): Promise<GamePreview[]> => {
        try {
            console.log(`Fetching games for location ${locationId} using dedicated endpoint...`);
            
            // Use the dedicated endpoint for getting games by location
            const response = await fetch(`/api/proxy/locations/${locationId}/games`, {
                cache: "no-store",
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch games: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Games in location ${locationId}:`, data);
            
            // Ensure we return an array
            return Array.isArray(data) ? data : [];
            
        } catch (error) {
            console.error("Error fetching games:", error);
            return [];
        }
    };

    // Handle source location change
    const handleSourceLocationChange = async (locationId: number | undefined) => {
        setSourceLocationId(locationId);
        setSourceGames(null);
        setSourceLocationName("");
        
        if (locationId) {
            try {
                // Get location name
                const locationResponse = await fetch(`/api/proxy/locations/${locationId}`, {
                    cache: "no-store",
                });
                if (locationResponse.ok) {
                    const location: LocationNode = await locationResponse.json();
                    setSourceLocationName(location.name);
                }
                
                // Get games in this location
                const games = await fetchGamesByLocation(locationId);
                setSourceGames(games);
            } catch (error) {
                console.error("Error loading source location:", error);
            }
        }
    };

    // Handle target location change
    const handleTargetLocationChange = async (locationId: number | undefined) => {
        setTargetLocationId(locationId);
        setTargetGames(null);
        setTargetLocationName("");
        
        if (locationId) {
            try {
                // Get location name
                const locationResponse = await fetch(`/api/proxy/locations/${locationId}`, {
                    cache: "no-store",
                });
                if (locationResponse.ok) {
                    const location: LocationNode = await locationResponse.json();
                    setTargetLocationName(location.name);
                }
                
                // Get games in this location
                const games = await fetchGamesByLocation(locationId);
                setTargetGames(games);
            } catch (error) {
                console.error("Error loading target location:", error);
            }
        }
    };

    // Effect to watch for source location picker changes
    useEffect(() => {
        const host = sourcePickerRef.current;
        if (!host) return;
        
        const input = host.querySelector('input[name="source_location_id"]') as HTMLInputElement | null;
        if (!input) return;

        const update = () => {
            const v = input.value.trim();
            const n = Number(v);
            const newId = Number.isFinite(n) && n > 0 ? n : undefined;
            if (newId !== sourceLocationId) {
                handleSourceLocationChange(newId);
            }
        };
        
        update();

        input.addEventListener("input", update);
        input.addEventListener("change", update);
        const mo = new MutationObserver(update);
        mo.observe(input, { attributes: true, attributeFilter: ["value"] });

        return () => {
            input.removeEventListener("input", update);
            input.removeEventListener("change", update);
            mo.disconnect();
        };
    }, [sourcePickerRef.current, sourceLocationId]);

    // Effect to watch for target location picker changes
    useEffect(() => {
        const host = targetPickerRef.current;
        if (!host) return;
        
        const input = host.querySelector('input[name="target_location_id"]') as HTMLInputElement | null;
        if (!input) return;

        const update = () => {
            const v = input.value.trim();
            const n = Number(v);
            const newId = Number.isFinite(n) && n > 0 ? n : undefined;
            if (newId !== targetLocationId) {
                handleTargetLocationChange(newId);
            }
        };
        
        update();

        input.addEventListener("input", update);
        input.addEventListener("change", update);
        const mo = new MutationObserver(update);
        mo.observe(input, { attributes: true, attributeFilter: ["value"] });

        return () => {
            input.removeEventListener("input", update);
            input.removeEventListener("change", update);
            mo.disconnect();
        };
    }, [targetPickerRef.current, targetLocationId]);

    // Execute the migration
    const executeMigration = async () => {
        if (!sourceLocationId || !targetLocationId) return;
        
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        
        try {
            console.log(`Attempting migration from location ${sourceLocationId} to ${targetLocationId}`);
            const response = await fetch("/api/admin/locations/migrate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    source_location_id: sourceLocationId,
                    target_location_id: targetLocationId,
                }),
            });
            
            console.log(`Migration response status: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Migration failed with status ${response.status}:`, errorText);
                throw new Error(`Migration failed: ${response.status} ${errorText}`);
            }
            
            const result: MigrationResponse = await response.json();
            console.log(`Migration successful:`, result);
            setSuccess(`${result.migrated} games migrated successfully from "${sourceLocationName}" to "${targetLocationName}"`);
            
            // Refresh the game lists
            if (sourceLocationId) {
                const newSourceGames = await fetchGamesByLocation(sourceLocationId);
                setSourceGames(newSourceGames);
            }
            if (targetLocationId) {
                const newTargetGames = await fetchGamesByLocation(targetLocationId);
                setTargetGames(newTargetGames);
            }
            
            setShowConfirmation(false);
        } catch (error) {
            console.error("Migration error:", error);
            setError(error instanceof Error ? error.message : "Migration failed");
        } finally {
            setIsLoading(false);
        }
    };

    const canMigrate = sourceLocationId && targetLocationId && sourceLocationId !== targetLocationId;
    const hasSourceGames = sourceGames && sourceGames.length > 0;

    return (
        <div>
            {/* Error/Success Messages */}
            {error && (
                <div style={{
                    background: "#1a1a1a",
                    border: "1px solid #dc2626",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    color: "#fca5a5"
                }}>
                    {error}
                </div>
            )}
            
            {success && (
                <div style={{
                    background: "#1a1a1a",
                    border: "1px solid #16a34a",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    color: "#86efac"
                }}>
                    {success}
                </div>
            )}

            {/* Source Location */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>Source Location</h3>
                <div style={{ position: "relative" }} ref={sourcePickerRef}>
                    <LocationTreePicker
                        label="Select source location"
                        name="source_location_id"
                        defaultSelectedId={sourceLocationId}
                        height={200}
                    />
                    {sourceLocationId && (
                        <div style={{ marginTop: 8 }}>
                            <button
                                onClick={() => handleSourceLocationChange(sourceLocationId)}
                                style={{
                                    background: "#1e40af",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    cursor: "pointer"
                                }}
                            >
                                Refresh Games List
                            </button>
                            {sourceGames && (
                                <div style={{ marginTop: 8 }}>
                                    <strong>Games in this location ({sourceGames.length}):</strong>
                                    <div style={{
                                        maxHeight: 120,
                                        overflowY: "auto",
                                        background: "#1a1a1a",
                                        border: "1px solid #374151",
                                        borderRadius: 6,
                                        padding: 8,
                                        marginTop: 4
                                    }}>
                                        {sourceGames.map(game => (
                                            <div key={game.id} style={{ fontSize: 12, marginBottom: 2 }}>
                                                {game.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Target Location */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>Target Location</h3>
                <div style={{ position: "relative" }} ref={targetPickerRef}>
                    <LocationTreePicker
                        label="Select target location"
                        name="target_location_id"
                        defaultSelectedId={targetLocationId}
                        height={200}
                    />
                    {targetLocationId && (
                        <div style={{ marginTop: 8 }}>
                            <button
                                onClick={() => handleTargetLocationChange(targetLocationId)}
                                style={{
                                    background: "#1e40af",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    cursor: "pointer"
                                }}
                            >
                                Refresh Games List
                            </button>
                            {targetGames && (
                                <div style={{ marginTop: 8 }}>
                                    <strong>Games in this location ({targetGames.length}):</strong>
                                    <div style={{
                                        maxHeight: 120,
                                        overflowY: "auto",
                                        background: "#1a1a1a",
                                        border: "1px solid #374151",
                                        borderRadius: 6,
                                        padding: 8,
                                        marginTop: 4
                                    }}>
                                        {targetGames.map(game => (
                                            <div key={game.id} style={{ fontSize: 12, marginBottom: 2 }}>
                                                {game.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Migration Button */}
            <div style={{ marginTop: 24 }}>
                <button
                    onClick={() => setShowConfirmation(true)}
                    disabled={!canMigrate || !hasSourceGames || isLoading}
                    style={{
                        background: canMigrate && hasSourceGames ? "#dc2626" : "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "12px 24px",
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: canMigrate && hasSourceGames ? "pointer" : "not-allowed",
                        opacity: canMigrate && hasSourceGames ? 1 : 0.6
                    }}
                >
                    {isLoading ? "Migrating..." : "Migrate Games"}
                </button>
                
                {!canMigrate && (
                    <div style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
                        {!sourceLocationId || !targetLocationId 
                            ? "Please select both source and target locations"
                            : sourceLocationId === targetLocationId 
                                ? "Source and target locations must be different"
                                : "No games found in source location"
                        }
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showConfirmation && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000
                }}>
                    <div style={{
                        background: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: 12,
                        padding: 24,
                        maxWidth: 500,
                        width: "90%"
                    }}>
                        <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
                            Confirm Migration
                        </h3>
                        <p style={{ marginBottom: 24, lineHeight: 1.5 }}>
                            Are you sure you want to move all {sourceGames?.length || 0} games from{" "}
                            <strong>"{sourceLocationName}"</strong> to{" "}
                            <strong>"{targetLocationName}"</strong>?
                        </p>
                        <p style={{ marginBottom: 24, fontSize: 14, color: "#9ca3af" }}>
                            This action cannot be undone. All games in the source location will be moved to the target location.
                        </p>
                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setShowConfirmation(false)}
                                style={{
                                    background: "#6b7280",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "8px 16px",
                                    cursor: "pointer"
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeMigration}
                                disabled={isLoading}
                                style={{
                                    background: "#dc2626",
                                    color: "white",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "8px 16px",
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                    opacity: isLoading ? 0.6 : 1
                                }}
                            >
                                {isLoading ? "Migrating..." : "Yes, Migrate Games"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
