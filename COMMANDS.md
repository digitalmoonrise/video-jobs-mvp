# Command Reference

Quick reference for all available commands in the Video Jobs MVP.

## Development

### Start Development Server
```bash
npm run dev
```
Starts the server with hot-reload using tsx watch. Server runs on http://localhost:3000

### Build for Production
```bash
npm run build
```
Compiles TypeScript to JavaScript in the `dist/` directory

### Start Production Server
```bash
npm start
```
Runs the compiled production build (must run `npm run build` first)

## Testing

### Run Test Script
```bash
./test-render.sh
```
Tests the API with a sample job description. Server must be running first.

### Manual API Test
```bash
# Create a render job
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
    "engine": "template",
    "scenes": 3
  }'

# Check status (replace RENDER_ID with actual ID from above)
curl http://localhost:3000/render/RENDER_ID
```

## Maintenance

### Install Dependencies
```bash
npm install
```

### Clean Build Artifacts
```bash
rm -rf dist/
```

### Clean Temporary Files
```bash
rm -rf tmp/* renders/*
```

### View Logs
Development mode logs are shown in console. For production:
```bash
npm start | tee video-jobs.log
```

## Project Structure

### View All Source Files
```bash
tree src/
```

### Count Lines of Code
```bash
find src -name "*.ts" | xargs wc -l
```

### Check Dependencies
```bash
npm list --depth=0
```

## FFmpeg Utilities

### Verify FFmpeg Installation
```bash
ffmpeg -version
```

### Check Video Metadata
```bash
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate \
  -of json tmp/r_xxxxx_final.mp4
```

### Play Generated Video
```bash
# macOS
open tmp/r_xxxxx_final.mp4

# Linux
vlc tmp/r_xxxxx_final.mp4
```

## Environment

### Check Node Version
```bash
node --version  # Should be 18+
```

### View Environment Variables
```bash
cat .env
```

### Test OpenAI Connection
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

## Debugging

### Enable Debug Mode
Add to `.env`:
```
NODE_ENV=development
LOG_LEVEL=debug
```

### View Render Job Details
Check the storage for debug information:
```bash
# The debug info is in memory - check server console output
# Or query the API:
curl http://localhost:3000/render/RENDER_ID | jq .debug
```

### Inspect Intermediate Files
All intermediate files are in `tmp/` with the render ID:
```bash
ls -lh tmp/r_xxxxx*

# Scene files
tmp/r_xxxxx_scene0.mp4
tmp/r_xxxxx_scene1.mp4
tmp/r_xxxxx_scene2.mp4

# Normalized scenes
tmp/r_xxxxx_scene0_norm.mp4
tmp/r_xxxxx_scene1_norm.mp4
tmp/r_xxxxx_scene2_norm.mp4

# Composition stages
tmp/r_xxxxx_concat.mp4
tmp/r_xxxxx_overlays.mp4
tmp/r_xxxxx_endcard.png
tmp/r_xxxxx_final.mp4
```

## Performance

### Monitor Server
```bash
# CPU and memory usage
top -pid $(pgrep -f "tsx.*server.ts")
```

### Profile FFmpeg
```bash
time ffmpeg -i input.mp4 output.mp4
```

## Deployment

### Production Checklist
1. Set `NODE_ENV=production` in `.env`
2. Run `npm run build`
3. Set up S3 credentials
4. Configure domain/SSL
5. Set up process manager (PM2)
6. Enable monitoring

### Using PM2
```bash
npm install -g pm2
npm run build
pm2 start dist/api/server.js --name video-jobs-mvp
pm2 logs video-jobs-mvp
pm2 restart video-jobs-mvp
pm2 stop video-jobs-mvp
```

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in .env
PORT=3001
```

### FFmpeg Errors
```bash
# Check FFmpeg installation
which ffmpeg
ffmpeg -version

# Reinstall if needed (macOS)
brew reinstall ffmpeg
```

### TypeScript Errors
```bash
# Check TypeScript version
npx tsc --version

# Run type check without building
npx tsc --noEmit
```

### Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Git Commands

### Initialize Repository
```bash
git init
git add .
git commit -m "Initial commit: Video Jobs MVP"
```

### Create .gitignore
Already created with:
- node_modules/
- dist/
- tmp/
- renders/
- .env

## Useful Aliases

Add to your `~/.bashrc` or `~/.zshrc`:
```bash
alias vj-dev="cd ~/video-jobs-mvp && npm run dev"
alias vj-test="cd ~/video-jobs-mvp && ./test-render.sh"
alias vj-logs="cd ~/video-jobs-mvp && tail -f video-jobs.log"
alias vj-clean="cd ~/video-jobs-mvp && rm -rf tmp/* renders/*"
```
