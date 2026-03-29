# Designer Level Window Calculation Verification

## Problem
After implementing the fix to set `nextLevelToAssign = level + 3`, there was an inconsistency in how the 5-level Designer window was calculated. The calculation was using a different max-level formula than the rest of the system.

## Root Cause
Three different calculations were using different formulas for the maximum visible level:

1. **SkillDesigner visibility** (line 154, 323, 488, 655):
   ```typescript
   const visibleInSkillTree = area.endOfAreaLevel ?? (area.nextLevelToAssign + 2);
   ```

2. **Server validation** (routes.ts line 1185, 1426):
   ```typescript
   const maxAllowedLevel = existingArea.nextLevelToAssign + 2;
   ```

3. **calculateDesignerLevelWindow** (WRONG):
   ```typescript
   const maxAvailableLevel = endOfAreaLevel ?? (nextLevelToAssign - 1);
   ```

The window function was using `nextLevelToAssign - 1`, which would under-count available levels.

## Solution
Changed `calculateDesignerLevelWindow` to use the same formula as the rest of the system:

```typescript
// Consistent with SkillDesigner visibility
const maxLevelInDesigner = endOfAreaLevel ?? (nextLevelToAssign + 2);
```

## Verification: Window Display Scenarios

### Scenario 1: User Unlocks Level 2
**Setup:**
- User completes final node of Level 1
- Server unlocks Level 2 with: `nextLevelToAssign: level + 3 = 2 + 3 = 5`

**Before Fix (BROKEN):**
```
unlockedLevel = 2
nextLevelToAssign = 5
maxAvailableLevel = 5 - 1 = 4  // TOO SMALL!

windowStart = max(1, 2-1) = 1
windowEnd = 2 + 3 = 5
totalAvailable = 4
Since 4 < 5:
  → windowStart = 1, windowEnd = 4
Result: [1, 2, 3, 4]  // Missing level 5!
```

**After Fix (CORRECT):**
```
unlockedLevel = 2
nextLevelToAssign = 5
maxLevelInDesigner = 5 + 2 = 7  // Matches SkillDesigner rule!

windowStart = max(1, 2-1) = 1
windowEnd = 2 + 3 = 5
totalAvailable = 7
Since 7 >= 5:
  → windowEnd = min(5, 7) = 5, no shift needed
Result: [1, 2, 3, 4, 5]  // Correct 5-level window! ✓
```

### Scenario 2: User in Locked Levels (Level 10/20)
**Setup:**
- User completes Level 9
- Server sets: `nextLevelToAssign: 12`
- User can only play up to: `nextLevelToAssign + 2 = 14`

**With Fix:**
```
unlockedLevel = 10
nextLevelToAssign = 12
maxLevelInDesigner = 14

windowStart = max(1, 10-1) = 9
windowEnd = 10 + 3 = 13
totalAvailable = 14
Since 14 >= 5:
  → windowEnd = min(13, 14) = 13, no shift needed
Result: [9, 10, 11, 12, 13]  // Perfect 5-level window! ✓
```

## Architectural Consistency

### What Each Value Represents

| Value | Meaning | Used For |
|-------|---------|----------|
| `unlockedLevel` | User's current playable level | - Window center point<br/>- What's open in the tree |
| `nextLevelToAssign` | Next level number to CREATE in DB | - Server lookahead (keeps 3 ahead)<br/>- Validation constraint: `maxAllowed = nextLevelToAssign + 2` |
| `visibleInSkillTree` | Max visible level in Designer | - Styling (lock icon, grayscale)<br/>- Window boundary<br/>- Server API validation |
| `windowLevels` | 5-level accordion display | - UI rendering<br/>- Based on `unlockedLevel` as center |

### The Two Separate Calculations

✅ **These are now aligned:**

1. **Window for display** (`calculateDesignerLevelWindow`):
   - Input: `unlockedLevel` (where user is)
   - Calculation: 5 levels centered on unlocked
   - Boundary: Uses `nextLevelToAssign + 2`
   - Output: `[uL-1, uL, uL+1, uL+2, uL+3]` (constrained to visible range)

2. **Level generation control** (server):
   - Input: Level user just unlocked
   - Calculation: Auto-prepare 3 levels ahead
   - Update: `nextLevelToAssign = level + 3`
   - Ensures: Smooth gameplay without waiting for DB generation

These two calculations don't interfere because they operate on different concepts:
- Window = "show 5 levels centered on where user is"
- Generation = "ensure 3 levels of lookahead prepared"

## Files Changed

- [client/src/lib/skill-context.tsx](./client/src/lib/skill-context.tsx)
  - Lines 3890-3930: Fixed `calculateDesignerLevelWindow` to use consistent visibility formula
  - Added comprehensive docstring explaining the relationship

## Testing

✅ Build succeeds: `npm run build` completed without errors

## Summary

The fix ensures:
1. ✅ 5-level window displays correctly (shows [1,2,3,4,5] when user at level 2)
2. ✅ Window doesn't jump ahead based on lookahead level
3. ✅ All three locations using max-level checks now use the same formula
4. ✅ No interference between window display and level generation logic
5. ✅ Designer UI consistency (locked levels shown the same way everywhere)
