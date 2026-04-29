#!/usr/bin/env node

/**
 * Test script to verify localStorage rewiring data
 * Run in browser console or use with Node.js if you have localStorage mock
 */

console.log("=== Rewiring Tracker Storage Test ===\n");

try {
  // Get tracker list
  const trackerList = localStorage.getItem("rewiring_tracker_list");
  console.log("📋 Tracker List Key:");
  console.log("   Key: 'rewiring_tracker_list'");
  console.log("   Value:", trackerList);
  
  if (trackerList) {
    const parsed = JSON.parse(trackerList);
    console.log("   Parsed as JSON:", parsed);
    console.log("   Number of trackers:", Array.isArray(parsed) ? parsed.length : "ERROR: not an array");
    
    // Get individual tracker data
    console.log("\n📊 Individual Tracker Data:");
    if (Array.isArray(parsed)) {
      parsed.forEach((tracker, index) => {
        const trackerKey = `rewiring_tracker_${tracker.id}`;
        const trackerData = localStorage.getItem(trackerKey);
        console.log(`   Tracker ${index + 1}: ${tracker.name} (ID: ${tracker.id})`);
        console.log(`     Storage Key: '${trackerKey}'`);
        console.log(`     Data:`, trackerData ? JSON.parse(trackerData) : "NOT FOUND");
      });
    }
  } else {
    console.log("   ⚠️  No tracker list found in localStorage");
  }
  
  // List all localStorage keys
  console.log("\n🔑 All localStorage keys:");
  let rewiringKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes("rewiring")) {
      rewiringKeys.push(key);
      console.log(`   - ${key}`);
    }
  }
  
  if (rewiringKeys.length === 0) {
    console.log("   ⚠️  No rewiring keys found");
  }
  
} catch (error) {
  console.error("❌ Error:", error);
}

console.log("\n=== End of Test ===");
