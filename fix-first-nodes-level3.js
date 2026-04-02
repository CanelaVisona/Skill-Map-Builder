"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./server/db");
const schema_1 = require("@shared/schema");
const drizzle_orm_1 = require("drizzle-orm");
async function fixFirstNodesLevel3() {
    console.log("🔧 Iniciando corrección de primeros nodos (levelPosition=1) en nivel 3+...\n");
    try {
        // Obtener las áreas Intelectual y Programación
        const targetAreas = await db_1.db.select().from(schema_1.areas)
            .where((area) => (0, drizzle_orm_1.eq)(area.name, "Intelectual") || (0, drizzle_orm_1.eq)(area.name, "Programación"));
        if (targetAreas.length === 0) {
            console.log("❌ No se encontraron las áreas 'Intelectual' o 'Programación'");
            process.exit(1);
        }
        console.log(`✓ Áreas encontradas: ${targetAreas.map(a => a.name).join(", ")}\n`);
        let totalFixed = 0;
        for (const area of targetAreas) {
            console.log(`\n📍 Procesando área: ${area.name} (ID: ${area.id})`);
            // Obtener todos los nodos con levelPosition=1 en nivel 3+
            const firstNodesLevel3Plus = await db_1.db.select().from(schema_1.skills)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.skills.areaId, area.id), (0, drizzle_orm_1.eq)(schema_1.skills.levelPosition, 1), (0, drizzle_orm_1.gte)(schema_1.skills.level, 3)));
            if (firstNodesLevel3Plus.length === 0) {
                console.log(`  → No hay nodos con levelPosition=1 en nivel 3+`);
                continue;
            }
            console.log(`  → Encontrados ${firstNodesLevel3Plus.length} nodos a corregir:`);
            for (const skill of firstNodesLevel3Plus) {
                console.log(`    - Nivel ${skill.level}, levelPosition ${skill.levelPosition}: "${skill.title}" → ""`);
                // Actualizar: título vacío, mastered, y marcar como auto-complete
                await db_1.db.update(schema_1.skills).set({
                    title: "",
                    status: "mastered",
                    isAutoComplete: 1
                }).where((0, drizzle_orm_1.eq)(schema_1.skills.id, skill.id));
                totalFixed++;
            }
        }
        console.log(`\n✅ Corrección completada!`);
        console.log(`   Total de nodos corregidos: ${totalFixed}`);
        // Verificación: mostrar los nodos corregidos
        console.log(`\n📋 Verificación de cambios:\n`);
        for (const area of targetAreas) {
            const correctedNodes = await db_1.db.select().from(schema_1.skills)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.skills.areaId, area.id), (0, drizzle_orm_1.eq)(schema_1.skills.levelPosition, 1), (0, drizzle_orm_1.gte)(schema_1.skills.level, 3)));
            if (correctedNodes.length > 0) {
                console.log(`${area.name}:`);
                for (const node of correctedNodes) {
                    console.log(`  ✓ Nivel ${node.level}: title="${node.title}", status="${node.status}", isAutoComplete=${node.isAutoComplete}`);
                }
                console.log();
            }
        }
    }
    catch (error) {
        console.error("❌ Error durante la corrección:", error);
        process.exit(1);
    }
}
fixFirstNodesLevel3().catch(error => {
    console.error("Error fatal:", error);
    process.exit(1);
});
