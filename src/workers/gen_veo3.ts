// Veo 3.1 generator adapter using Google Gemini API

import { GoogleGenAI } from '@google/genai';
import { stat } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import type { Scene } from '../lib/types/index.js';

const execAsync = promisify(exec);

const logger = createLogger('veo3');

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return ai;
}

async function validateVideoFile(filePath: string): Promise<void> {
  // Check file exists and has content
  const stats = await stat(filePath);
  if (stats.size < 1000) {
    throw new Error(`Video file too small (${stats.size} bytes), likely corrupted`);
  }

  // Wait a bit to ensure file system has flushed writes
  await new Promise(r => setTimeout(r, 500));

  // Validate with ffprobe that the file is a valid MP4
  try {
    await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
    logger.info('Video file validated successfully', { filePath, size: stats.size });
  } catch (error) {
    throw new Error(`Video file validation failed: ${error}`);
  }
}

export async function generateVeoScene(
  scene: Scene,
  renderId: string,
  sceneIndex: number
): Promise<string> {
  const startTime = Date.now();

  logger.info('Generating Veo 3.1 scene', { renderId, sceneIndex, scene });

  try {
    const ai = getGeminiClient();

    // Build the prompt for Veo 3.1
    const prompt = buildVeoPrompt(scene);

    logger.info('Starting Veo 3.1 generation', { prompt });

    // Kick off video generation (long-running operation)
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt,
      config: {
        aspectRatio: '9:16', // Explicitly request vertical format
      },
    });

    logger.info('Veo operation started', { operationName: operation.name });

    // Poll until done (Gemini uses Operations for video)
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes max (10s * 60)

    while (!operation.done && pollCount < maxPolls) {
      await new Promise((r) => setTimeout(r, 10_000)); // Wait 10 seconds
      pollCount++;

      logger.info('Polling Veo operation', { pollCount, renderId, sceneIndex });

      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (!operation.done) {
      throw new Error(`Veo operation timed out after ${maxPolls} polls`);
    }

    // Check for errors in the operation
    if (operation.error) {
      throw new Error(`Veo operation failed: ${JSON.stringify(operation.error)}`);
    }

    // Download the generated video file to disk
    if (!operation.response?.generatedVideos?.[0]?.video) {
      throw new Error('No video generated in operation response');
    }

    const fileRef = operation.response.generatedVideos[0].video;
    const outPath = path.join(config.paths.tmp, `${renderId}_scene${sceneIndex}.mp4`);

    logger.info('Downloading Veo video', { fileRef, outPath });

    await ai.files.download({ file: fileRef, downloadPath: outPath });

    // Validate the downloaded file before proceeding
    await validateVideoFile(outPath);

    const duration = Date.now() - startTime;
    logger.info('Veo scene generated successfully', {
      renderId,
      sceneIndex,
      outPath,
      duration_ms: duration,
    });

    return outPath;
  } catch (error) {
    logger.error('Failed to generate Veo scene', { renderId, sceneIndex, error });
    throw error;
  }
}

function buildVeoPrompt(scene: Scene): string {
  // Build cinematic prompt based on the scene's visual metaphor
  return `Create a ${scene.len_s} second cinematic vertical video (9:16).
Scene concept: ${scene.visual_metaphor}.
Lighting: natural realistic. Camera: smooth motion, shallow depth of field.
Reserve lower 20% of frame for captions. No logos or text overlays.`;
}

export async function generateScenes(
  scenes: Scene[],
  tone: string,
  renderId: string
): Promise<string[]> {
  logger.info('Generating Veo scenes', { count: scenes.length, tone, renderId });

  const paths: string[] = [];

  // Generate scenes sequentially (could be parallelized for speed)
  for (let i = 0; i < scenes.length; i++) {
    const scenePath = await generateVeoScene(scenes[i], renderId, i);
    paths.push(scenePath);
  }

  logger.info('All Veo scenes generated', { count: paths.length, renderId });

  return paths;
}
