#!/bin/bash

# Test script for Video Jobs MVP
# This script tests the render API with a sample job description

API_BASE="http://localhost:3000"

echo "Testing Video Jobs MVP"
echo "====================="
echo ""

# Check if server is running
echo "1. Checking server health..."
HEALTH=$(curl -s "$API_BASE/health")
if [ $? -eq 0 ]; then
  echo "   ✓ Server is running"
  echo "   $HEALTH"
else
  echo "   ✗ Server is not running. Start it with: npm run dev"
  exit 1
fi

echo ""
echo "2. Creating render job..."

# Create render job
RESPONSE=$(curl -s -X POST "$API_BASE/render" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-'$(date +%s)'",
    "company": "Acme Robotics",
    "job_description": "Senior Software Engineer - Austin, TX (Hybrid)\n\nJoin our Recommendations team to build ML-powered experiences that help millions find work faster.\n\nResponsibilities:\n- Design and scale backend services handling 100M+ requests/day\n- Partner with data scientists and product managers\n- Mentor junior engineers\n\nRequirements:\n- 5+ years backend experience (Python/Go)\n- Cloud-native architecture expertise\n- Strong system design skills\n\nBenefits:\n- 401k match, equity, parental leave\n- $2000 annual learning stipend\n\nApply: https://careers.acme.com/jobs/123",
    "brand": {
      "primary_hex": "#0B5FFF",
      "secondary_hex": "#111827",
      "tone": "aspirational"
    },
    "duration_s": 21,
    "engine": "template",
    "scenes": 3
  }')

RENDER_ID=$(echo $RESPONSE | grep -o '"render_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$RENDER_ID" ]; then
  echo "   ✗ Failed to create render job"
  echo "   Response: $RESPONSE"
  exit 1
fi

echo "   ✓ Render job created: $RENDER_ID"
echo ""

echo "3. Polling for status (max 2 minutes)..."
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  STATUS=$(curl -s "$API_BASE/render/$RENDER_ID" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  echo "   Attempt $((ATTEMPT+1))/$MAX_ATTEMPTS: $STATUS"

  if [ "$STATUS" = "READY" ]; then
    echo ""
    echo "   ✓ Video is ready!"
    VIDEO_INFO=$(curl -s "$API_BASE/render/$RENDER_ID")
    echo "   $VIDEO_INFO"
    echo ""
    echo "Check the tmp/ directory for your video file."
    exit 0
  elif [ "$STATUS" = "ERROR" ]; then
    echo ""
    echo "   ✗ Render failed"
    ERROR_INFO=$(curl -s "$API_BASE/render/$RENDER_ID")
    echo "   $ERROR_INFO"
    exit 1
  fi

  sleep 2
  ATTEMPT=$((ATTEMPT+1))
done

echo ""
echo "   ✗ Timeout waiting for render to complete"
exit 1
