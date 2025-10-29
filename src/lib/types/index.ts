// Core type definitions for the video jobs MVP

export interface RenderRequest {
  job_id: string;
  company: string;
  job_description: string;
  brand: BrandConfig;
  locale?: string;
  /** Number of scenes to generate (1-3). Determines video length (~7s per scene). Default: 1 */
  scene_count?: number;
  /** @deprecated Use scene_count instead. Kept for backwards compatibility. */
  duration_s?: number;
  engine?: 'sora2' | 'veo3' | 'template';
  /** @deprecated Use scene_count instead. Kept for backwards compatibility. */
  scenes?: number;
  /** Testing mode: Use existing videos from tmp directory instead of generating new ones. No Veo API calls. */
  overlay_only?: boolean;
}

export interface BrandConfig {
  primary_hex: string;
  secondary_hex: string;
  logo_url?: string;
  tone: 'energetic' | 'aspirational' | 'professional' | 'witty';
}

export interface RenderResponse {
  render_id: string;
  status: RenderStatus;
}

export type RenderStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'ERROR';

export interface RenderStatusResponse {
  status: RenderStatus;
  video_url?: string;
  thumb_url?: string;
  duration_s?: number;
  error?: string;
  brief?: StructuredBrief;
  script?: VideoScript;
  shot_plan?: ShotPlan;
  sales_pitch?: string[];
  debug?: {
    cost_cents?: number;
    latency_s?: number;
    engine?: string;
  };
}

export interface StructuredBrief {
  title: string;
  location: string | null;
  seniority: string | null;
  employment_type: string | null;
  salary: string | null;
  remote: 'On-site' | 'Hybrid' | 'Remote' | null;
  team: string | null;
  impact: string;
  top_responsibilities: string[];
  requirements: string[];
  benefits: string[];
  cta_url: string | null;
}

export interface VideoScript {
  hook: string;
  beats: string[];
  on_screen_text: string[];
  tone: string;
  cta: string;
  cta_url: string | null;
  estimated_duration_s: number;
}

export interface Scene {
  len_s: number;
  visual_metaphor: string;
  overlay: string;
}

export interface ShotPlan {
  aspect: string;
  music_mood: string;
  subtitle_style: string;
  scenes: Scene[];
}

export interface RenderJob {
  render_id: string;
  request: RenderRequest;
  status: RenderStatus;
  brief?: StructuredBrief;
  script?: VideoScript;
  shot_plan?: ShotPlan;
  sales_pitch?: string[];
  scene_files?: string[];
  final_video?: string;
  error?: string;
  created_at: Date;
  updated_at: Date;
  debug: {
    cost_cents: number;
    latency_s: number;
    steps: Array<{ step: string; duration_ms: number; timestamp: Date }>;
  };
}
