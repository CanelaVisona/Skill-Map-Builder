#!/usr/bin/env node
/**
 * Test script to verify area creation and level generation
 * Run: node test-area-creation.mjs
 */

const baseURL = "http://localhost:3001";
const testAreaId = `test_area_${Date.now()}`;
const testAreaName = `Test Area ${Date.now()}`;
const testUsername = `testuser_${Date.now()}`;
const testPassword = "test123456";

// Helper to manage cookies
class CookieJar {
  constructor() {
    this.cookies = {};
  }
  
  addCookies(setCookieHeader) {
    if (!setCookieHeader) return;
    const parts = setCookieHeader.split(';')[0].split('=');
    if (parts.length === 2) {
      this.cookies[parts[0]] = parts[1];
    }
  }
  
  getCookieString() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

const cookieJar = new CookieJar();

async function test() {
  try {
    console.log("\n🧪 Testing Area Creation & Level Generation\n");

    // Step 0: Login
    console.log(`0️⃣  Logging in...`);
    const loginResponse = await fetch(`${baseURL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      console.error(`❌ Login failed: ${loginResponse.status}`);
      console.error(error);
      return;
    }

    // Extract cookies from Set-Cookie header
    const setCookies = loginResponse.headers.get('set-cookie');
    if (setCookies) {
      cookieJar.addCookies(setCookies);
    }
    
    console.log(`✅ Logged in`);

    // Step 1: Create area
    console.log(`\n1️⃣  Creating area "${testAreaName}"...`);
    const createResponse = await fetch(`${baseURL}/api/areas`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": cookieJar.getCookieString()
      },
      body: JSON.stringify({
        id: testAreaId,
        name: testAreaName,
        icon: "Music",
        color: "text-zinc-800",
        description: "Test area",
        unlockedLevel: 1,
        nextLevelToAssign: 1
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error(`❌ Failed to create area: ${createResponse.status}`);
      console.error(error);
      return;
    }

    const area = await createResponse.json();
    console.log(`✅ Area created: ${area.id}`);
    console.log(`   - Skills in response: ${area.skills?.length || 0}`);

    // Step 2: Generate level
    console.log(`\n2️⃣  Generating level 1...`);
    const genResponse = await fetch(`${baseURL}/api/areas/${area.id}/generate-level`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": cookieJar.getCookieString()
      },
      body: JSON.stringify({ level: 1 })
    });

    console.log(`   - Response status: ${genResponse.status}`);

    if (!genResponse.ok) {
      const error = await genResponse.text();
      console.error(`❌ Failed to generate level: ${genResponse.status}`);
      console.error(error);
      return;
    }

    const genResult = await genResponse.json();
    const skillCount = genResult.createdSkills?.length || 0;
    
    if (skillCount > 0) {
      console.log(`✅ Level generated with ${skillCount} skills`);
      console.log(`   Skills created:`);
      genResult.createdSkills.forEach((s, i) => {
        console.log(`     ${i + 1}. "${s.title || "(empty)"}" - Status: ${s.status}`);
      });
    } else {
      console.warn(`⚠️  No skills created`);
      console.log(`   Response:`, JSON.stringify(genResult, null, 2));
    }

    console.log(`\n✨ Test completed successfully\n`);

  } catch (error) {
    console.error("❌ Test error:", error.message);
    console.error("\nMake sure the dev server is running on port 3001");
  }
}

test();
