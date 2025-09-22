#!/bin/bash

# Set strict error handling
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print environment info
print_status "Starting SDK execution with the following environment:"
echo "  Node.js version: $(node -v)"
echo "  pnpm version: $(pnpm -v)"
echo "  RPC_URL: ${RPC_URL}"
echo "  VERBOSE_LEVEL: ${VERBOSE_LEVEL}"
echo "  VERBOSE: ${VERBOSE}"
echo "  Working directory: $(pwd)"

# Verify the build was successful
if [ ! -d "dist" ]; then
    print_error "Build directory not found. Build may have failed."
    exit 1
fi

print_success "Build directory found, proceeding with command execution"

# Create output directory if it doesn't exist
mkdir -p output

# Execute the provided command or default command
if [ $# -eq 0 ]; then
    print_status "Executing default command: pnpm cli fellowship game create 0x4D3A53F1c86b7BfFD95130d469B898f06B3Eb038 -i 1"
    exec pnpm cli fellowship game create 0x4D3A53F1c86b7BfFD95130d469B898f06B3Eb038 -i 1
else
    print_status "Executing custom command: $*"
    exec "$@"
fi
