#!/bin/bash

# ============================================
#  AI Childcare & Parenting Assistant
#  Startup Script
# ============================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=4000
FRONTEND_PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${PURPLE}${BOLD}============================================${NC}"
echo -e "${PURPLE}${BOLD}  🍼 AI Childcare & Parenting Assistant${NC}"
echo -e "${PURPLE}${BOLD}============================================${NC}"
echo ""

# ─── CLEAN UP USED PORTS ───
echo -e "${YELLOW}🔧 Cleaning up ports ${BACKEND_PORT} and ${FRONTEND_PORT}...${NC}"

cleanup_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "   Killing processes on port ${port}: ${pids}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

echo -e "${GREEN}   Ports cleaned.${NC}"
echo ""

# ─── CHECK PREREQUISITES ───
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}   ✗ Node.js is not installed. Please install Node.js 18+.${NC}"
  exit 1
fi
echo -e "${GREEN}   ✓ Node.js $(node -v)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}   ✗ npm is not installed.${NC}"
  exit 1
fi
echo -e "${GREEN}   ✓ npm $(npm -v)${NC}"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
  echo -e "${RED}   ✗ PostgreSQL is not installed. Please install PostgreSQL.${NC}"
  exit 1
fi
echo -e "${GREEN}   ✓ PostgreSQL $(psql --version | head -1)${NC}"

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
  echo -e "${YELLOW}   ⚡ Starting PostgreSQL...${NC}"
  if [[ "$(uname)" == "Darwin" ]]; then
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
      echo -e "${RED}   ✗ Could not start PostgreSQL. Please start it manually.${NC}"
      exit 1
    }
  else
    sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || {
      echo -e "${RED}   ✗ Could not start PostgreSQL. Please start it manually.${NC}"
      exit 1
    }
  fi
  sleep 2
fi
echo -e "${GREEN}   ✓ PostgreSQL is running${NC}"
echo ""

# ─── CREATE DATABASE ───
echo -e "${YELLOW}🗄️  Setting up database...${NC}"

# Try to create database (ignore if exists)
createdb childcare_assistant 2>/dev/null && \
  echo -e "${GREEN}   ✓ Database 'childcare_assistant' created${NC}" || \
  echo -e "${GREEN}   ✓ Database 'childcare_assistant' already exists${NC}"
echo ""

# ─── CHECK .env FILE ───
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo -e "${RED}   ✗ .env file not found! Creating default...${NC}"
  cat > "$PROJECT_DIR/.env" << 'ENVEOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/childcare_assistant
JWT_SECRET=childcare-assistant-secret-key-2024
OPENROUTER_API_KEY=your-openrouter-api-key-here
OPENROUTER_MODEL=anthropic/claude-haiku-4.5
BACKEND_PORT=4000
FRONTEND_PORT=3000
ENVEOF
  echo -e "${YELLOW}   ⚠ Please update .env with your OPENROUTER_API_KEY${NC}"
fi
echo -e "${GREEN}   ✓ .env file exists${NC}"
echo ""

# ─── INSTALL BACKEND DEPENDENCIES ───
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}   ✓ Backend dependencies installed${NC}"
echo ""

# ─── INSTALL FRONTEND DEPENDENCIES ───
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}   ✓ Frontend dependencies installed${NC}"
echo ""

# ─── SEED DATABASE ───
echo -e "${YELLOW}🌱 Seeding database...${NC}"
cd "$PROJECT_DIR/backend"
node seed.js
echo -e "${GREEN}   ✓ Database seeded successfully${NC}"
echo ""

# ─── START BACKEND (with hot reload via nodemon) ───
echo -e "${CYAN}🚀 Starting backend server on port ${BACKEND_PORT}...${NC}"
cd "$PROJECT_DIR/backend"
npx nodemon server.js &
BACKEND_PID=$!
sleep 2
echo ""

# ─── START FRONTEND (Vite has HMR built-in) ───
echo -e "${CYAN}🚀 Starting frontend dev server on port ${FRONTEND_PORT}...${NC}"
cd "$PROJECT_DIR/frontend"
npx vite --port $FRONTEND_PORT &
FRONTEND_PID=$!
sleep 2
echo ""

# ─── DONE ───
echo -e "${GREEN}${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}  🎉 Application is running!${NC}"
echo -e "${GREEN}${BOLD}============================================${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}  ${BLUE}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  ${BOLD}Backend:${NC}   ${BLUE}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  ${BOLD}API Health:${NC} ${BLUE}http://localhost:${BACKEND_PORT}/api/health${NC}"
echo ""
echo -e "  ${BOLD}Demo Login:${NC}"
echo -e "    Email:    ${CYAN}demo@childcare.com${NC}"
echo -e "    Password: ${CYAN}password123${NC}"
echo ""
echo -e "  ${YELLOW}Hot reload is enabled:${NC}"
echo -e "    Backend:  nodemon watches for changes"
echo -e "    Frontend: Vite HMR (Hot Module Replacement)"
echo ""
echo -e "  ${RED}Press Ctrl+C to stop all services${NC}"
echo ""

# ─── CLEANUP ON EXIT ───
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down services...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  cleanup_port $BACKEND_PORT
  cleanup_port $FRONTEND_PORT
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for background processes
wait
