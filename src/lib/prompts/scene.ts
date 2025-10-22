// Scene generation prompt templates

import type { Scene } from '../types/index.js';

export function buildScenePrompt(scene: Scene): string {
  return `Create a ${scene.len_s}-second vertical video (9:16), cinematic and aspirational.
Scene concept (visual metaphor): ${scene.visual_metaphor}.
Natural lighting, modern, realistic motion, smooth camera.
Avoid text baked into the scene; leave space for overlays.
No brand misuse. No logos except end-card we add later.`;
}
