# XP Sync Bug Fix - Testing Guide

## Summary of Changes

### Issue
XP added from the skill node modal was not being synchronized with the progress bar in the Quest Diary Skills section.

### Root Causes Identified & Fixed

1. **Missing localStorage initialization in SkillNode**
   - **Problem**: When user first adds XP, if `skillsProgress` doesn't exist in localStorage, `handleAddExperience()` and `handleEditSave()` would fail silently
   - **Fix**: Added code to initialize default skills structure when localStorage is empty
   - **Files**: `client/src/components/SkillNode.tsx`

2. **Stale closure in SkillsSection event listener**
   - **Problem**: The event listener in SkillsSection used `[]` dependency array, meaning `setSkills` was frozen in the initial closure. If the component re-rendered, the listener would still use the old `setSkills` function
   - **Fix**: Added `useRef(setSkills)` and keep it updated via a separate `useEffect`
   - **Files**: `client/src/pages/SkillTree.tsx`

3. **Plain `Event` vs `CustomEvent`**
   - **Problem**: Using `new Event()` doesn't allow passing data
   - **Fix**: Changed to `new CustomEvent()` with detail object
   - **Files**: `client/src/components/SkillNode.tsx` (2 locations)

### Code Changes

#### 1. In `client/src/components/SkillNode.tsx`:

**`handleAddExperience()` - Lines 410-478:**
- Added initialization logic: if `skillsProgress` not in localStorage, creates default skills structure
- Changed event dispatch from `new Event()` to `new CustomEvent()` with detail
- Wrapped in try-catch with better error handling

**`handleEditSave()` - Lines 600-650:**
- Applied same initialization logic and error handling
- Changed event dispatch to `CustomEvent`

#### 2. In `client/src/pages/SkillTree.tsx`:

**SkillsSection component - Around line 2255:**
- Added `setSkillsRef` via `useRef(setSkills)`
- Added `useEffect` to keep the ref updated (no dependency array)
- In the event listener, changed from `setSkills(merged)` to `setSkillsRef.current(merged)`

## Testing Procedure

### Test 1: Fresh App (No stored skills)
1. Clear browser localStorage (delete entry `skillsProgress`)
2. Open app and navigate to SkillTree
3. Click on a skill node
4. Open "Feedback" tab and go to "Experience" tab
5. Select a skill from dropdown
6. Enter XP (e.g., "100")
7. Click "Add" button
8. **Expected**: 
   - XP added animation plays
   - Progress bar in Skills section updates
   - No console errors about "No skillsProgress found in localStorage"

### Test 2: Existing skills
1. Add some XP to a skill (as in Test 1)
2. Refresh page (localStorage persists)
3. Add more XP to same skill
4. **Expected**:
   - Previous XP persists
   - New XP is added on top
   - Progress bar updates correctly

### Test 3: Server sync
1. Add XP through UI
2. Check browser Network tab (or server logs) for POST to `/api/skills-progress`
3. Refresh page
4. **Expected**:
   - XP loads from server (GET `/api/skills-progress`)
   - Shows total XP across sessions

### Test 4: Console logs (Debug)
1. Open DevTools Console
2. Add XP through modal
3. **Expected console logs in this order**:
   ```
   [handleAddExperience] XP to add: 100 Skill: "Guitarra"
   [handleAddExperience] Current localStorage: {...}
   [handleAddExperience] Updated skill: {skillName, oldXp, newXp, oldLevel, newLevel}
   [handleAddExperience] Saved to localStorage, dispatching event
   [handleAddExperience] Saved to server successfully
   [handleAddExperience] Dispatching skillXpAdded event
   [SkillsSection] === skillXpAdded event RECEIVED ===
   [SkillsSection] Current skills state: {...}
   [SkillsSection] localStorage skillsProgress: {...}
   [SkillsSection] Parsed newSkills: {...}
   [SkillsSection] Merged final skills: {...}
   [SkillsSection] About to call setSkills with: {...}
   [SkillsSection] setSkills called ✓
   ```

## Potential Issues Still to Monitor

1. **Timing**: If SkillsSection unmounts/remounts while event listener is attached, could cause issues
2. **Multiple listeners**: If SkillTree renders multiple times, multiple listeners could attach
3. **Server lag**: If server `/api/skills-progress` is slow, UI will update via event but server might take time to persist

## Files Modified

- `client/src/components/SkillNode.tsx` - Added initialization + event bus improvements
- `client/src/pages/SkillTree.tsx` - Fixed stale closure in event listener

## Browser Requirements
- Must support `CustomEvent` (all modern browsers)
- Must support `useRef` hook (React 16.8+)
- localStorage API

## Next Steps if Still Not Working

1. Check if `skillXpAdded` event is actually firing:
   ```javascript
   window.addEventListener('skillXpAdded', () => console.log('EVENT FIRED'));
   ```

2. Check if listener is attached:
   ```javascript
   // In DevTools, when on SkillTree page
   console.log(document._events) // Different in different browsers
   ```

3. Consider moving away from events to Context API for better debugging
