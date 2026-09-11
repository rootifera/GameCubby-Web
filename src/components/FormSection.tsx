import type { ReactNode } from "react";

export default function FormSection({ title, description, children }: {
    title: string; description: string; children: ReactNode;
}) {
    return <section className="gc-form-section">
        <header><h2>{title}</h2><p>{description}</p></header>
        <div className="gc-form-section-fields">{children}</div>
    </section>;
}
