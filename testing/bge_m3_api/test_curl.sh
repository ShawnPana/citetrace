#!/bin/bash

# Configuration - Change these values
API_URL="https://bge-m3-api-1055631535125.us-central1.run.app"
API_KEY="your-api-key-here"  # Replace with your actual API key

# First test the health endpoint
echo "Testing health endpoint..."
curl -s "${API_URL}/health" | jq .

# Then test the encode endpoint
echo -e "\nTesting encode endpoint..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"texts": ["This is a test."]}' \
  "${API_URL}/encode" | jq .

# If jq isn't available, the raw response will be shown
# If the response isn't valid JSON, you'll see the parsing error
