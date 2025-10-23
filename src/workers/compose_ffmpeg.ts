// FFmpeg compositor for scene concatenation, overlays, and final composition

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import type { VideoScript, BrandConfig } from '../lib/types/index.js';

const execAsync = promisify(exec);
const logger = createLogger('compositor');

export async function concatenateScenes(
  sceneFiles: string[],
  renderId: string
): Promise<string> {
  logger.info('Concatenating scenes', { renderId, sceneCount: sceneFiles.length });

  const outputPath = path.join(config.paths.tmp, `${renderId}_concat.mp4`);

  try {
    // Skip scene0 - only use Veo3-generated scenes (scene1 and scene2)
    const scenesToUse = sceneFiles.slice(1); // Skip first scene (scene0)
    logger.info('Skipping scene0, using only Veo3 scenes', {
      renderId,
      originalCount: sceneFiles.length,
      usedCount: scenesToUse.length
    });

    // Normalize all scenes to same fps and resolution, PRESERVING AUDIO
    const normalizedFiles: string[] = [];

    for (let i = 0; i < scenesToUse.length; i++) {
      const normalized = path.join(config.paths.tmp, `${renderId}_scene${i+1}_norm.mp4`);
      // IMPORTANT: Added -c:a aac to preserve audio from Veo3 videos
      const cmd = `ffmpeg -y -i "${scenesToUse[i]}" -r 30 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -c:v libx264 -c:a aac -b:a 192k -preset veryfast -crf 23 -pix_fmt yuv420p "${normalized}"`;
      await execAsync(cmd);
      normalizedFiles.push(normalized);
    }

    // Create concat file with absolute paths
    const concatFile = path.join(config.paths.tmp, `${renderId}_concat.txt`);
    const concatContent = normalizedFiles.map(f => `file '${path.resolve(f)}'`).join('\n');
    await writeFile(concatFile, concatContent);

    // Concatenate
    const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${outputPath}"`;
    await execAsync(concatCmd);

    logger.info('Scenes concatenated successfully', { renderId, outputPath });
    return outputPath;
  } catch (error) {
    logger.error('Failed to concatenate scenes', { renderId, error });
    throw error;
  }
}

export async function addOverlays(
  videoPath: string,
  script: VideoScript,
  brand: BrandConfig,
  renderId: string
): Promise<string> {
  logger.info('Adding overlays', { renderId });

  const outputPath = path.join(config.paths.tmp, `${renderId}_overlays.mp4`);

  try {
    // Generate ASS subtitle file for overlays
    const assPath = await generateSubtitles(script, brand, renderId);

    // Burn in subtitles (use absolute path)
    const absAssPath = path.resolve(assPath);
    const cmd = `ffmpeg -y -i "${videoPath}" -vf "subtitles='${absAssPath}':force_style='Fontsize=42,BorderStyle=3,Outline=2,Shadow=0,PrimaryColour=&HFFFFFF&,BackColour=&H55000000&'" -c:a copy "${outputPath}"`;

    await execAsync(cmd);

    logger.info('Overlays added successfully', { renderId, outputPath });
    return outputPath;
  } catch (error) {
    logger.error('Failed to add overlays', { renderId, error });
    throw error;
  }
}

async function generateSubtitles(
  script: VideoScript,
  brand: BrandConfig,
  renderId: string
): Promise<string> {
  const assPath = path.join(config.paths.tmp, `${renderId}_overlays.ass`);

  // Since we're using only 2 scenes (skipping scene0), adjust timing
  // We'll use a shorter estimated duration based on 2 scenes instead of 3
  const actualDuration = Math.floor(script.estimated_duration_s * (2 / 3));
  const segmentDuration = Math.floor(actualDuration / 2);

  // Generate ASS subtitle content
  // Skip scene0's text, show only scene1 and scene2 text
  const assContent = `[Script Info]
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Style: LT,Inter,42,&H00FFFFFF,&H00000000,&HAA000000,&HAA000000,0,0,0,0,100,100,0,0,3,2,2,2,10,10,20,1

[Events]
Dialogue: 0,0:00:00.00,0:00:0${segmentDuration}.00,LT,,0,0,0,,${script.on_screen_text[1] || script.beats[1]}
Dialogue: 0,0:00:0${segmentDuration}.00,0:00:${actualDuration}.00,LT,,0,0,0,,${script.on_screen_text[2] || script.cta}
`;

  await writeFile(assPath, assContent);
  logger.info('Subtitles generated', { renderId, assPath });

  return assPath;
}

export async function appendEndCard(
  videoPath: string,
  brand: BrandConfig,
  ctaUrl: string | null,
  renderId: string
): Promise<string> {
  logger.info('Appending end card', { renderId });

  const outputPath = path.join(config.paths.tmp, `${renderId}_final.mp4`);

  try {
    // Generate end card image
    const endCardPath = await generateEndCard(brand, ctaUrl, renderId);

    // Create 2-second video from end card image with silent audio track
    // (so it matches the audio streams from the main video during concatenation)
    const endCardVideo = path.join(config.paths.tmp, `${renderId}_endcard.mp4`);
    const createEndCardCmd = `ffmpeg -y -loop 1 -t 2 -i "${endCardPath}" -f lavfi -t 2 -i anullsrc=r=48000:cl=stereo -r 30 -vf "scale=1080:1920" -c:v libx264 -c:a aac -b:a 192k -preset veryfast -crf 23 -pix_fmt yuv420p -shortest "${endCardVideo}"`;
    await execAsync(createEndCardCmd);

    // Create concat file with absolute paths
    const concatFile = path.join(config.paths.tmp, `${renderId}_final_concat.txt`);
    await writeFile(concatFile, `file '${path.resolve(videoPath)}'\nfile '${path.resolve(endCardVideo)}'`);

    // Concatenate main video with end card
    const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${outputPath}"`;
    await execAsync(concatCmd);

    logger.info('End card appended successfully', { renderId, outputPath });
    return outputPath;
  } catch (error) {
    logger.error('Failed to append end card', { renderId, error });
    throw error;
  }
}

async function generateEndCard(
  brand: BrandConfig,
  ctaUrl: string | null,
  renderId: string
): Promise<string> {
  const imagePath = path.join(config.paths.tmp, `${renderId}_endcard.png`);

  // Escape special characters in text for FFmpeg drawtext filter
  // Replace : and / and other special chars
  const urlText = (ctaUrl || 'Visit our careers page')
    .replace(/:/g, '\\:')
    .replace(/\//g, '\\/')
    .replace(/'/g, "\\'");

  // Generate simple end card using FFmpeg
  // For MVP, create a solid color background with text
  const cmd = `ffmpeg -y -f lavfi -i "color=c=${brand.primary_hex}:s=1080x1920:d=1" \
    -vf "drawtext=text='Apply Now':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-100,\
         drawtext=text='${urlText}':fontsize=30:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+100" \
    -frames:v 1 "${imagePath}"`;

  await execAsync(cmd);

  logger.info('End card generated', { renderId, imagePath });
  return imagePath;
}
