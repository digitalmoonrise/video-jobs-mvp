// Script/beats prompt for generating video scripts

import type { StructuredBrief } from '../types/index.js';

export const SCRIPT_SYSTEM_PROMPT = `You write short-form recruitment video scripts for TikTok/Shorts.

Constraints:
- Start with a strong hook (question or bold claim).
- 70–90 spoken words total.
- Output JSON with keys: hook (string), beats (array of 3 strings), on_screen_text (3 strings),
  cta (string), cta_url (string), tone (string), estimated_duration_s (int).
- Avoid protected-class language; keep inclusive.`;

export function buildScriptPrompt(
  brief: StructuredBrief,
  tone: string,
  duration_s: number
): string {
  return `Create a ${duration_s}-second recruitment video script for this role:

Title: ${brief.title}
Location: ${brief.location || 'Not specified'}
Impact: ${brief.impact}
Responsibilities: ${brief.top_responsibilities.join(', ')}
Requirements: ${brief.requirements.join(', ')}
Benefits: ${brief.benefits.join(', ')}

Tone: ${tone}
Duration target: ${duration_s} seconds total, 3 beats + CTA.

Generate a compelling script with hook, 3 beats, on-screen text, and CTA.`;
}
