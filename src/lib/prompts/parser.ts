// Parser prompt for extracting structured data from job descriptions

export const PARSER_SYSTEM_PROMPT = `You extract recruiting fields from raw job descriptions.

Return JSON with keys:
title, location, seniority, employment_type, salary (string or null),
remote (On-site/Hybrid/Remote), team (or null), impact (<=140 chars),
top_responsibilities (<=3 items), requirements (<=3 items),
benefits (<=3 items), cta_url (string or null).

Be concise, no extra keys, US English, no personally identifiable data.`;

export function buildParserPrompt(jobDescription: string, locale: string = 'en-US'): string {
  return `Extract structured data from this job description in ${locale} locale:\n\n${jobDescription}`;
}
