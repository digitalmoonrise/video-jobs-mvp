// Video generator adapters for Sora2, Veo3, and template fallback

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import path from 'path';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { buildScenePrompt } from '../lib/prompts/scene.js';
import { generateVeoScene } from './gen_veo3.js';
import type { Scene } from '../lib/types/index.js';

const execAsync = promisify(exec);
const logger = createLogger('generators');

export interface GeneratorAdapter {
  generate(scene: Scene, renderId: string, sceneIndex: number): Promise<string>;
}

// Template/Fallback adapter - generates videos using FFmpeg with gradient backgrounds
class TemplateAdapter implements GeneratorAdapter {
  async generate(scene: Scene, renderId: string, sceneIndex: number): Promise<string> {
    const outputPath = path.join(config.paths.tmp, `${renderId}_scene${sceneIndex}.mp4`);

    logger.info('Generating template scene', { renderId, sceneIndex });

    try {
      // Create a gradient background video with text overlay
      // Using FFmpeg to generate a simple animated gradient
      const color1 = '#0B5FFF';
      const color2 = '#111827';

      // Generate video with animated gradient background
      const cmd = `ffmpeg -y -f lavfi -i "color=c=${color1}:s=1080x1920:d=${scene.len_s},format=rgb24" \
        -vf "geq=r='${this.generateGradientFormula('r', color1, color2)}':g='${this.generateGradientFormula('g', color1, color2)}':b='${this.generateGradientFormula('b', color1, color2)}'" \
        -r 30 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p "${outputPath}"`;

      await execAsync(cmd);

      logger.info('Template scene generated', { renderId, sceneIndex, outputPath });
      return outputPath;
    } catch (error) {
      logger.error('Failed to generate template scene', { renderId, sceneIndex, error });
      throw error;
    }
  }

  private generateGradientFormula(channel: string, color1: string, color2: string): string {
    // Simple vertical gradient animation
    return 'Y/H*255';
  }
}

// Sora2 adapter (placeholder - requires actual API)
class Sora2Adapter implements GeneratorAdapter {
  async generate(scene: Scene, renderId: string, sceneIndex: number): Promise<string> {
    logger.warn('Sora2 adapter not implemented, falling back to template', { renderId, sceneIndex });

    // For now, fall back to template
    const template = new TemplateAdapter();
    return template.generate(scene, renderId, sceneIndex);

    // Real implementation would be:
    // const prompt = buildScenePrompt(scene);
    // const response = await sora2API.generate({
    //   aspect: "9:16",
    //   duration: scene.len_s,
    //   prompt,
    //   seed: hashString(`${renderId}_${sceneIndex}`),
    // });
    // return downloadAndSaveClip(response.clip_url, renderId, sceneIndex);
  }
}

// Veo3 adapter (Google Gemini API)
class Veo3Adapter implements GeneratorAdapter {
  async generate(scene: Scene, renderId: string, sceneIndex: number): Promise<string> {
    try {
      logger.info('Using Veo 3.1 (Google Gemini) for scene generation', { renderId, sceneIndex });
      return await generateVeoScene(scene, renderId, sceneIndex);
    } catch (error) {
      logger.error('Veo3 generation failed, falling back to template', { renderId, sceneIndex, error });
      // Fall back to template on error
      const template = new TemplateAdapter();
      return template.generate(scene, renderId, sceneIndex);
    }
  }
}

export function getGeneratorAdapter(engine: string): GeneratorAdapter {
  switch (engine) {
    case 'sora2':
      return new Sora2Adapter();
    case 'veo3':
      return new Veo3Adapter();
    case 'template':
    default:
      return new TemplateAdapter();
  }
}

export async function generateScene(
  engine: string,
  scene: Scene,
  renderId: string,
  sceneIndex: number
): Promise<string> {
  const adapter = getGeneratorAdapter(engine);
  return adapter.generate(scene, renderId, sceneIndex);
}
