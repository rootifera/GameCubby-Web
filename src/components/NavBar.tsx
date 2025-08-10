"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";

type NavItemProps = { href: Route; label: string };

function NavItem({ href, label }: NavItemProps) {
    const pathname = usePathname() || "/";
    const [hovered, setHovered] = useState(false);
    const [pressed, setPressed] = useState(false);
    const [focused, setFocused] = useState(false);

    const isActive =
        href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);

    const style: React.CSSProperties = {
        color: isActive ? "#fff" : "#d8d8d8",
        textDecoration: "none",
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${isActive ? "#3b82f6" : hovered ? "#2b2b2b" : "transparent"}`,
        background: isActive ? "#162235" : hovered ? "#151515" : "transparent",
        transition:
            "transform 80ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease",
        transform: pressed ? "translateY(1px) scale(0.98)" : "none",
        boxShadow: focused ? "0 0 0 2px rgba(59,130,246,0.35)" : "none",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1
    };

    return (
        <Link
            href={href}
            aria-current={isActive ? "page" : undefined}
            style={style}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
                setHovered(false);
                setPressed(false);
            }}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
        >
            {label}
        </Link>
    );
}

export default function NavBar() {
    // Explicitly type as Route to satisfy typedRoutes
    const links: Array<{ href: Route; label: string }> = [
        { href: "/" as Route, label: "Home" },
        { href: "/games" as Route, label: "Games" },
        { href: "/search" as Route, label: "Search" },
        { href: "/admin" as Route, label: "Admin" }
    ];

    return (
        <div style={{ display: "flex", gap: 12, marginLeft: 12 }}>
            {links.map((l) => (
                <NavItem key={l.href} href={l.href} label={l.label} />
            ))}
        </div>
    );
}
