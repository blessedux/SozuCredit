#!/bin/bash
# Clean dev environment and restart Next.js dev server

echo "🧹 Cleaning Next.js dev environment..."

# Kill any running Next.js processes
echo "Killing existing Next.js processes..."
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "node.*next" 2>/dev/null || true
sleep 1

# Kill processes on ports 3000 and 3001
echo "Freeing up ports 3000 and 3001..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1

# Remove lock files and .next directory
echo "Removing lock files and .next directory..."
rm -f .next/dev/lock 2>/dev/null || true
rm -rf .next 2>/dev/null || true

echo "✅ Clean complete! You can now run 'npm run dev'"
