"use client";

import { useEffect } from "react";

/** Shows the S3 credential fields only while S3 is chosen for files or backups (was an inline script). */
export default function SetupS3Toggle() {
    useEffect(() => {
        const fileSelect = document.getElementById("file-storage-backend") as HTMLSelectElement | null;
        const backupSelect = document.getElementById("backup-storage-backend") as HTMLSelectElement | null;
        const credentials = document.getElementById("s3-credentials");
        const update = () => {
            if (!credentials) return;
            const needsS3 = fileSelect?.value === "s3" || backupSelect?.value === "s3";
            credentials.style.display = needsS3 ? "block" : "none";
        };
        fileSelect?.addEventListener("change", update);
        backupSelect?.addEventListener("change", update);
        update();
        return () => {
            fileSelect?.removeEventListener("change", update);
            backupSelect?.removeEventListener("change", update);
        };
    }, []);
    return null;
}
