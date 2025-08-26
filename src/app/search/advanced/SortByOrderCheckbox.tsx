"use client";

import { useEffect, useState } from "react";

interface SortByOrderCheckboxProps {
    locationId?: string;
    sortByOrder: boolean;
    includeSubLocations: boolean;
}

export function SortByOrderCheckbox({ locationId, sortByOrder, includeSubLocations }: SortByOrderCheckboxProps) {
    const [hasLocation, setHasLocation] = useState(!!locationId);

    useEffect(() => {
        function updateLocationState() {
            const locationInput = document.querySelector('input[name="location_id"]') as HTMLInputElement;
            if (locationInput) {
                const hasValue = Boolean(locationInput.value && locationInput.value.trim() !== '');
                setHasLocation(hasValue);
            }
        }

        // Initial state
        updateLocationState();

        // Watch for changes to the hidden input
        const locationInput = document.querySelector('input[name="location_id"]');
        let observer: MutationObserver | null = null;
        if (locationInput) {
            observer = new MutationObserver(updateLocationState);
            observer.observe(locationInput, { 
                attributes: true, 
                attributeFilter: ['value'] 
            });

            // Also listen for input events
            locationInput.addEventListener('input', updateLocationState);
        }

        // Listen for form changes
        const form = document.querySelector('form');
        if (form) {
            form.addEventListener('change', function(e) {
                if (e.target && (e.target as HTMLElement).getAttribute('name') === 'location_id') {
                    setTimeout(updateLocationState, 0);
                }
            });
        }

        // Cleanup
        return () => {
            if (locationInput) {
                observer?.disconnect();
                locationInput.removeEventListener('input', updateLocationState);
            }
        };
    }, []);

    return (
        <>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                    type="checkbox"
                    name="include_location_descendants"
                    value="true"
                    defaultChecked={includeSubLocations}
                    style={{
                        width: 16,
                        height: 16,
                        cursor: "pointer"
                    }}
                />
                <span style={{ opacity: 0.85, fontSize: 14 }}>Include Sub Locations</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: hasLocation ? "pointer" : "not-allowed" }}>
                <input
                    type="checkbox"
                    name="sort_by_order"
                    value="true"
                    defaultChecked={sortByOrder}
                    disabled={!hasLocation}
                    style={{
                        width: 16,
                        height: 16,
                        cursor: hasLocation ? "pointer" : "not-allowed",
                        opacity: hasLocation ? 1 : 0.5
                    }}
                />
                <span style={{ 
                    opacity: hasLocation ? 0.85 : 0.5, 
                    fontSize: 14,
                    color: hasLocation ? "inherit" : "#666"
                }}>
                    Sort by Order
                </span>
            </label>
        </>
    );
}
