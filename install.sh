#!/bin/bash

# CLI Manager MCP Installation Script
set -e

echo "=========================================="
echo "CLI Manager MCP - Installation"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Project directory: $PROJECT_DIR"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js >= 18.0.0 from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js version must be >= 18.0.0${NC}"
    echo "Current version: $(node --version)"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
echo ""

# Install dependencies
echo "Installing dependencies..."
cd "$PROJECT_DIR"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Build the project
echo "Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Determine Claude Desktop config path
echo "Detecting Claude Desktop configuration..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    CLAUDE_CONFIG_DIR="$APPDATA/Claude"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
else
    echo -e "${YELLOW}Warning: Could not detect OS. Please manually configure Claude Desktop.${NC}"
    CLAUDE_CONFIG_FILE="UNKNOWN"
fi

echo -e "${GREEN}✓ Claude Desktop config path: $CLAUDE_CONFIG_FILE${NC}"
echo ""

# Create config directory if needed
if [ -d "$(dirname "$CLAUDE_CONFIG_FILE")" ]; then
    echo "Claude Desktop directory exists"
else
    echo "Creating Claude Desktop directory..."
    mkdir -p "$(dirname "$CLAUDE_CONFIG_FILE")"
fi

# Generate the MCP server configuration
echo ""
echo "=========================================="
echo "Claude Desktop Configuration"
echo "=========================================="
echo ""
echo "Add the following to your Claude Desktop configuration file:"
echo ""
echo "File: $CLAUDE_CONFIG_FILE"
echo ""
echo "---------- CONFIGURATION ----------"
echo ""
echo '{'
echo '  "mcpServers": {'
echo '    "cli-manager": {'
echo '      "command": "node",'
echo "      \"args\": [\"$PROJECT_DIR/dist/index.js\"]"
echo '    }'
echo '  }'
echo '}'
echo ""
echo "---------- END CONFIGURATION ----------"
echo ""

# Check if config file exists and show warning
if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    echo -e "${YELLOW}Note: Config file already exists. Merge the above into your existing 'mcpServers' section.${NC}"
else
    echo -e "${GREEN}Note: Config file does not exist. Create it with the above content.${NC}"
fi

echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "1. Add the configuration above to your Claude Desktop config"
echo "2. Restart Claude Desktop completely (quit and reopen)"
echo "3. Create your project configuration (see config/examples)"
echo "4. Start chatting with Claude about your project!"
echo ""
echo "Quick test command:"
echo "  'Create a test terminal named demo'"
echo ""
echo "Documentation:"
echo "  - Quick Start: docs/QUICK_START.md"
echo "  - Usage Examples: docs/USAGE_EXAMPLES.md"
echo "  - Architecture: docs/ARCHITECTURE.md"
echo ""
echo -e "${GREEN}Installation complete! 🚀${NC}"
echo ""
