# Dev Server Fix Guide

## Problem
- Lock file preventing Next.js dev server from starting
- Port conflicts (3000/3001 already in use)
- Multiple Next.js processes running

## Solution Applied

### 1. Cleaned Up Running Processes
- Killed existing Next.js processes
- Freed up ports 3000 and 3001
- Removed stale lock files

### 2. Updated Configuration
- Added `turbo.root` to `next.config.mjs` to fix workspace root warning
- This silences the "multiple lockfiles" warning

### 3. Created Helper Script
- `scripts/dev-clean.sh` - Cleans dev environment
- `npm run dev:clean` - Quick command to clean and restart

## Usage

### Normal Start
```bash
npm run dev
```

### Clean Start (if you have issues)
```bash
npm run dev:clean
```

### Manual Clean
```bash
# Kill processes
pkill -f "next dev"

# Free ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Remove lock
rm -f .next/dev/lock

# Start fresh
npm run dev
```

## Server Status
✅ Dev server should now be running on:
- http://localhost:3000 (or 3001 if 3000 is busy)

## Troubleshooting

If you still have issues:

1. **Check for running processes:**
   ```bash
   ps aux | grep "next dev"
   lsof -ti:3000,3001
   ```

2. **Full clean:**
   ```bash
   rm -rf .next
   npm run dev
   ```

3. **Check for other Node processes:**
   ```bash
   pkill -f node
   # Then restart
   npm run dev
   ```
