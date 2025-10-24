// Script/beats prompt for generating video scripts

import type { StructuredBrief } from '../types/index.js';

export const SCRIPT_SYSTEM_PROMPT = `You are an expert short-form video scriptwriter specializing in recruitment content for TikTok, Instagram Reels, and YouTube Shorts.

STORYTELLING STRUCTURE (7-21 seconds, scales with scene count):
1. HOOK (always): Grab attention with a question, bold claim, or surprising statement
2. BUILD (1-3 beats, variable): Develop the narrative showing what makes this role compelling
   - 1 beat: Single core message (~7s total)
   - 2 beats: Two-part story (~14s total)
   - 3 beats: Full narrative arc (~21s total)
3. CTA (always): Clear call-to-action with next steps

KEY PRINCIPLES:
- Use conversational, natural language (write how people actually talk)
- Create emotional connection (aspiration, excitement, belonging)
- Be specific and concrete (avoid vague generalities)
- One core message per video (don't try to say everything)
- Show impact and meaning, not just features

ANTI-PATTERNS TO AVOID:
- Corporate jargon ("synergies", "paradigm shift", "thought leadership")
- Buzzword bingo ("rockstar", "ninja", "guru", "unicorn")
- Clichés ("work hard play hard", "fast-paced environment")
- List dumps (don't just enumerate responsibilities)
- Empty phrases ("competitive salary", "great culture")

OUTPUT FORMAT (JSON):
{
  "hook": "Opening line that stops the scroll (question or bold statement)",
  "beats": ["Build beat 1", "Build beat 2", ...],  // Array length matches requested scene count (1-3)
  "on_screen_text": ["Text for scene 1", "Text for scene 2", ...],  // Same length as beats
  "cta": "Clear call to action",
  "cta_url": "Application URL if provided",
  "tone": "Match requested tone",
  "estimated_duration_s": target duration
}

WORD COUNT: Scales with scene count (30-40 words for 1 scene, 50-70 for 2 scenes, 70-90 for 3 scenes).
INCLUSIVITY: Use gender-neutral language, avoid protected-class references.`;

export function buildScriptPrompt(
  brief: StructuredBrief,
  tone: string,
  duration_s: number,
  scene_count: number
): string {
  return `Create a ${duration_s}-second recruitment video script with ${scene_count} scene${scene_count > 1 ? 's' : ''} for this role:

ROLE DETAILS:
Title: ${brief.title}
Location: ${brief.location || 'Not specified'}
${brief.remote ? `Work Mode: ${brief.remote}` : ''}
${brief.seniority ? `Level: ${brief.seniority}` : ''}
${brief.salary ? `Compensation: ${brief.salary}` : ''}

Impact: ${brief.impact}

Key Responsibilities:
${brief.top_responsibilities.map(r => `- ${r}`).join('\n')}

Requirements:
${brief.requirements.map(r => `- ${r}`).join('\n')}

Benefits:
${brief.benefits.map(b => `- ${b}`).join('\n')}

---

TONE: ${tone}
DURATION: ${duration_s} seconds total
SCENE COUNT: ${scene_count} (generate exactly ${scene_count} beat${scene_count > 1 ? 's' : ''} in the beats array)

HOOK EXAMPLES (choose a pattern that fits):
1. Question format: "What if [compelling scenario]?"
2. Bold claim: "This role isn't [common assumption]. It's [reality]."
3. Problem/solution: "Tired of [pain point]? Here's [opportunity]."
4. Impact-first: "Help [number] people [meaningful outcome]."
5. Contrast: "Most [role type] [common situation]. Here, [unique situation]."

STORYTELLING GUIDANCE:
- Focus on ONE core message: impact, growth, culture, innovation, or mission
- Use specific numbers, names, and concrete details when available
- Paint a picture of a day in the life or the team's work
- Connect the work to real human outcomes when possible

Generate a compelling script that feels authentic and makes someone want to learn more.`;
}

export const SHOT_PLAN_SYSTEM_PROMPT = `You are an expert cinematographer and visual storyteller specializing in AI-generated video direction for short-form recruitment content.

VISUAL STORYTELLING PRINCIPLES:
1. Clear Focus: Each scene should have ONE clear visual subject or concept
2. Cinematic Techniques: Use depth of field, camera movement, and composition intentionally
3. Emotional Resonance: Visuals should evoke the feeling that matches the script beat
4. Progression: Build visual momentum across scenes (establish → develop → payoff)

TECHNICAL REQUIREMENTS FOR AI VIDEO GENERATION:
- Camera Movement: Specify smooth, purposeful movement (pan, tilt, dolly, orbit)
- Lighting: Natural, cinematic lighting with clear direction (golden hour, soft window light, etc.)
- Depth of Field: Shallow focus for subject emphasis, deep focus for environment
- Composition: Rule of thirds, leading lines, symmetry when purposeful
- Color Palette: Consistent mood (warm/aspirational, cool/professional, vibrant/energetic)

SPECIFIC CONSTRAINTS:
- NO text, logos, or readable content in scenes (we add overlays in post)
- NO impossible physics or unrealistic scenarios that break immersion
- NO static shots - always include subtle camera or subject movement
- Reserve lower 20% of frame for caption overlays
- Each scene: 6-8 seconds with natural beginning/middle/end

OUTPUT FORMAT (JSON):
{
  "aspect": "9:16",
  "music_mood": "descriptive mood",
  "subtitle_style": "bold_lower_thirds",
  "scenes": [
    {
      "len_s": 7,
      "visual_metaphor": "Detailed scene description with camera movement, lighting, subject, and mood"
    }
  ]
}

VISUAL METAPHOR QUALITY:
- Be SPECIFIC: "Close-up of hands typing code on a MacBook in a modern office with large windows, warm afternoon light, shallow depth of field blurring the bustling team in background"
- Not generic: "Person working at computer"
- Paint a complete picture that an AI video model can render cinematically`;

