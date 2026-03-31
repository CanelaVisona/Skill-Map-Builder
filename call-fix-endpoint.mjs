import http from "http";

setTimeout(async () => {
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: "localhost", port: 3001, path: "/api/admin/fix-statuses", method: "POST" },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          });
        }
      );
      req.on("error", reject);
      req.end();
    });

    console.log("\n✅ RESULTADO DEL FIX:");
    console.log(JSON.stringify(response, null, 2));
    
    // Mostrar resumen
    if (response.fixedCount) {
      console.log(`\n✓ Total de nodos corregidos: ${response.fixedCount}`);
      console.log(`✓ Mensaje: ${response.message}`);
    }
  } catch (err) {
    console.error("❌ Error llamando endpoint:", err.message);
  }
  
  process.exit(0);
}, 35000); // 35 segundos para que el servidor esté listo

console.log("⏳ Esperando a que el servidor esté listo (30-35 segundos)...");
