#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Default commit message if none is provided
COMMIT_MSG="${1:-"Add rules and hands ranking tab to tracker"}"

echo "🚀 Starting publication process..."

# 1. Stage all changes
echo "📦 Staging changes..."
git add .

# 2. Commit changes
echo "💾 Committing changes with message: '$COMMIT_MSG'..."
git commit -m "$COMMIT_MSG"

# 3. Push to current Git branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📤 Pushing code to GitHub on branch '$CURRENT_BRANCH'..."
git push origin "$CURRENT_BRANCH"

# 4. Run Vite build and deploy to GitHub Pages
echo "🔧 Building and deploying to GitHub Pages..."
cd poker-championship
npm run deploy

echo "✅ Publication complete! Your changes are live."
