// Orchestrator worker - coordinates the entire video generation pipeline

import { mkdir, readdir } from 'fs/promises';
import path from 'path';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { getJob, updateJobStatus, saveJob } from '../lib/storage.js';
import { parseJobDescription } from './parse_llm.js';
import { generateScript, generateShotPlan } from './script_llm.js';
import { generateSalesPitch } from './sales_pitch_llm.js';
import { generateScene } from './generators.js';
import { concatenateScenes, addOverlays, appendEndCard } from './compose_ffmpeg.js';
import { performQC } from '../lib/qc/index.js';
import { uploadFile, getSignedDownloadUrl } from '../lib/s3.js';

const logger = createLogger('orchestrator');

export async function processRenderJob(renderId: string): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('Processing render job', { renderId });

    // Ensure tmp directory exists
    await mkdir(config.paths.tmp, { recursive: true });
    await mkdir(config.paths.renders, { recursive: true });

    const job = getJob(renderId);
    if (!job) {
      throw new Error('Job not found');
    }

    updateJobStatus(renderId, 'RUNNING');

    // Step 1: Parse job description
    logger.info('Step 1: Parsing job description', { renderId });
    const parseStart = Date.now();
    const brief = await parseJobDescription(
      job.request.job_description,
      job.request.locale || 'en-US'
    );
    job.brief = brief;
    job.debug.steps.push({
      step: 'parse',
      duration_ms: Date.now() - parseStart,
      timestamp: new Date(),
    });
    saveJob(job);

    // Step 2: Generate sales pitch
    logger.info('Step 2: Generating sales pitch', { renderId });
    const salesPitchStart = Date.now();
    const scene_count = job.request.scene_count || 1;
    const salesPitchResult = await generateSalesPitch(brief, scene_count);
    job.sales_pitch = salesPitchResult.segments;
    job.debug.steps.push({
      step: 'sales_pitch',
      duration_ms: Date.now() - salesPitchStart,
      timestamp: new Date(),
    });
    saveJob(job);

    // Step 3: Generate script and shot plan
    logger.info('Step 3: Generating script', { renderId });
    const scriptStart = Date.now();
    const duration_s = job.request.duration_s || config.defaults.duration_s;

    const script = await generateScript(
      brief,
      job.request.brand.tone,
      duration_s,
      scene_count
    );
    job.script = script;

    const shotPlan = await generateShotPlan(
      script,
      brief,
      duration_s,
      job.request.brand.tone,
      scene_count
    );
    job.shot_plan = shotPlan;
    job.debug.steps.push({
      step: 'script',
      duration_ms: Date.now() - scriptStart,
      timestamp: new Date(),
    });
    saveJob(job);

    // Step 4: Generate scene videos (or use existing if overlay_only mode)
    let sceneFiles: string[] = [];
    
    if (job.request.overlay_only) {
      logger.info('Step 4: Overlay-only mode - finding existing videos', { renderId, sceneCount: scene_count });
      const genStart = Date.now();
      
      sceneFiles = await findExistingSceneVideos(scene_count, renderId);
      
      job.scene_files = sceneFiles;
      job.debug.steps.push({
        step: 'find_existing',
        duration_ms: Date.now() - genStart,
        timestamp: new Date(),
      });
      saveJob(job);
    } else {
      logger.info('Step 4: Generating scenes', { renderId, sceneCount: shotPlan.scenes.length });
      const genStart = Date.now();

      for (let i = 0; i < shotPlan.scenes.length; i++) {
        const scene = shotPlan.scenes[i];
        const sceneFile = await generateScene(
          job.request.engine || 'template',
          scene,
          renderId,
          i
        );
        sceneFiles.push(sceneFile);
      }

      job.scene_files = sceneFiles;
      job.debug.steps.push({
        step: 'generate',
        duration_ms: Date.now() - genStart,
        timestamp: new Date(),
      });
      saveJob(job);
    }

    // Step 5: Compose video
    logger.info('Step 5: Composing video', { renderId });
    const composeStart = Date.now();

    // Concatenate scenes
    const concatenated = await concatenateScenes(sceneFiles, renderId);

    // Add overlays (use sales pitch if available)
    const withOverlays = await addOverlays(
      concatenated,
      script,
      job.request.brand,
      renderId,
      job.sales_pitch
    );

    // Append end card
    const finalVideo = await appendEndCard(
      withOverlays,
      job.request.brand,
      script.cta_url,
      renderId
    );

    job.debug.steps.push({
      step: 'compose',
      duration_ms: Date.now() - composeStart,
      timestamp: new Date(),
    });

    // Step 6: QC checks
    logger.info('Step 6: Performing QC checks', { renderId });
    const qcStart = Date.now();
    const qcResult = await performQC(
      finalVideo,
      job.request.duration_s || config.defaults.duration_s
    );

    if (!qcResult.passed) {
      logger.warn('QC checks failed', { renderId, issues: qcResult.issues });
      // For MVP, continue anyway but log the issues
    }

    job.debug.steps.push({
      step: 'qc',
      duration_ms: Date.now() - qcStart,
      timestamp: new Date(),
    });

    // Step 7: Upload to S3 (or store locally for MVP)
    logger.info('Step 7: Storing final video', { renderId });
    const uploadStart = Date.now();

    // For MVP, we can skip S3 upload if credentials not configured
    // and just store locally with a file:// URL
    let videoUrl: string;

    if (config.s3.accessKeyId && config.s3.secretAccessKey) {
      try {
        const s3Key = `renders/${renderId}/final.mp4`;
        await uploadFile(finalVideo, s3Key);
        videoUrl = await getSignedDownloadUrl(s3Key);
      } catch (error) {
        logger.warn('S3 upload failed, using local path', { error });
        videoUrl = `file://${finalVideo}`;
      }
    } else {
      // Store locally
      videoUrl = `file://${finalVideo}`;
    }

    job.final_video = videoUrl;
    job.debug.steps.push({
      step: 'upload',
      duration_ms: Date.now() - uploadStart,
      timestamp: new Date(),
    });

    // Update job with final status
    const totalDuration = Date.now() - startTime;
    job.debug.latency_s = Math.round(totalDuration / 1000);
    job.debug.cost_cents = estimateCost(job.request.engine || 'template', shotPlan.scenes.length);

    updateJobStatus(renderId, 'READY');
    saveJob(job);

    logger.info('Render job completed successfully', {
      renderId,
      duration_s: job.debug.latency_s,
      video_url: videoUrl,
    });
  } catch (error) {
    logger.error('Failed to process render job', { renderId, error });
    updateJobStatus(renderId, 'ERROR', String(error));
  }
}

