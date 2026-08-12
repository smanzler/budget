import { env } from "../env";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: env.BUCKET_REGION,
  credentials: {
    accessKeyId: env.BUCKET_ACCESS_KEY_ID,
    secretAccessKey: env.BUCKET_SECRET_KEY,
  },
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

/** Verify the client actually completed the upload before trusting the key. */
export const objectExists = async (key: string) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
};

export const publicUrl = (key: string) => `${env.BUCKET_URL}/${key}`;
