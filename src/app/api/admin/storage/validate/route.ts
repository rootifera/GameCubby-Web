import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ValidationRequest = {
    bucket?: unknown;
    region?: unknown;
    endpointUrl?: unknown;
    accessKeyId?: unknown;
    secretAccessKey?: unknown;
    prefix?: unknown;
};

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function describeError(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();
    if (normalized.includes("xml parse error") || normalized.includes("mismatched tags") || normalized.includes("<!doctype")) {
        return "S3 file read/write test failed. Please check the S3 configuration.";
    }
    if (normalized.includes("not found") || normalized.includes("nosuchbucket")) {
        return "The S3 service could not find the configured bucket or endpoint. Check the bucket name and S3 endpoint URL.";
    }
    if (message) return message;
    return "The S3 service rejected the validation request.";
}

export async function POST(request: NextRequest) {
    if (!await readToken()) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    let body: ValidationRequest;
    try {
        body = await request.json() as ValidationRequest;
    } catch {
        return NextResponse.json({ detail: "Invalid S3 validation request." }, { status: 400 });
    }

    const bucket = text(body.bucket);
    const region = text(body.region) || "us-east-1";
    const endpoint = text(body.endpointUrl);
    const accessKeyId = text(body.accessKeyId);
    const secretAccessKey = text(body.secretAccessKey);
    const prefix = text(body.prefix).replace(/^\/+|\/+$/g, "");

    if (!bucket) {
        return NextResponse.json({ detail: "S3 bucket is required." }, { status: 400 });
    }
    if (endpoint) {
        try {
            new URL(endpoint);
        } catch {
            return NextResponse.json({ detail: "S3 endpoint URL must be a valid URL." }, { status: 400 });
        }
    }
    if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
        return NextResponse.json({ detail: "Both S3 access key and secret key are required together." }, { status: 400 });
    }

    const key = `${prefix ? `${prefix}/` : ""}.gamecubby-validation/${crypto.randomUUID()}.txt`;
    const client = new S3Client({
        endpoint: endpoint || undefined,
        region,
        forcePathStyle: Boolean(endpoint),
        credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });

    let written = false;
    try {
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: "GameCubby S3 storage validation",
            ContentType: "text/plain",
        }));
        written = true;

        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!object.Body) throw new Error("S3 read test returned no object body.");
        await object.Body.transformToByteArray();

        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        written = false;
        return NextResponse.json({ ok: true });
    } catch (error) {
        let detail = `S3 validation failed: ${describeError(error)}`;
        if (written) {
            try {
                await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            } catch (cleanupError) {
                detail += ` The test object could not be deleted: ${describeError(cleanupError)}`;
            }
        }
        return NextResponse.json({ detail }, { status: 422 });
    } finally {
        client.destroy();
    }
}
