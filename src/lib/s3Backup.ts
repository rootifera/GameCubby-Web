import { promises as fs } from "node:fs";
import type { Readable } from "node:stream";
import {
    GetObjectCommand,
    ListObjectsV2Command,
    S3Client,
    type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export type S3BackupConfig = {
    backend: "s3";
    bucket: string;
    prefix?: string;
    endpoint_url?: string;
    region?: string;
    access_key_id?: string;
    secret_access_key?: string;
};

type MaintenanceFile = {
    backup_storage?: S3BackupConfig | { backend: "local" };
};

const MAINT_FILE = process.env.GC_MAINT_FILE || "/storage/maintenance.json";
const BACKUP_EXTENSIONS = [".dump", ".backup", ".pgc", ".pgdump", ".tar", ".pgcustom"];

export function isBackupName(name: string): boolean {
    return BACKUP_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export async function readS3BackupConfig(): Promise<S3BackupConfig | null> {
    try {
        const data = JSON.parse(await fs.readFile(MAINT_FILE, "utf8")) as MaintenanceFile;
        const config = data.backup_storage;
        return config?.backend === "s3" && config.bucket ? config : null;
    } catch {
        return null;
    }
}

export function s3Client(config: S3BackupConfig): S3Client {
    return new S3Client({
        endpoint: config.endpoint_url || undefined,
        region: config.region || "us-east-1",
        forcePathStyle: !!config.endpoint_url,
        credentials: config.access_key_id && config.secret_access_key
            ? {
                accessKeyId: config.access_key_id,
                secretAccessKey: config.secret_access_key,
            }
            : undefined,
    });
}

export function backupPrefix(config: S3BackupConfig): string {
    const root = (config.prefix || "").replace(/^\/+|\/+$/g, "");
    return root ? `${root}/backups/` : "backups/";
}

export async function listS3Backups(config: S3BackupConfig) {
    const client = s3Client(config);
    const files: Array<{
        name: string;
        relpath: string;
        abspath: string;
        uri: string;
        source: "s3";
        size: number;
        mtime: string;
    }> = [];
    let continuationToken: string | undefined;

    do {
        const page = await client.send(new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: backupPrefix(config),
            ContinuationToken: continuationToken,
        }));
        for (const object of page.Contents || []) {
            const key = object.Key;
            const name = key?.split("/").pop() || "";
            if (!key || !name || !isBackupName(name)) continue;
            const uri = `s3://${config.bucket}/${key}`;
            files.push({
                name,
                relpath: key,
                abspath: uri,
                uri,
                source: "s3",
                size: object.Size || 0,
                mtime: object.LastModified?.toISOString() || "",
            });
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);

    files.sort((a, b) => b.mtime.localeCompare(a.mtime));
    client.destroy();
    return files;
}

export function parseS3Uri(uri: string): { bucket: string; key: string } | null {
    if (!uri.startsWith("s3://")) return null;
    const withoutScheme = uri.slice(5);
    const slash = withoutScheme.indexOf("/");
    if (slash <= 0 || slash === withoutScheme.length - 1) return null;
    return { bucket: withoutScheme.slice(0, slash), key: withoutScheme.slice(slash + 1) };
}

export async function getS3BackupObject(
    config: S3BackupConfig,
    uri: string
): Promise<GetObjectCommandOutput> {
    const parsed = parseS3Uri(uri);
    if (!parsed || parsed.bucket !== config.bucket || !parsed.key.startsWith(backupPrefix(config))) {
        throw new Error("The selected S3 backup is outside the configured backup location.");
    }
    return s3Client(config).send(new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
}

export async function uploadS3Backup(
    config: S3BackupConfig,
    key: string,
    body: Readable
): Promise<string> {
    const client = s3Client(config);
    try {
        await new Upload({
            client,
            params: { Bucket: config.bucket, Key: key, Body: body },
        }).done();
        return `s3://${config.bucket}/${key}`;
    } finally {
        client.destroy();
    }
}
