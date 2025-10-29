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

// Helper function to convert hex color to ASS color format
function hexToAssColor(hex: string, alpha: string = 'AA'): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // ASS format is &HAABBGGRR& (alpha, blue, green, red - reversed from hex RGB)
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  
  return `&H${alpha}${b}${g}${r}&`;
}

async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const duration = parseFloat(stdout.trim());
    logger.debug('Got video duration', { filePath, duration });
    return duration;
  } catch (error) {
    logger.error('Failed to get video duration', { filePath, error });
    throw error;
  }
}

export async function concatenateScenes(
  sceneFiles: string[],
  renderId: string
): Promise<string> {
  logger.info('Concatenating scenes', { renderId, sceneCount: sceneFiles.length });

  const outputPath = path.join(config.paths.tmp, `${renderId}_concat.mp4`);

  try {
    // Use all Veo3-generated scenes
    const scenesToUse = sceneFiles;
    logger.info('Concatenating all Veo3 scenes', {
      renderId,
      sceneCount: scenesToUse.length
    });

    // Normalize all scenes to same fps and resolution, PRESERVING AUDIO
    const normalizedFiles: string[] = [];

    for (let i = 0; i < scenesToUse.length; i++) {
      const normalized = path.join(config.paths.tmp, `${renderId}_scene${i}_norm.mp4`);
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
  renderId: string,
  salesPitchSegments?: string[]
): Promise<string> {
  logger.info('Adding overlays', { renderId, usingSalesPitch: !!salesPitchSegments });

  const outputPath = path.join(config.paths.tmp, `${renderId}_overlays.mp4`);

  try {
    // Generate ASS subtitle file for overlays
    const assPath = await generateSubtitles(script, brand, renderId, salesPitchSegments);

    // Burn in subtitles (use absolute path)
    const absAssPath = path.resolve(assPath);
    
    // Convert brand color to ASS format for background
    const brandBackColor = hexToAssColor(brand.primary_hex, 'DD'); // DD = ~85% opacity
    
    // TikTok-style overlay: Large bold text, top-center positioning, brand color background
    const cmd = `ffmpeg -y -i "${videoPath}" -vf "subtitles='${absAssPath}':force_style='Fontsize=100,Bold=-1,BorderStyle=4,Outline=7,Shadow=2,Alignment=8,MarginV=250,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BackColour=${brandBackColor}'" -c:a copy "${outputPath}"`;

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
  renderId: string,
  salesPitchSegments?: string[]
): Promise<string> {
  const assPath = path.join(config.paths.tmp, `${renderId}_overlays.ass`);

  // Get scene count from script beats or sales pitch segments
  const scene_count = salesPitchSegments ? salesPitchSegments.length : script.beats.length;

  // Read actual durations of normalized scene files
  const sceneDurations: number[] = [];
  for (let i = 0; i < scene_count; i++) {
    const normalizedPath = path.join(config.paths.tmp, `${renderId}_scene${i}_norm.mp4`);
    const duration = await getVideoDuration(normalizedPath);
    sceneDurations.push(duration);
  }

  // Calculate cumulative timestamps
  const timestamps: Array<{ start: number; end: number }> = [];
  let cumulative = 0;
  for (let i = 0; i < scene_count; i++) {
    timestamps.push({
      start: cumulative,
      end: cumulative + sceneDurations[i],
    });
    cumulative += sceneDurations[i];
  }

  // Helper to format seconds as ASS timestamp (H:MM:SS.SS)
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(2);
    return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(5, '0')}`;
  };

  // Generate dialogue lines for each scene
  // Use sales pitch segments if provided, otherwise use beat-based overlays
  const dialogueLines = (salesPitchSegments || script.beats).map((text, index) => {
    // If using sales pitch, use it directly; otherwise use on_screen_text or beat
    const overlayText = salesPitchSegments ? text : (script.on_screen_text[index] || text);
    const start = formatTime(timestamps[index].start);
    const end = formatTime(timestamps[index].end);
    return `Dialogue: 0,${start},${end},LT,,0,0,0,,${overlayText}`;
  }).join('\n');

  // Convert brand color to ASS format
  const brandBackColor = hexToAssColor(brand.primary_hex, 'DD');

  // TikTok-style ASS subtitle format:
  // Style format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, 
  //               Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, 
  //               BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
  const assContent = `[Script Info]
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Style: LT,Inter,100,&H00FFFFFF,&H000000FF,&H00000000,${brandBackColor},-1,0,0,0,100,100,0,0,4,7,2,8,40,40,250,1

[Events]
${dialogueLines}
`;

  await writeFile(assPath, assContent);
  logger.info('Subtitles generated with actual timings', {
    renderId,
    assPath,
    scene_count,
    total_duration: cumulative,
  });

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
