#!/bin/bash

# Test the habit creation endpoint
TOKEN="test-token"  # You may need to replace this with a real session token

curl -X POST http://localhost:3001/api/habits \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$TOKEN" \
  -d '{
    "emoji": "⭐",
    "name": "Meditación",
    "description": "Meditación diaria"
  }' \
  -v
