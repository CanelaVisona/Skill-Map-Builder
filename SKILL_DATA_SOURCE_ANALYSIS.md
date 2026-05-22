# Skill Data Source Analysis - Música Area Skills

## Summary
The specific skills "Dominar las escalas mayores" and "Ritmos con corchea" **do not appear in the codebase**. They are stored exclusively in the **PostgreSQL database** as user-created data. All hardcoded skill data and references are documented below.

---

## Where Skills Come From

### 1. **Database (Primary Source)**
Skills are stored in the `global_skills` table in PostgreSQL. The data flows:
- **File:** [shared/schema.ts](shared/schema.ts#L182-L202)
- **Table Name:** `global_skills`
- **Columns:** `id`, `userId`, `name`, `areaId`, `projectId`, `parentSkillId`, `currentXp`, `level`, `goalXp`, `completed`, `completedAt`, `createdAt`, `updatedAt`

**Example Structure:**
```typescript
export const globalSkills = pgTable("global_skills", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),  // ← Where "Dominar las escalas mayores" is stored
  areaId: varchar("area_id").references(() => areas.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  parentSkillId: varchar("parent_skill_id"),
  currentXp: integer("current_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  goalXp: integer("goal_xp").notNull().default(0),
  completed: integer("completed").$type<0 | 1>().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

---

## Journal Dialog Skills Tab Integration

### **Component Hierarchy**
```
SkillTree.tsx
└── Journal Dialog (isDiaryOpen)
    └── TabsContent value="skills"
        └── SkillsGridJournal (skillId="")
            └── Fetches /api/global-skills/area/:areaId
```

### **Key Files**

#### 1. **SkillTree.tsx** - Journal Dialog & Skills Tab
- **File:** [client/src/pages/SkillTree.tsx](client/src/pages/SkillTree.tsx)
- **Location:** Lines 6044-6072

**Code:**
```tsx
<TabsTrigger 
  value="skills" 
  className="..." 
  title="Skills">
  <BookOpen className="h-5 w-5" />
</TabsTrigger>

// ... later ...

<TabsContent value="skills" className="flex-1 min-h-0 min-w-0 mt-0">
  <SkillsGridJournal skillId="" />
</TabsContent>
```

#### 2. **SkillsGridJournal.tsx** - Skills Grid Display
- **File:** [client/src/components/SkillsGridJournal.tsx](client/src/components/SkillsGridJournal.tsx)
- **Fetches:** `GET /api/global-skills/area/:areaId`

**Code Snippet (lines 100-114):**
```typescript
const { data: globalSkillsForArea = [] } = useQuery<GlobalSkillData[]>({
  queryKey: ["global-skills-area", displayAreaId],
  queryFn: async () => {
    if (!displayAreaId) return [];
    const res = await fetch(`/api/global-skills/area/${displayAreaId}`);
    return res.json();  // ← Returns database records including custom skill names
  },
  enabled: !!displayAreaId,
});
```

---

## API Routes That Serve Skills

### **File:** [server/routes.ts](server/routes.ts#L3015-L3130)

#### Route 1: Get All Global Skills
```
GET /api/global-skills
Auth: Required
Returns: GlobalSkill[]
```
**Lines 3050-3062**

#### Route 2: Get Global Skills by Area ⭐ (Used by Journal)
```
GET /api/global-skills/area/:areaId
Auth: Required
Returns: GlobalSkill[]
```
**Lines 3023-3035**

Example with Música area:
```
GET /api/global-skills/area/msica
```

**Implementation:**
```typescript
app.get("/api/global-skills/area/:areaId", requireAuth, async (req, res) => {
  try {
    const skills = await storage.getGlobalSkillsByArea(req.userId!, req.params.areaId);
    res.json(skills);  // ← Returns database records
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      res.json([]);
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});
```

---

## Hardcoded/Mock Skill Data (Non-Journal)

### **1. Client-Side Mock Data (Legacy)**
- **File:** [client/src/data/skills.ts](client/src/data/skills.ts#L1-100)
- **Usage:** Legacy/demo purposes (NOT used in Journal dialog)
- **Data Structure:** `INITIAL_AREAS` array

**Hardcoded Skills:**
```typescript
const INITIAL_AREAS: Area[] = [
  {
    id: "guitar",
    name: "Guitarra",
    icon: Music,
    color: "text-zinc-800 dark:text-zinc-200",
    description: "Dominio del instrumento y teoría musical.",
    skills: [
      { id: "g1", title: "Acordes Básicos", description: "Aprender C, D, E, G, A", status: "mastered", x: 50, y: 100, dependencies: [] },
      { id: "g2", title: "Ritmo 4/4", description: "Rasgueo básico abajo-arriba", status: "mastered", x: 50, y: 250, dependencies: ["g1"] },
      { id: "g3", title: "Escala Pentatónica", description: "Posición 1 en Am", status: "available", x: 50, y: 400, dependencies: ["g2"] },
      { id: "g4", title: "Acordes con Cejilla", description: "Dominar F y Bm", status: "locked", x: 50, y: 550, dependencies: ["g3"] },
      { id: "g5", title: "Improvisación", description: "Solos básicos sobre Blues", status: "locked", x: 50, y: 700, dependencies: ["g4"] },
    ]
  },
  // ... football, literature, house areas ...
];
```

### **2. Server Seed Data (Initial DB Population)**
- **File:** [server/seed.ts](server/seed.ts#L1-100)
- **Usage:** Database initialization on first run
- **Note:** Only seeds initial users/areas if database is empty

**Hardcoded Skills for Guitar:**
```typescript
const INITIAL_SKILLS = [
  { id: "g1", areaId: "guitar", title: "Acordes Básicos", description: "Aprender C, D, E, G, A", status: "mastered", x: 50, y: 100, dependencies: [], manualLock: 0 },
  { id: "g2", areaId: "guitar", title: "Ritmo 4/4", description: "Rasgueo básico abajo-arriba", status: "mastered", x: 50, y: 250, dependencies: ["g1"], manualLock: 0 },
  { id: "g3", areaId: "guitar", title: "Escala Pentatónica", description: "Posición 1 en Am", status: "available", x: 50, y: 400, dependencies: ["g2"], manualLock: 0 },
  { id: "g4", areaId: "guitar", title: "Acordes con Cejilla", description: "Dominar F y Bm", status: "locked", x: 50, y: 550, dependencies: ["g3"], manualLock: 0 },
  { id: "g5", areaId: "guitar", title: "Improvisación", description: "Solos básicos sobre Blues", status: "locked", x: 50, y: 700, dependencies: ["g4"], manualLock: 0 },
  // ... football, literature, house skills ...
];
```

---

## Known Música Area Skills (From Scripts)

These are referenced in database maintenance scripts:

### **cleanup-music-skills.mjs**
- **File:** [cleanup-music-skills.mjs](cleanup-music-skills.mjs)
- **Lines 24:** Shows expected Music area skills
```javascript
const correctSkillNames = ["Aprender sobre música", "Reconocer las notas sobre el mástil"];
```

### **fix-music-skills.mjs**
- **File:** [fix-music-skills.mjs](fix-music-skills.mjs)
- Queries and updates "Reconocer las notas sobre el mástil" skill in database

---

## Storage/Backend Implementation

### **File:** [server/storage.ts](server/storage.ts#L1460-L1510)

**Method: `getGlobalSkillsByArea(userId, areaId)`**
```typescript
async getGlobalSkillsByArea(userId: string, areaId: string): Promise<GlobalSkill[]> {
  // Get skills that belong to this area (including subskills whose parent belongs to this area)
  const allUserSkills = await this.getGlobalSkills(userId);
  const areaSkills = allUserSkills.filter(s => s.areaId === areaId);
  const areaSkillIds = new Set(areaSkills.map(s => s.id));
  // Include subskills of area skills
  const subSkills = allUserSkills.filter(s => s.parentSkillId && areaSkillIds.has(s.parentSkillId));
  return [...areaSkills, ...subSkills];
}
```

This method retrieves user-specific skills from the database (including custom ones like "Dominar las escalas mayores").

---

## Skill Context (Client-Side State Management)

### **File:** [client/src/lib/skill-context.tsx](client/src/lib/skill-context.tsx)

**GlobalSkill Interface (lines 40-65):**
```typescript
export interface GlobalSkill {
  id: string;
  userId: string;
  name: string;  // ← This field contains custom skill names
  areaId?: string | null;
  projectId?: string | null;
  parentSkillId?: string | null;
  currentXp: number;
  level: number;
  goalXp: number;
  completed: boolean | number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Key Methods:**
- `refetchGlobalSkills()` - Fetches from `GET /api/global-skills`
- `getGlobalSkillsForArea(areaId)` - Filters in-memory skills
- `createGlobalSkill(name, areaId?, projectId?)` - Creates new skills via POST

---

## Where to Check for Specific Skill Data

If you need to find where "Dominar las escalas mayores" and "Ritmos con corchea" are stored:

### **Option 1: Database Query**
```sql
SELECT * FROM global_skills WHERE name LIKE '%Dominar%' OR name LIKE '%corchea%';
```

### **Option 2: Browser Network Tab**
1. Open Journal dialog (Skills tab)
2. Open DevTools → Network tab
3. Look for request to `/api/global-skills/area/msica`
4. The response JSON will contain the skill records with their names

### **Option 3: Application State**
In browser console:
```javascript
// Get the global skills from context
window.skillTreeContext?.globalSkills?.filter(s => s.areaId === 'msica')
```

---

## Summary Table

| Aspect | Location | Format | Used By |
|--------|----------|--------|---------|
| **Database Schema** | `shared/schema.ts#L182-L202` | TypeScript/Drizzle ORM | Server |
| **API Endpoint** | `server/routes.ts#L3023-3035` | Express route | Client (SkillsGridJournal) |
| **Journal Dialog** | `client/src/pages/SkillTree.tsx#L6044-6072` | React component | User UI |
| **Skills Grid** | `client/src/components/SkillsGridJournal.tsx#L100-114` | React component | Journal Dialog |
| **Storage Layer** | `server/storage.ts#L1470-1475` | TypeScript class | API routes |
| **Client Context** | `client/src/lib/skill-context.tsx#L40-65` | React context | All client components |
| **Mock Data** | `client/src/data/skills.ts#L25-100` | TypeScript object | Legacy/demo |
| **Seed Data** | `server/seed.ts#L30-45` | TypeScript array | DB initialization |

---

## Data Flow Diagram

```
User Creates Skill in Journal Dialog
         ↓
  POST /api/global-skills
  Body: { name: "Dominar las escalas mayores", areaId: "msica" }
         ↓
  server/routes.ts (POST handler)
         ↓
  server/storage.ts (createGlobalSkill)
         ↓
  PostgreSQL: global_skills table
         ↓
  User Opens Journal → Skills Tab
         ↓
  SkillsGridJournal fetches
  GET /api/global-skills/area/msica
         ↓
  server/storage.ts (getGlobalSkillsByArea)
         ↓
  PostgreSQL query
         ↓
  Returns array of GlobalSkill objects
  Including { id, name: "Dominar las escalas mayores", ... }
         ↓
  Renders in skill grid
```

---

## Conclusion

The skills "Dominar las escalas mayores" and "Ritmos con corchea" are **user-created custom skills** stored in the PostgreSQL database. They:

1. ❌ **NOT** hardcoded in application files
2. ❌ **NOT** in seed data or mock data
3. ✅ **ARE** in the `global_skills` database table
4. ✅ **ARE** retrieved via `/api/global-skills/area/msica` API
5. ✅ **ARE** displayed in the Journal dialog's Skills tab via `SkillsGridJournal` component
6. ✅ **CAN** be created/updated/deleted through the app's UI or API
