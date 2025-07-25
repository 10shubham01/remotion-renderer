import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

const s3 = new S3Client({});

export async function uploadToS3(bucket: string, key: string, filePath: string, region: string): Promise<string> {
  const fileStream = fs.createReadStream(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ContentType: "video/mp4",
    })
  );
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
} 