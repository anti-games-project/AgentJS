#!/bin/bash

# AgentJS GitHub Deployment Script
# Usage: ./deploy-to-github.sh [repository-url] [commit-message]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 AgentJS GitHub Deployment Script${NC}"
echo "======================================"

# Check if repository URL is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Repository URL not provided${NC}"
    echo "Usage: ./deploy-to-github.sh <repository-url> [commit-message]"
    echo "Example: ./deploy-to-github.sh https://github.com/username/agentjs-core.git \"Initial commit\""
    exit 1
fi

REPO_URL=$1
COMMIT_MSG=${2:-"Deploy AgentJS Core Framework v1.0.1"}

# Initialize git if not already initialized
if [ ! -d .git ]; then
    echo -e "${YELLOW}Initializing git repository...${NC}"
    git init
    echo -e "${GREEN}✓ Git repository initialized${NC}"
else
    echo -e "${GREEN}✓ Git repository already initialized${NC}"
fi

# Check if remote origin exists
if git remote | grep -q "origin"; then
    echo -e "${YELLOW}Updating remote origin...${NC}"
    git remote set-url origin "$REPO_URL"
else
    echo -e "${YELLOW}Adding remote origin...${NC}"
    git remote add origin "$REPO_URL"
fi
echo -e "${GREEN}✓ Remote origin set to: $REPO_URL${NC}"

# Clean build directory for fresh deployment
echo -e "${YELLOW}Cleaning build artifacts...${NC}"
npm run clean 2>/dev/null || true

# Build the project
echo -e "${YELLOW}Building project...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

# Add all files respecting .gitignore
echo -e "${YELLOW}Staging files...${NC}"
git add .
echo -e "${GREEN}✓ Files staged${NC}"

# Show status
echo -e "${YELLOW}Git status:${NC}"
git status --short

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "$COMMIT_MSG" || {
    echo -e "${YELLOW}No changes to commit or already committed${NC}"
}

# Set main branch
git branch -M main

# Push to GitHub
echo -e "${YELLOW}Pushing to GitHub...${NC}"
echo -e "${YELLOW}This may ask for your GitHub credentials...${NC}"

# Try to push, force if necessary for initial push
git push -u origin main || {
    echo -e "${YELLOW}Regular push failed, trying force push for initial deployment...${NC}"
    read -p "Force push to main branch? This will overwrite remote. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push -u origin main --force
    else
        echo -e "${RED}Push cancelled${NC}"
        exit 1
    fi
}

echo -e "${GREEN}✅ Successfully deployed to GitHub!${NC}"
echo -e "${GREEN}Repository: $REPO_URL${NC}"
echo -e "${GREEN}Branch: main${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Visit your GitHub repository"
echo "2. Add a description and topics"
echo "3. Create releases for version management"
echo "4. Set up GitHub Actions for CI/CD (optional)"
echo "5. Configure GitHub Pages for documentation (optional)"