// Orchestrator worker - coordinates the entire video generation pipeline

import { mkdir } from 'fs/promises';
import path from 'path';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { getJob, updateJobStatus, saveJob } from '../lib/storage.js';
import { parseJobDescription } from './parse_llm.js';
import { generateScript, makeShotPlan } from './script_llm.js';
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

    // Step 2: Generate script and shot plan
    logger.info('Step 2: Generating script', { renderId });
    const scriptStart = Date.now();
    const script = await generateScript(
      brief,
      job.request.brand.tone,
      job.request.duration_s || config.defaults.duration_s
    );
    job.script = script;

    const shotPlan = makeShotPlan(
      script,
      job.request.duration_s || config.defaults.duration_s,
      job.request.brand.tone
    );
    job.shot_plan = shotPlan;
    job.debug.steps.push({
      step: 'script',
      duration_ms: Date.now() - scriptStart,
      timestamp: new Date(),
    });
    saveJob(job);

    // Step 3: Generate scene videos
    logger.info('Step 3: Generating scenes', { renderId, sceneCount: shotPlan.scenes.length });
    const genStart = Date.now();
    const sceneFiles: string[] = [];

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

    // Step 4: Compose video
    logger.info('Step 4: Composing video', { renderId });
    const composeStart = Date.now();

    // Concatenate scenes
    const concatenated = await concatenateScenes(sceneFiles, renderId);

    // Add overlays
    const withOverlays = await addOverlays(
      concatenated,
      script,
      job.request.brand,
      renderId
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

    // Step 5: QC checks
    logger.info('Step 5: Performing QC checks', { renderId });
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

    // Step 6: Upload to S3 (or store locally for MVP)
    logger.info('Step 6: Storing final video', { renderId });
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
