"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

type MenuItem = { label: string; href: string };
type MenuGroup = {
    section: string;
    items: MenuItem[];
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
        items: [{ label: "File Manager", href: "/admin/files/manager" }],
    },

    {
        section: "Location Management",
        items: [{ label: "Location Manager", href: "/admin/locations/manager" }],
    },

    {
        section: "Export Data",
        items: [
            { label: "Export Game Data", href: "/admin/export/games" },

        ],
    },
    {
        section: "Database Maintenance",
        items: [
            { label: "Restore Database", href: "/admin/sentinel/restore" },
            { label: "Backup to Storage", href: "/admin/sentinel/backups" },
            { label: "Backup and Download", href: "/admin/backup/database" },
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
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={{ pathname: item.href }}
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
                <Link href={{ pathname: "/admin/logout" }} className={styles.navLink}>
                    Log out
                </Link>
            </div>
        </nav>
    );
}