function getVisualStyleGuide(tone: string): string {
  const styleGuides: Record<string, string> = {
    aspirational: `
CINEMATOGRAPHY: Sweeping camera movements, golden hour lighting, hero shots
COLOR PALETTE: Warm tones, sunrise/sunset oranges and golds
METAPHORS: Height/elevation, horizons, connectivity, transformation
MOOD: Inspiring, uplifting, forward-looking
EXAMPLES:
- Sunrise over city skyline with light streaming through modern office windows
- Wide shot pulling back to reveal scale of impact/team/technology
- Hands reaching up, growth metaphors, ascending perspectives`,

    energetic: `
CINEMATOGRAPHY: Dynamic movement, quick cuts between angles, vibrant colors
COLOR PALETTE: Bold, saturated colors - teals, magentas, electric blues
METAPHORS: Motion, velocity, collaboration in action, creation
MOOD: Fast-paced, exciting, vibrant
EXAMPLES:
- Fast dolly through collaborative workspace with people actively engaged
- Close-ups of hands in motion - building, creating, gesturing
- Vibrant color splashes, data visualizations coming to life`,

    professional: `
CINEMATOGRAPHY: Steady, composed shots, sophisticated lighting, clean lines
COLOR PALETTE: Cool blues, slate grays, crisp whites, accent colors
METAPHORS: Precision, expertise, modern technology, clarity
MOOD: Confident, accomplished, refined
EXAMPLES:
- Sleek conference room with city view, even lighting
- Close-up of sophisticated interfaces and dashboards
- Professional team in modern office, clean compositions`,

    witty: `
CINEMATOGRAPHY: Unexpected angles, playful framing, creative compositions
COLOR PALETTE: Eclectic but harmonious, pops of unexpected color
METAPHORS: Clever juxtapositions, visual puns, delightful surprises
MOOD: Clever, warm, human, approachable
EXAMPLES:
- Unexpected perspective shifts (overhead, through objects, reflections)
- Playful interactions with environment or objects
- Whimsical transitions and creative reveals`
  };

  return styleGuides[tone] || styleGuides.professional;
}

export function buildShotPlanPrompt(
  script: { hook: string; beats: string[]; tone: string },
  brief: StructuredBrief,
  duration_s: number,
  tone: string,
  scene_count: number
): string {
  const styleGuide = getVisualStyleGuide(tone);

  // Calculate per-scene duration based on actual scene count
  const sceneDuration = Math.floor(duration_s / scene_count);

  // Build dynamic beat visualization
  const beatsVisualization = script.beats.map((beat, index) =>
    `Beat ${index + 1}: ${beat} (Scene ${index} - ${sceneDuration}s)`
  ).join('\n');

  return `Create a shot plan for a ${duration_s}-second recruitment video (${scene_count} scene${scene_count > 1 ? 's' : ''}).

JOB CONTEXT:
Role: ${brief.title}
Company Type: ${brief.team || 'Technology company'}
Impact: ${brief.impact}

SCRIPT TO VISUALIZE:
Hook: ${script.hook}
${beatsVisualization}

VISUAL STYLE FOR ${tone.toUpperCase()} TONE:
${styleGuide}

ROLE-SPECIFIC VISUAL THINKING:
${getRoleSpecificVisuals(brief.title)}

Create ${scene_count} cinematic scene description${scene_count > 1 ? 's' : ''} that:
1. Match the emotional tone and message of each beat
2. Use the ${tone} visual style guide above
3. Are specific enough for AI video generation
4. Build visual momentum from scene to scene
5. Feel authentic to the role and industry

Each visual_metaphor should be 1-2 detailed sentences with:
- Camera movement and angle
- Lighting description
- Main subject/focus
- Background/environment details
- Mood/feeling`;
}

function getRoleSpecificVisuals(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('engineer') || lowerTitle.includes('developer')) {
    return `- Focus on creation: code, building, problem-solving in action
- Show collaboration between engineers, pair programming
- Avoid stereotypical "hoodie in dark room" - show modern, well-lit spaces
- Include human elements - team interactions, not just screens`;
  }

  if (lowerTitle.includes('designer') || lowerTitle.includes('creative')) {
    return `- Show creative process: sketching, prototyping, iterating
- Emphasize visual thinking - whiteboards, design tools, critiques
- Beautiful lighting and composition (this audience judges visual quality)
- Mix digital and analog creative tools`;
  }

  if (lowerTitle.includes('data') || lowerTitle.includes('analyst')) {
    return `- Visualize insights emerging from complexity
- Show data visualizations, dashboards, patterns
- Include human interpretation - not just numbers but meaning
- Modern, clean aesthetic with pops of color from data viz`;
  }

  if (lowerTitle.includes('sales') || lowerTitle.includes('account')) {
    return `- Focus on human connection: conversations, relationships
- Show energy and momentum
- Include collaborative aspects - team celebrations, strategy sessions
- Modern office environments, video calls, presentations`;
  }

  if (lowerTitle.includes('manager') || lowerTitle.includes('lead')) {
    return `- Show leadership in action: mentoring, strategy, collaboration
- Include team dynamics and connection
- Balance authority with approachability
- Modern professional settings with human warmth`;
  }

  return `- Focus on impact: show the human outcome of the work
- Include collaboration and team dynamics
- Modern, well-designed workplace
- Balance professionalism with authenticity`;
}
