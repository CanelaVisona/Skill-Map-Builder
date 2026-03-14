import { insertHabitSchema } from "@shared/schema";

// Test what the schema expects
const testData = {
  userId: "test-user-id",
  emoji: "⭐",
  name: "Mi Hábito",
  description: "Descripción del hábito"
};

try {
  const result = insertHabitSchema.parse(testData);
  console.log("✅ Validation passed!");
  console.log("Result:", result);
} catch (error: any) {
  console.error("❌ Validation failed!");
  if (error.errors) {
    console.error("Errors:", error.errors);
  } else {
    console.error(error.message);
  }
}
