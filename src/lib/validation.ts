/**
 * Shared validation utilities for consistent input validation across routes
 */

export function validatePositiveInt(value: string | null | undefined, min: number = 1, max: number = 999999): number | null {
    if (!value) return null;
    
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    
    const int = Math.trunc(num);
    if (int < min || int > max) return null;
    
    return int;
}

export function validateString(value: string | null | undefined, minLength: number = 1, maxLength: number = 1000): string | null {
    if (!value) return null;
    
    const trimmed = value.trim();
    if (trimmed.length < minLength || trimmed.length > maxLength) return null;
    
    return trimmed;
}

export function validateId(value: string | null | undefined): number | null {
    if (!value) return null;
    
    // Only allow positive integers for IDs
    if (!/^\d+$/.test(value)) return null;
    
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    
    return num;
}

export function validateFileId(value: string | null | undefined): string | null {
    if (!value) return null;
    
    const trimmed = value.trim();
    // Allow alphanumeric and common safe characters for file IDs
    if (!/^[a-zA-Z0-9\-_\.]+$/.test(trimmed)) return null;
    
    if (trimmed.length < 1 || trimmed.length > 255) return null;
    
    return trimmed;
}

export function validateCSV(value: string | null | undefined): string[] {
    if (!value) return [];
    
    return value
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.length <= 100); // reasonable max length per item
}

export function sanitizeString(value: string): string {
    return value
        .trim()
        .replace(/[<>]/g, "") // Remove potential HTML tags
        .slice(0, 1000); // Limit length
}
