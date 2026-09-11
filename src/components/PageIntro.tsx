import type { ReactNode } from "react";

export default function PageIntro({ eyebrow, title, description, children }: {
    eyebrow: string; title: string; description: string; children?: ReactNode;
}) {
    return <header className="gc-page-intro">
        <div><span className="gc-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
        {children && <div className="gc-intro-actions">{children}</div>}
    </header>;
}
