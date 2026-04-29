# Rewiring Tracker Debugging Guide

## Issue
Previously created rewirings are not displaying in the UI even though they're saved in localStorage.

## Fix Applied
Updated the tracker selection logic in `reloadTrackers()` to always select the first tracker after loading data from localStorage or API.

**Key Changes:**
- Removed conditional check `!selectedTrackerId` that was preventing tracker selection
- Now reliably sets first tracker as selected after data loads
- Added enhanced console logging for debugging

## How to Verify the Fix

### Step 1: Check Browser Console
1. Open your app in the browser
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. Open the RewiringTracker modal (click the Circle icon)
5. Watch for these log messages (they appear in order):
   ```
   [Rewiring] Component mounted, calling reloadTrackers
   [Rewiring] Starting reloadTrackers
   [Rewiring] Storage list from localStorage: [...]
   [Rewiring] Loaded trackers from localStorage: [...]
   [Rewiring] Loaded tracker {id} data: {...}
   [Rewiring] Selected first tracker from localStorage: {id}
   ```

### Step 2: Check localStorage Data
1. Still in Developer Tools
2. Go to **Application** (or **Storage** on some browsers) tab
3. In the left panel, find **Local Storage**
4. Click on your app's domain
5. Look for these keys:
   - `rewiring_tracker_list` - Should contain an array of tracker objects with `id` and `name`
   - `rewiring_tracker_*` - Individual tracker data files (one per tracker ID)

### Step 3: Test Creating a New Tracker
1. Click the "Crear rastreador" button in RewiringTracker modal
2. Enter a name (e.g., "Test Tracker 123")
3. Click Create
4. Watch the console for: `[Rewiring] Tracker created and saved: ...`
5. Close the modal (press ESC or click outside)
6. Reopen the modal (click Circle icon again)
7. **The tracker should appear in the list**

### Step 4: Test Closing and Reopening
1. Create a tracker if you haven't already
2. Close the RewiringTracker modal
3. Reopen it
4. **Verify the tracker still appears** and is selected

## Expected Behavior After Fix

✅ When opening RewiringTracker:
- Component mounts and loads data
- Data is retrieved from localStorage first
- First tracker is automatically selected
- Trackers appear in the list

✅ When creating a tracker:
- Data is saved to localStorage with timestamp-based ID
- Console shows creation confirmation
- List updates immediately

✅ When closing and reopening:
- All previously created trackers reappear
- First tracker is selected automatically

## If Trackers Still Don't Appear

1. **Check console for errors**: Look for any red error messages in console
2. **Verify localStorage exists**: Run this in console:
   ```javascript
   console.log(Object.keys(localStorage)
     .filter(k => k.includes('rewiring')))
   ```
   Should show at least `rewiring_tracker_list`

3. **Check data format**: In console, run:
   ```javascript
   console.log(JSON.parse(localStorage.getItem('rewiring_tracker_list')))
   ```
   Should show an array like: `[{id: "local_...", name: "Test"}, ...]`

4. **Force reload localStorage**: Open console and paste:
   ```javascript
   const list = JSON.parse(localStorage.getItem('rewiring_tracker_list') || '[]');
   console.log('Trackers:', list);
   ```

## Files Modified
- `client/src/components/RewiringTracker.tsx`
  - Lines 176-268: reloadTrackers() with enhanced logging
  - Lines 269-276: useEffect hook with mount/unmount logging
  - Lines 461-465: handleCreateTracker with creation logging

## Build Status
✅ Build successful - ready to deploy
- No TypeScript errors
- All modules compiled

## Next Action
Deploy the latest build and follow the verification steps above. If issues persist, check the browser console for error messages.
