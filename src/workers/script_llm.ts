// Script/Beats LLM worker - generates video scripts

import OpenAI from 'openai';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { SCRIPT_SYSTEM_PROMPT, buildScriptPrompt } from '../lib/prompts/script.js';
import type { StructuredBrief, VideoScript, ShotPlan, Scene } from '../lib/types/index.js';

const logger = createLogger('script_llm');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function generateScript(
  brief: StructuredBrief,
  tone: string,
  duration_s: number
): Promise<VideoScript> {
  const startTime = Date.now();

  try {
    logger.info('Generating video script', { tone, duration_s });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
        { role: 'user', content: buildScriptPrompt(brief, tone, duration_s) },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }

    const script: VideoScript = JSON.parse(content);

    // Validate required fields
    if (!script.hook || !script.beats || script.beats.length !== 3) {
      throw new Error('Invalid script structure');
    }

    const duration = Date.now() - startTime;
    logger.info('Script generated successfully', { duration_ms: duration });

    return script;
  } catch (error) {
    logger.error('Failed to generate script', { error });
    throw error;
  }
}

export function makeShotPlan(script: VideoScript, duration_s: number, tone: string): ShotPlan {
  logger.info('Creating shot plan', { duration_s, tone });

  const sceneDuration = Math.floor(duration_s / 3);

  const scenes: Scene[] = script.beats.map((beat, index) => ({
    len_s: sceneDuration,
    visual_metaphor: generateVisualMetaphor(beat, index, tone),
    overlay: script.on_screen_text[index] || beat.substring(0, 60),
  }));

  const shotPlan: ShotPlan = {
    aspect: '9:16',
    music_mood: getMusicMood(tone),
    subtitle_style: 'bold_lower_thirds',
    scenes,
  };

  return shotPlan;
}

function generateVisualMetaphor(beat: string, index: number, tone: string): string {
  // Generate visual metaphors based on tone and beat content
  const metaphors = {
    aspirational: [
      'holographic constellations of code over a sunrise city skyline',
      'dynamic system diagrams morphing into real-world outcomes',
      'modern office with team collaborating, warm natural light',
    ],
    energetic: [
      'fast-paced montage of tech products launching',
      'colorful data visualizations coming to life',
      'vibrant workspace with dynamic team interactions',
    ],
    professional: [
      'clean modern office spaces with focused professionals',
      'sophisticated data dashboards and analytics',
      'executive team in sleek conference room',
    ],
    witty: [
      'playful tech metaphors with unexpected twists',
      'clever visual puns on technology concepts',
      'creative team brainstorming with dynamic energy',
    ],
  };

  const toneMetaphors = metaphors[tone as keyof typeof metaphors] || metaphors.professional;
  return toneMetaphors[index % toneMetaphors.length];
}

function getMusicMood(tone: string): string {
  const moods: Record<string, string> = {
    aspirational: 'upbeat cinematic',
    energetic: 'upbeat electronic',
    professional: 'corporate modern',
    witty: 'playful upbeat',
  };

  return moods[tone] || 'upbeat cinematic';
}
