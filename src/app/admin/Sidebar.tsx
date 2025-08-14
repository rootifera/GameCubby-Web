"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

type MenuGroup = {
    section: string;
    items: { label: string; href: string }[];
};

const menu: MenuGroup[] = [
    { section: "Admin Home", items: [{ label: "Overview", href: "/admin" }] },
    {
        section: "Game Management",
        items: [
            { label: "Add", href: "/admin/games/add" },
            { label: "Update", href: "/admin/games/update" },
            { label: "Delete", href: "/admin/games/delete" },
            { label: "Sync & Refresh", href: "/admin/games/sync" },
        ],
    },
    {
        section: "File Management",
        items: [
            { label: "Download", href: "/admin/files/download" },
            { label: "Upload", href: "/admin/files/upload" },
            { label: "Delete", href: "/admin/files/delete" },
            { label: "Update File Labels", href: "/admin/files/labels" },
            { label: "Sync", href: "/admin/files/sync" },
        ],
    },
    {
        section: "Location Management",
        items: [
            { label: "View", href: "/admin/locations" },
            { label: "Add", href: "/admin/locations/add" },
            { label: "Delete", href: "/admin/locations/delete" },
        ],
    },
    {
        section: "Backup & Export",
        items: [
            { label: "Export Game Data", href: "/admin/export/games" },
            { label: "Backup Database", href: "/admin/export/backup" },
        ],
    },
    {
        section: "Settings",
        items: [
            { label: "Change Password", href: "/admin/settings/password" },
            { label: "Application Settings", href: "/admin/settings/app" },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <nav>
            {menu.map((group, groupIdx) => (
                <div key={group.section} style={{ marginBottom: 8 }}>
                    <div className={styles.sectionTitle}>{group.section}</div>
                    <div className={styles.group}>
                        {group.items.map((item) => {
                            // Exact match highlight; easy to switch to "startsWith" if you prefer.
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.navLink} ${active ? styles.active : ""}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                    {groupIdx < menu.length - 1 && <div className={styles.divider} />}
                </div>
            ))}

            <div style={{ marginTop: 12 }}>
                <Link href="/admin/logout" className={styles.navLink}>
                    Log out
                </Link>
            </div>
        </nav>
    );
}
