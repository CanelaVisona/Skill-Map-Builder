import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testLogin() {
  try {
    const username = "cane";
    const password = "kokito";
    
    console.log(`\n=== Testing Login ===`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}\n`);
    
    // Step 1: Get user
    const userResult = await pool.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [username]
    );
    
    if (userResult.rows.length === 0) {
      console.log("❌ User not found");
      return;
    }
    
    const user = userResult.rows[0];
    console.log("✅ User found:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Password hash: ${user.password ? user.password.substring(0, 30) + "..." : "NULL"}`);
    
    // Step 2: Check if password exists
    if (!user.password) {
      console.log("\n❌ User has no password set");
      return;
    }
    
    // Step 3: Verify password
    console.log(`\n✅ Password hash exists, verifying...`);
    const isValid = await bcrypt.compare(password, user.password);
    
    if (isValid) {
      console.log(`✅ PASSWORD VERIFICATION SUCCESS!`);
      console.log(`\nLogin should work with:`);
      console.log(`  Username: ${username}`);
      console.log(`  Password: ${password}`);
    } else {
      console.log(`❌ PASSWORD VERIFICATION FAILED`);
      console.log(`The password "${password}" does not match the stored hash`);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

testLogin();
