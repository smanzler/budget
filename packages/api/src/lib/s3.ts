import { env } from "../env";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: env.BUCKET_REGION,
  // Presigning has no body to read, so the SDK would sign the checksum of an
  // empty one and the bucket would then reject the real bytes.
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: env.BUCKET_ACCESS_KEY_ID,
    secretAccessKey: env.BUCKET_SECRET_KEY,
  },
  // An S3-compatible service — the local mock included — answers on its own
  // endpoint and takes the bucket from the path, not the host. Without this the
  // presigned URLs point at AWS.
  ...(env.BUCKET_ENDPOINT && {
    endpoint: env.BUCKET_ENDPOINT,
    forcePathStyle: true,
  }),
});

const UPLOAD_URL_TTL_SECONDS = 60 * 5;

/**
 * Presigned PUT URL — the client uploads straight to the bucket so file bytes
 * never pass through the API.
 */
export const createUploadUrl = async ({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
}) => {
  const command = new PutObjectCommand({
    Bucket: env.BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
};

/**
 * Byte size of the object, or undefined when the object is not in the bucket.
 * Use it to verify the client completed the upload before you trust the key.
 */
export const objectSize = async (key: string) => {
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: env.BUCKET_NAME, Key: key }),
    );
    return head.ContentLength;
  } catch {
    return undefined;
  }
};

export const deleteObject = async (key: string) => {
  await s3.send(new DeleteObjectCommand({ Bucket: env.BUCKET_NAME, Key: key }));
};

export const publicUrl = (key: string) => `${env.BUCKET_URL}/${key}`;
