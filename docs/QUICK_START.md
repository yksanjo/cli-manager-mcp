# CLI Manager MCP - Quick Start Guide

Get up and running in 5 minutes.

## Prerequisites

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **Claude Desktop** installed ([Download](https://claude.ai/download))

## Step 1: Build the Server

```bash
# Navigate to the project directory
cd cli-manager-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Step 2: Configure Claude Desktop

Add the MCP server to your Claude Desktop configuration:

### macOS

```bash
# Open the config file
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add this to the `mcpServers` object:

```json
{
  "mcpServers": {
    "cli-manager": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cli-manager-mcp/dist/index.js"]
    }
  }
}
```

**Replace `/ABSOLUTE/PATH/TO/` with the actual path.**

Example:
```json
"args": ["/Users/john/projects/cli-manager-mcp/dist/index.js"]
```

### Windows

Edit: `%APPDATA%\Claude\claude_desktop_config.json`

### Linux

Edit: `~/.config/Claude/claude_desktop_config.json`

## Step 3: Restart Claude Desktop

1. **Quit Claude Desktop completely** (Cmd+Q / Alt+F4)
2. **Restart Claude Desktop**

You should now see a 🔧 tool icon in the bottom left when chatting with Claude.

## Step 4: Create Your First Project Config

Copy and customize an example:

```bash
# Copy the single app example
cp config/single-app-example.json config/my-project.json

# Edit it
nano config/my-project.json  # or use your preferred editor
```

**Required changes:**
- `rootPath`: Change to your project's actual path
- `id`: Give it a unique identifier
- `name`: Human-readable name

## Step 5: Load Your Project in Claude

Start a chat with Claude:

```
Load my project from /Users/yourname/projects/cli-manager-mcp/config/my-project.json
```

Claude should respond confirming the project was loaded.

## Step 6: Start Using It!

Try these commands:

```
Set up my project
```

```
Start my project
```

```
What terminals are running?
```

```
Run tests on my project
```

## Example: Full-Stack Project

For a typical full-stack project:

```json
{
  "id": "my-fullstack-app",
  "name": "My Full-Stack App",
  "rootPath": "/Users/me/projects/my-app",
  "architecture": {
    "type": "single-app",
    "services": [
      {
        "name": "backend",
        "path": "backend",
        "startCommand": "npm run dev",
        "envVars": { "PORT": "3001" }
      },
      {
        "name": "frontend",
        "path": "frontend", 
        "startCommand": "npm run dev",
        "envVars": { "VITE_API_URL": "http://localhost:3001" },
        "dependsOn": ["backend"]
      }
    ]
  },
  "setupSteps": [
    { "name": "Install backend deps", "command": "cd backend && npm install" },
    { "name": "Install frontend deps", "command": "cd frontend && npm install" }
  ],
  "commonCommands": {
    "test": "npm test",
    "build": "npm run build"
  }
}
```

## Troubleshooting

### Claude doesn't show the tools

1. Check Claude Desktop config path is correct
2. Ensure the path in config is **absolute**, not relative
3. Make sure you restarted Claude Desktop completely
4. Check Claude Desktop logs for errors

### Commands don't work

1. Verify project `rootPath` is correct
2. Check that service `path` is relative to `rootPath`
3. Test commands manually first

### Build errors

```bash
# Clean and rebuild
rm -rf dist
rm -rf node_modules
npm install
npm run build
```

## Next Steps

1. Read [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for real-world scenarios
2. Check [ARCHITECTURE.md](./ARCHITECTURE.md) to understand how it works
3. Customize your project configs for different environments

## Quick Reference

| You Say | Claude Does |
|---------|-------------|
| "Start my project" | Launches all services in order |
| "Stop my project" | Closes all terminals |
| "Check terminal X output" | Shows recent output |
| "Run tests" | Executes test command |
| "Show all terminals" | Lists active sessions |

---

**You're ready to let Claude manage your terminals! 🚀**
