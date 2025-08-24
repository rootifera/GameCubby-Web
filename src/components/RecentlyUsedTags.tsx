"use client";

import { useEffect, useState } from "react";

type RecentlyUsedTagsProps = {
    onTagClick: (tagName: string) => void;
    maxTags?: number;
};

export default function RecentlyUsedTags({ onTagClick, maxTags = 5 }: RecentlyUsedTagsProps) {
    const [recentTags, setRecentTags] = useState<string[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    // Load recent tags from localStorage on component mount and when storage changes
    useEffect(() => {
        const loadTags = () => {
            try {
                const stored = localStorage.getItem('gamecubby_recent_tags');
                if (stored) {
                    const parsed = JSON.parse(stored) as string[];
                    if (Array.isArray(parsed)) {
                        setRecentTags(parsed.slice(0, maxTags));
                    }
                }
            } catch (error) {
                console.warn('Failed to load recent tags from localStorage:', error);
            }
        };

        loadTags();

        // Listen for storage changes from other tabs/windows
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'gamecubby_recent_tags') {
                loadTags();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [maxTags, refreshKey]);

    // Function to add a new tag to recent tags
    const addToRecentTags = (tagName: string) => {
        const trimmed = tagName.trim();
        if (trimmed.length < 2) return;

        setRecentTags(prev => {
            // Remove the tag if it already exists
            const filtered = prev.filter(tag => tag.toLowerCase() !== trimmed.toLowerCase());
            // Add the new tag at the beginning
            const newTags = [trimmed, ...filtered].slice(0, maxTags);
            
            // Save to localStorage
            try {
                localStorage.setItem('gamecubby_recent_tags', JSON.stringify(newTags));
            } catch (error) {
                console.warn('Failed to save recent tags to localStorage:', error);
            }
            
            return newTags;
        });
        
        // Trigger refresh to ensure other instances update
        setRefreshKey(prev => prev + 1);
    };

    // Handle tag click
    const handleTagClick = (tagName: string) => {
        onTagClick(tagName);
        addToRecentTags(tagName);
    };

    // If no recent tags, don't render anything
    if (recentTags.length === 0) {
        return null;
    }

    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ 
                fontSize: 12, 
                opacity: 0.7, 
                marginBottom: 6,
                color: '#a0a0a0'
            }}>
                Recently used tags:
            </div>
            <div style={{ 
                display: 'flex', 
                gap: 6, 
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                {recentTags.map((tag, index) => (
                    <button
                        key={`${tag}-${index}`}
                        type="button"
                        onClick={() => handleTagClick(tag)}
                        style={{
                            background: '#2d3748',
                            color: '#e2e8f0',
                            border: '1px solid #4a5568',
                            borderRadius: '16px',
                            padding: '4px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#4a5568';
                            e.currentTarget.style.borderColor = '#718096';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#2d3748';
                            e.currentTarget.style.borderColor = '#4a5568';
                        }}
                        title={`Click to add "${tag}"`}
                    >
                        {tag}
                    </button>
                ))}
            </div>
        </div>
    );
}
