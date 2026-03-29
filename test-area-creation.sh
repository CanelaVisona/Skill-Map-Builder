#!/bin/bash
# Test script for area creation using curl
# Run: bash test-area-creation.sh

BASE_URL="http://localhost:3001"
TEST_AREA_ID="test_area_$(date +%s)"
TEST_AREA_NAME="Test Area $(date +%s)"
TEST_USERNAME="testuser_$(date +%s)"
TEST_PASSWORD="test123456"

echo ""
echo "🧪 Testing Area Creation & Level Generation"
echo ""

# Step 0: Login
echo "0️⃣  Logging in..."
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}")

echo "   Response: $LOGIN_RESPONSE"

# Step 1: Create area
echo ""
echo "1️⃣  Creating area \"$TEST_AREA_NAME\"..."
CREATE_RESPONSE=$(curl -s -b /tmp/cookies.txt -X POST "$BASE_URL/api/areas" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$TEST_AREA_ID\",\"name\":\"$TEST_AREA_NAME\",\"icon\":\"Music\",\"color\":\"text-zinc-800\",\"description\":\"Test area\",\"unlockedLevel\":1,\"nextLevelToAssign\":1}")

echo "   Response: $CREATE_RESPONSE"

AREA_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$AREA_ID" ]; then
  echo "❌ Failed to create area"
  exit 1
fi

echo "✅ Area created: $AREA_ID"

# Step 2: Generate level
echo ""
echo "2️⃣  Generating level 1..."
GEN_RESPONSE=$(curl -s -b /tmp/cookies.txt -X POST "$BASE_URL/api/areas/$AREA_ID/generate-level" \
  -H "Content-Type: application/json" \
  -d '{"level":1}')

echo "   Response: $GEN_RESPONSE"

SKILL_COUNT=$(echo $GEN_RESPONSE | grep -o '"createdSkills":\[' | wc -l)
if [ "$SKILL_COUNT" -eq 1 ]; then
  echo "✅ Level generated successfully"
else
  echo "⚠️  Check the response above"
fi

echo ""
echo "✨ Test completed"
echo ""

# Clean up
rm -f /tmp/cookies.txt
