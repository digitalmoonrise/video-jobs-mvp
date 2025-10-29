// Sales pitch LLM worker - generates compelling sales pitches from job descriptions

import OpenAI from 'openai';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { SALES_PITCH_SYSTEM_PROMPT, buildSalesPitchPrompt } from '../lib/prompts/sales_pitch.js';
import type { StructuredBrief } from '../lib/types/index.js';

const logger = createLogger('sales_pitch_llm');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export interface SalesPitchResult {
  segments: string[];
  full_pitch: string;
}

export async function generateSalesPitch(
  brief: StructuredBrief,
  sceneCount: number
): Promise<SalesPitchResult> {
  const startTime = Date.now();

  try {
    logger.info('Generating sales pitch', { sceneCount });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SALES_PITCH_SYSTEM_PROMPT },
        { role: 'user', content: buildSalesPitchPrompt(brief, sceneCount) },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }

    const result: SalesPitchResult = JSON.parse(content);

    // Validate required fields
    if (!result.segments || result.segments.length !== sceneCount) {
      throw new Error(`Invalid sales pitch structure - expected ${sceneCount} segments, got ${result.segments?.length || 0}`);
    }

    const duration = Date.now() - startTime;
    logger.info('Sales pitch generated successfully', { 
      duration_ms: duration, 
      segment_count: result.segments.length 
    });

    return result;
  } catch (error) {
    logger.error('Failed to generate sales pitch', { error });
    // Return fallback sales pitch
    return generateFallbackSalesPitch(brief, sceneCount);
  }
}

function generateFallbackSalesPitch(brief: StructuredBrief, sceneCount: number): SalesPitchResult {
  logger.info('Generating fallback sales pitch', { sceneCount });

  const segments: string[] = [];
  
  // Generate simple segments based on available data
  if (sceneCount >= 1) {
    segments.push(`${brief.title} opportunity at ${brief.location || 'a great company'}`);
  }
  
  if (sceneCount >= 2) {
    const responsibility = brief.top_responsibilities[0] || 'Make an impact';
    segments.push(responsibility.substring(0, 60));
  }
  
  if (sceneCount >= 3) {
    const benefit = brief.benefits[0] || 'Join our team';
    segments.push(benefit.substring(0, 60));
  }

  const full_pitch = `${brief.title} role focused on ${brief.impact}`;

  return { segments, full_pitch };
}

