// Parser LLM worker - extracts structured data from job descriptions

import OpenAI from 'openai';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { PARSER_SYSTEM_PROMPT, buildParserPrompt } from '../lib/prompts/parser.js';
import type { StructuredBrief } from '../lib/types/index.js';

const logger = createLogger('parse_llm');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function parseJobDescription(
  jobDescription: string,
  locale: string = 'en-US'
): Promise<StructuredBrief> {
  const startTime = Date.now();

  try {
    logger.info('Parsing job description', { locale });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PARSER_SYSTEM_PROMPT },
        { role: 'user', content: buildParserPrompt(jobDescription, locale) },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }

    const brief: StructuredBrief = JSON.parse(content);

    // Validate required fields
    if (!brief.title || !brief.impact) {
      throw new Error('Missing required fields in parsed brief');
    }

    const duration = Date.now() - startTime;
    logger.info('Job description parsed successfully', { duration_ms: duration });

    return brief;
  } catch (error) {
    logger.error('Failed to parse job description', { error });
    throw error;
  }
}
