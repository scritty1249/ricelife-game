import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// The SDK automatically looks up process.env.AWS_ROLE_ARN and logs into AWS securely
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const NOTFOUND_ERROR = "NotFound";

export async function downloadUrl (pathname, ttlseconds = 60) {
    const fileKey = sanitizePath(pathname);
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: fileKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: ttlseconds });
}

export async function uploadUrl (pathname, ttlseconds = 60, dropafterseconds = undefined) {
    const fileKey = sanitizePath(pathname);
    const command = {
        Bucket: process.env.AWS_BUCKET,
        Key: fileKey,
    };
    if (dropafterseconds) {
        command.autoDropDate = new Date();
        command.autoDropDate.setTime(autoDropDate.getTime() + (dropafterseconds * 1000));
    }
    return await getSignedUrl(s3Client, new PutObjectCommand(command), { expiresIn: ttlseconds });
}

export async function remove (pathname) {
    try {
        const fileKey = sanitizePath(pathname);
        const response = await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: fileKey
        }));
        return response;
    } catch (error) {
        return null;
    }
}

export async function copy (sourcepath, targetpath) {
    try {
        const sourceKey = sanitizePath(sourcepath);
        const targetKey = sanitizePath(targetpath);
        const response = await s3Client.send(new CopyObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            CopySource: `${process.env.AWS_BUCKET}/${sourceKey}`,
            Key: targetKey,
            MetadataDirective: "REPLACE" // gets rid of the Expires tag, if one exists
        }));
        return response;
    } catch (error) {
        return (error.name === NOTFOUND_ERROR || error.$metadata?.httpStatusCode === 404)
            ? false
            : null;
    }
}

export async function exists (pathname) {
    try {
        const fileKey = sanitizePath(pathname);
        await s3Client.send(new HeadObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: fileKey
        }));
        return true;
    } catch (error) {
        if (error.name === NOTFOUND_ERROR || error.$metadata?.httpStatusCode === 404)
            return false;
    }
}

function sanitizePath (pathname) {
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
}