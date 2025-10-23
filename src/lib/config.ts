import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  sora2: {
    apiKey: process.env.SORA2_API_KEY || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    apiBase: process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta',
  },
  tts: {
    apiKey: process.env.TTS_API_KEY || '',
  },
  s3: {
    bucket: process.env.S3_BUCKET || 'video-jobs-mvp',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  defaults: {
    tone: process.env.DEFAULT_TONE || 'aspirational',
    duration_s: parseInt(process.env.DEFAULT_DURATION_S || '21', 10),
    scenes: parseInt(process.env.DEFAULT_SCENES || '3', 10),
    fps: parseInt(process.env.DEFAULT_FPS || '30', 10),
    resolution: process.env.DEFAULT_RES || '1080x1920',
  },
  paths: {
    tmp: './tmp',
    renders: './renders',
  },
};