function estimateCost(engine: string, sceneCount: number): number {
  // Rough cost estimates in cents
  const costs = {
    template: 1, // Nearly free
    sora2: 50 * sceneCount, // $0.50 per scene
    veo3: 40 * sceneCount, // $0.40 per scene
  };

  return costs[engine as keyof typeof costs] || 1;
}

async function findExistingSceneVideos(sceneCount: number, currentRenderId: string): Promise<string[]> {
  logger.info('Scanning tmp directory for existing scene videos', { sceneCount });

  try {
    const tmpDir = config.paths.tmp;
    const files = await readdir(tmpDir);

    // Group files by render ID
    const renderGroups = new Map<string, string[]>();
    
    for (const file of files) {
      // Match pattern: r_*_scene{index}.mp4 or r_*_scene{index}_norm.mp4
      const match = file.match(/^(r_[a-f0-9]+)_scene(\d+)(?:_norm)?\.mp4$/);
      if (match) {
        const renderId = match[1];
        // Skip the current render ID
        if (renderId === currentRenderId) continue;
        
        if (!renderGroups.has(renderId)) {
          renderGroups.set(renderId, []);
        }
        renderGroups.get(renderId)!.push(file);
      }
    }

    // Sort render groups by file modification time (most recent first)
    const sortedRenderIds = Array.from(renderGroups.keys()).sort((a, b) => {
      // Use the first file from each group to compare
      const fileA = renderGroups.get(a)![0];
      const fileB = renderGroups.get(b)![0];
      return fileB.localeCompare(fileA); // Reverse alphabetical for recency
    });

    // Try to find a render with enough scenes
    for (const renderId of sortedRenderIds) {
      const sceneFiles: string[] = [];
      let foundAll = true;

      for (let i = 0; i < sceneCount; i++) {
        // Prefer normalized files, fall back to regular scene files
        const normalizedFile = `${renderId}_scene${i}_norm.mp4`;
        const regularFile = `${renderId}_scene${i}.mp4`;
        
        if (files.includes(normalizedFile)) {
          sceneFiles.push(path.join(tmpDir, normalizedFile));
        } else if (files.includes(regularFile)) {
          sceneFiles.push(path.join(tmpDir, regularFile));
        } else {
          foundAll = false;
          break;
        }
      }

      if (foundAll) {
        logger.info('Found existing scene videos', { 
          sourceRenderId: renderId, 
          sceneFiles: sceneFiles.map(f => path.basename(f))
        });
        return sceneFiles;
      }
    }

    // If we get here, we didn't find enough existing videos
    throw new Error(`Could not find ${sceneCount} existing scene videos in tmp directory. Please generate videos first or use a different engine.`);
  } catch (error) {
    logger.error('Failed to find existing scene videos', { error });
    throw error;
  }
}
