# Quick Start Guide

Get your Video Jobs MVP up and running in 5 minutes.

## Prerequisites

1. Node.js 18+ installed
2. FFmpeg installed (`brew install ffmpeg` on macOS)
3. OpenAI API key (get one at https://platform.openai.com/)

## Setup

1. **Navigate to the project**
   ```bash
   cd ~/video-jobs-mvp
   ```

2. **Add your OpenAI API key**

   Edit `.env` and replace `your-openai-api-key-here` with your actual API key:
   ```bash
   OPENAI_API_KEY=sk-proj-...
   ```

3. **Start the server**
   ```bash
   npm run dev
   ```

   You should see:
   ```
   Video Jobs MVP Server
   ====================
   Web UI:  http://localhost:3000
   Health:  http://localhost:3000/health
   ```

4. **Open the web interface**

   Open http://localhost:3000 in your browser

## Create Your First Video

1. In the web form, enter:
   - **Company Name**: e.g., "Acme Corp"
   - **Job Description**: Paste any job description (the longer the better for LLM parsing)
   - **Tone**: Choose your preferred tone (aspirational is default)
   - **Duration**: 21 seconds is recommended
   - **Colors**: Customize brand colors if desired

2. Click **"Generate Video"**

3. Wait 30-90 seconds for processing

4. Once complete, the video will be saved in the `tmp/` directory
   - Look for files like `tmp/r_xxxxx_final.mp4`

## Sample Job Description

If you need a sample, use this:

```
Senior Software Engineer
Location: San Francisco, CA (Hybrid)

We're building the future of work. Join our Recommendations team to help millions of job seekers find their dream roles using cutting-edge ML.

Responsibilities:
- Design and scale backend services handling 100M+ requests/day
- Partner with data scientists and product managers
- Mentor junior engineers

Requirements:
- 5+ years backend experience
- Python/Go expertise, cloud-native architecture
- Strong system design skills

Benefits:
- 401k match, equity
- Generous parental leave
- $2000 annual learning stipend

Apply: https://careers.example.com/jobs/123
```

## What Happens Behind the Scenes

1. **Parser**: LLM extracts structured data from job description
2. **Script Writer**: LLM generates 3-beat video script with hook and CTA
3. **Shot Planning**: Creates visual metaphors for each scene
4. **Generation**: Creates 3 video scenes (gradient template for MVP)
5. **Composition**: Concatenates scenes, adds overlays and end card
6. **QC**: Checks duration, resolution, and quality metrics
7. **Output**: Saves final video locally or uploads to S3

## Output Location

Videos are saved to:
- **Working files**: `./tmp/r_xxxxx_*`
- **Final video**: `./tmp/r_xxxxx_final.mp4`

## Troubleshooting

**"Cannot find module" errors**
```bash
npm install
```

**FFmpeg not found**
```bash
brew install ffmpeg  # macOS
apt-get install ffmpeg  # Linux
```

**OpenAI API errors**
- Check your API key in `.env`
- Ensure you have credits/billing set up
- Try a different model if rate limited

**Video too short/long**
- Adjust duration in the web form (15, 21, 24, or 30 seconds)

## Next Steps

- Customize prompts in `src/lib/prompts/`
- Add your own brand colors and logos
- Integrate with Sora2/Veo3 when available (see `src/workers/generators.ts`)
- Set up S3 storage for production use
- Add audio/music overlay
- Implement TTS voiceover

## Need Help?

Check the full README.md for detailed documentation.
