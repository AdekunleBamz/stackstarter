#!/usr/bin/env bash

# Stackstarter Setup Script

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

print_info "Setting up Stackstarter..."

if ! command_exists node; then
  print_warning "Node.js not found. Install Node.js 10+ to run tests."
else
  print_success "Node.js found."
fi

if command_exists npm; then
  print_info "Installing dependencies..."
  npm install
  print_success "Dependencies installed."
else
  print_warning "npm not found. Install npm to proceed."
fi

if [[ ! -f ".env" ]]; then
  cat > .env << EOF
# Stackstarter env
NODE_ENV=development
EOF
  print_success ".env created."
else
  print_info ".env already exists."
fi

print_success "Setup complete."
echo ""
print_info "Next steps:"
echo "  1. Run tests: make test"