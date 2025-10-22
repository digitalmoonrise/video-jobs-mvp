// In-memory storage for render jobs (can be replaced with Redis/DB later)

import type { RenderJob, RenderStatus } from './types/index.js';
import { createLogger } from './logger.js';

const logger = createLogger('storage');

const jobs = new Map<string, RenderJob>();

export function saveJob(job: RenderJob): void {
  jobs.set(job.render_id, job);
  logger.debug('Job saved', { render_id: job.render_id, status: job.status });
}

export function getJob(renderId: string): RenderJob | undefined {
  return jobs.get(renderId);
}

export function updateJobStatus(renderId: string, status: RenderStatus, error?: string): void {
  const job = jobs.get(renderId);
  if (job) {
    job.status = status;
    job.updated_at = new Date();
    if (error) {
      job.error = error;
    }
    jobs.set(renderId, job);
    logger.info('Job status updated', { render_id: renderId, status, error });
  }
}

export function getAllJobs(): RenderJob[] {
  return Array.from(jobs.values());
}
