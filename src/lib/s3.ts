// S3 storage integration for video assets

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'fs';
import { config } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('s3');

const s3Client = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

export async function uploadFile(
  localPath: string,
  key: string,
  contentType: string = 'video/mp4'
): Promise<string> {
  try {
    const fileStream = createReadStream(localPath);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
      })
    );

    logger.info('File uploaded successfully', { key });
    return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
  } catch (error) {
    logger.error('Failed to upload file', { key, error });
    throw error;
  }
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    logger.info('Generated signed URL', { key, expiresIn });
    return url;
  } catch (error) {
    logger.error('Failed to generate signed URL', { key, error });
    throw error;
  }
}
