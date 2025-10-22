// Quality control checks for generated videos

import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../logger.js';

const execAsync = promisify(exec);
const logger = createLogger('qc');

export interface QCResult {
  passed: boolean;
  issues: string[];
  metrics: {
    duration_s?: number;
    resolution?: string;
    fps?: number;
    audio_present?: boolean;
  };
}

export async function performQC(videoPath: string, expectedDuration: number): Promise<QCResult> {
  logger.info('Performing QC checks', { videoPath });

  const issues: string[] = [];
  const metrics: QCResult['metrics'] = {};

  try {
    // Get video metadata using ffprobe
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate,codec_type -of json "${videoPath}"`
    );

    const metadata = JSON.parse(stdout);

    // Extract metrics
    const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
    const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');

    if (videoStream) {
      metrics.resolution = `${videoStream.width}x${videoStream.height}`;
      const [num, den] = videoStream.r_frame_rate.split('/');
      metrics.fps = Math.round(parseInt(num) / parseInt(den));
    }

    if (metadata.format) {
      metrics.duration_s = parseFloat(metadata.format.duration);
    }

    metrics.audio_present = !!audioStream;

    // Check duration (±1s tolerance)
    if (metrics.duration_s) {
      const durationDiff = Math.abs(metrics.duration_s - expectedDuration);
      if (durationDiff > 1) {
        issues.push(`Duration mismatch: expected ${expectedDuration}s, got ${metrics.duration_s}s`);
      }
    }

    // Check resolution
    if (metrics.resolution !== '1080x1920') {
      issues.push(`Resolution mismatch: expected 1080x1920, got ${metrics.resolution}`);
    }

    // Check FPS
    if (metrics.fps && metrics.fps < 24) {
      issues.push(`Low FPS: ${metrics.fps}`);
    }

    logger.info('QC checks completed', { passed: issues.length === 0, issues: issues.length });

    return {
      passed: issues.length === 0,
      issues,
      metrics,
    };
  } catch (error) {
    logger.error('QC check failed', { error });
    return {
      passed: false,
      issues: ['Failed to perform QC checks'],
      metrics,
    };
  }
}

export function checkColorContrast(primaryHex: string, secondaryHex: string): boolean {
  // Simple contrast check - convert hex to luminance and check ratio
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = (rgb & 0xff) / 255;

    const [rs, gs, bs] = [r, g, b].map(c =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(primaryHex);
  const l2 = getLuminance(secondaryHex);

  const ratio = l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);

  // WCAG AA requires 4.5:1 for normal text
  return ratio >= 4.5;
}
