import pkg from "pg";
const { Client } = pkg;

async function checkCorruptNodes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Checking for corrupt nodes (levelPosition > 1 with empty titles)...\n");
    
    const result = await client.query(`
      SELECT 
        area_id, 
        level, 
        level_position, 
        id, 
        title, 
        status,
        is_auto_complete
      FROM skills
      WHERE level_position > 1
      AND area_id IS NOT NULL
      AND (title = '' OR title IS NULL)
      AND is_auto_complete != 1
      ORDER BY area_id, level, level_position
    `);
    
    const corruptNodes = result.rows;
    
    if (corruptNodes.length === 0) {
      console.log("✓ No corrupt nodes found!");
    } else {
      console.log(`Found ${corruptNodes.length} corrupt nodes:\n`);
      corruptNodes.forEach((node, idx) => {
        console.log(`${idx + 1}. Area: ${node.area_id}, Level: ${node.level}, Position: ${node.level_position}`);
        console.log(`   ID: ${node.id}`);
        console.log(`   Title: "${node.title}", Status: ${node.status}\n`);
      });
    }
    
    await client.end();
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkCorruptNodes();
