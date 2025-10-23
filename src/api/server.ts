// Express server with API endpoints

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import type { RenderRequest, RenderResponse, RenderStatusResponse, RenderJob } from '../lib/types/index.js';
import { saveJob, getJob } from '../lib/storage.js';
import { processRenderJob } from '../workers/orchestrator.js';

const logger = createLogger('api');
const app = express();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// POST /render - Create a new render job
app.post('/render', async (req, res) => {
  try {
    const request: RenderRequest = {
      job_id: req.body.job_id,
      company: req.body.company,
      job_description: req.body.job_description,
      brand: req.body.brand,
      locale: req.body.locale || 'en-US',
      duration_s: req.body.duration_s || config.defaults.duration_s,
      engine: req.body.engine || 'veo3', // Default to Veo 3.1 (Google Gemini)
      scenes: req.body.scenes || config.defaults.scenes,
    };

    // Validate required fields
    if (!request.company || !request.job_description || !request.brand) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const render_id = `r_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    const job: RenderJob = {
      render_id,
      request,
      status: 'QUEUED',
      created_at: new Date(),
      updated_at: new Date(),
      debug: {
        cost_cents: 0,
        latency_s: 0,
        steps: [],
      },
    };

    saveJob(job);
    logger.info('Render job created', { render_id, company: request.company });

    // Process job asynchronously
    processRenderJob(render_id).catch((error) => {
      logger.error('Failed to process render job', { render_id, error });
    });

    const response: RenderResponse = {
      render_id,
      status: 'QUEUED',
    };

    res.status(202).json(response);
  } catch (error) {
    logger.error('Failed to create render job', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /render/:id - Get render status
app.get('/render/:id', (req, res) => {
  try {
    const render_id = req.params.id;
    const job = getJob(render_id);

    if (!job) {
      return res.status(404).json({ error: 'Render job not found' });
    }

    const response: RenderStatusResponse = {
      status: job.status,
      video_url: job.final_video,
      duration_s: job.request.duration_s,
      error: job.error,
      brief: job.brief,
      script: job.script,
      shot_plan: job.shot_plan,
      debug: {
        cost_cents: job.debug.cost_cents,
        latency_s: job.debug.latency_s,
        engine: job.request.engine,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get render status', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static web UI
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: './src/web' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  console.log(`\nVideo Jobs MVP Server`);
  console.log(`====================`);
  console.log(`Web UI:  http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/health`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  POST /render       - Create render job`);
  console.log(`  GET  /render/:id   - Get render status\n`);
});

export default app;
