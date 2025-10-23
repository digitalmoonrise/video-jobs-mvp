# Video Jobs MVP

Turn job descriptions into engaging short-form recruitment videos using AI.

## Features

- Parse job descriptions using LLM (GPT-4)
- Generate video scripts with hooks, beats, and CTAs
- **Create 3-scene videos using:**
  - **Veo 3.1 (Google Gemini)** - Cinematic AI-generated video (6-8s per scene)
  - Template mode - Fast gradient backgrounds for testing
- Add branded overlays and end cards
- Quality control checks
- Simple web interface with real-time pipeline visualization

## Architecture

```
POST /render → Parser → Script/Beats → Scene Generation → Compositor → QC → Output
```

## Setup

1. Install dependencies:
```bash
cd ~/video-jobs-mvp
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your API keys to `.env`:
```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...  # For Veo 3.1 video generation
```

To get a Gemini API key:
1. Visit https://aistudio.google.com/apikey
2. Create an API key
3. Add it to your `.env` file

4. Ensure FFmpeg is installed:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
apt-get install ffmpeg
```

## Development

Start the server in development mode:
```bash
npm run dev
```

Server runs on http://localhost:3000

## Usage

### Web Interface

1. Open http://localhost:3000 in your browser
2. Fill in company name and job description
3. Choose tone, duration, colors, and **video engine**
4. Click "Generate Video"
5. Wait for processing:
   - **Veo 3.1**: 60-120s (AI-generated cinematic video)
   - **Template**: 30-60s (gradient backgrounds)
6. View the real-time pipeline results
7. Download your video

### API

**Create Render Job**
```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-123",
    "company": "Acme Corp",
    "job_description": "Senior Software Engineer...",
    "brand": {
      "primary_hex": "#0B5FFF",
      "secondary_hex": "#111827",
      "tone": "aspirational"
    },
    "duration_s": 21,
    "engine": "veo3",
    "scenes": 3
  }'
```

**Check Status**
```bash
curl http://localhost:3000/render/{render_id}
```

## Video Engines

The platform supports multiple video generation engines:

### Veo 3.1 (Google Gemini) - **Recommended**

High-quality AI-generated cinematic video using Google's Gemini API.

**Features:**
- Generates 6-8 second scenes with natural motion
- Native audio generation (currently muted for consistency)
- Cinematic visual storytelling
- Smooth camera movements and realistic lighting

**Setup:**
1. Get a Gemini API key from https://aistudio.google.com/apikey
2. Add to `.env`: `GEMINI_API_KEY=your_key_here`
3. Select "Veo 3.1" in the web UI or use `"engine": "veo3"` in the API

**Processing Time:** 60-120 seconds for 3 scenes

**Cost:** Approximately $0.30-0.50 per video (Google Gemini pricing)

### Template Engine

Fast gradient-based backgrounds for testing and prototyping.

**Features:**
- Instant generation using FFmpeg
- Gradient animations
- Good for testing the pipeline

**Setup:**
No additional configuration needed.

**Processing Time:** 30-60 seconds

**Cost:** Free (local generation only)

## Configuration

All defaults can be configured via environment variables:

- `DEFAULT_TONE` - Video tone (aspirational/energetic/professional/witty)
- `DEFAULT_DURATION_S` - Video duration in seconds (15/21/24/30)
- `DEFAULT_SCENES` - Number of scenes (2-4)
- `DEFAULT_FPS` - Frame rate (24/30)

## File Structure

```
/src
  /api
    server.ts          - Express server
  /workers
    orchestrator.ts    - Main pipeline coordinator
    parse_llm.ts       - Job description parser
    script_llm.ts      - Script generator
    generators.ts      - Video generation adapters
    compose_ffmpeg.ts  - FFmpeg compositor
  /lib
    /prompts           - LLM prompts
    /qc                - Quality control
    /types             - TypeScript types
    config.ts          - Configuration
    logger.ts          - Logging
    s3.ts              - S3 storage
    storage.ts         - Job storage
  /web
    index.html         - Web UI
```

## Output

Videos are saved to:
- `./tmp/` - Temporary working files
- `./renders/` - Final videos (if not using S3)
- S3 bucket (if configured)

## Extending

### Add New Video Generator

1. Create adapter in `src/workers/generators.ts`
2. Implement `GeneratorAdapter` interface
3. Add to `getGeneratorAdapter()` switch

### Customize Prompts

Edit prompt templates in `src/lib/prompts/`

### Add QC Checks

Add checks to `src/lib/qc/index.ts`

## Troubleshooting

**FFmpeg not found**
- Install FFmpeg: `brew install ffmpeg` (macOS) or `apt-get install ffmpeg` (Linux)

**OpenAI API errors**
- Verify API key in `.env`
- Check API quota and billing

**Video generation fails**
- Check FFmpeg installation
- Verify tmp directory is writable
- Check logs for detailed errors

## License

ISC
