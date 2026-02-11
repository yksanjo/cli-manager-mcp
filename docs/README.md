# CLI Manager MCP - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Available Tools](#available-tools)
5. [Project Configuration Format](#project-configuration-format)
6. [Usage Examples](#usage-examples)
7. [Troubleshooting](#troubleshooting)

## Overview

CLI Manager MCP is a Model Context Protocol (MCP) server that enables Claude to intelligently manage your terminal sessions and remember your project architectures.

### What It Does

- **Manages multiple terminal windows** - Create, control, and monitor terminals
- **Remembers project structure** - Load configurations that define your services
- **Automates setup workflows** - Run complex setup sequences with one command
- **Handles service dependencies** - Start services in correct order
- **Provides unified interface** - Control everything through natural language with Claude

### Why Use It?

**Before:**
- Open 5+ terminal windows manually
- Remember which terminal runs what
- Run setup commands repeatedly
- Switch between terminals constantly
- Forget project-specific commands

**After:**
- "Start my project" → Everything launches automatically
- "Run tests" → Tests execute across all services
- "Check the logs" → Claude shows relevant output
- "Deploy to staging" → One command deployment

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Claude Desktop

### Step-by-Step

1. **Install dependencies:**
   ```bash
   cd cli-manager-mcp
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Configure Claude Desktop:**

   Add to your Claude Desktop config:

   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   **Linux:** `~/.config/Claude/claude_desktop_config.json`

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

4. **Restart Claude Desktop**

5. **Verify:**
   You should see a 🔧 tool icon in Claude's chat interface.

## Configuration

### Creating Your Project Config

Create a JSON file defining your project:

```json
{
  "id": "my-project",
  "name": "My Project",
  "rootPath": "/absolute/path/to/project",
  "architecture": {
    "type": "single-app",
    "services": [
      {
        "name": "app",
        "path": ".",
        "startCommand": "npm run dev"
      }
    ]
  },
  "setupSteps": [
    {
      "name": "Install dependencies",
      "command": "npm install"
    }
  ],
  "commonCommands": {
    "test": "npm test",
    "build": "npm run build"
  }
}
```

### Loading Your Project

In Claude:
```
Load my project from /path/to/config.json
```

## Available Tools

### Terminal Management

| Tool | Description |
|------|-------------|
| `create_terminal` | Create a new terminal session |
| `execute_command` | Execute command in specific terminal |
| `list_terminals` | List all active terminals |
| `get_terminal_output` | Get output from a terminal |
| `close_terminal` | Close a terminal session |
| `send_input` | Send input to interactive process |

### Project Management

| Tool | Description |
|------|-------------|
| `load_project` | Load project from config file |
| `list_projects` | List all loaded projects |
| `get_project_info` | Get project details |
| `setup_project` | Run setup steps |
| `start_project` | Start all services |
| `stop_project` | Stop all project terminals |
| `execute_project_command` | Run common command |
| `execute_service_command` | Run service-specific command |
| `check_dependencies` | Check required dependencies |

## Project Configuration Format

### Full Schema

```typescript
interface ProjectConfig {
  // Unique identifier
  id: string;
  
  // Display name
  name: string;
  
  // Absolute path to project root
  rootPath: string;
  
  // Architecture definition
  architecture: {
    // Architecture type
    type: "microservices" | "monorepo" | "single-app" | "modular";
    
    // Service definitions
    services: Array<{
      // Service name
      name: string;
      
      // Path relative to rootPath
      path: string;
      
      // Start command (optional)
      startCommand?: string;
      
      // Build command (optional)
      buildCommand?: string;
      
      // Test command (optional)
      testCommand?: string;
      
      // Environment variables
      envVars?: Record<string, string>;
      
      // Services that must start first
      dependsOn?: string[];
    }>;
  };
  
  // Setup workflow
  setupSteps: Array<{
    // Step name
    name: string;
    
    // Command to execute
    command: string;
    
    // Description (optional)
    description?: string;
    
    // Working directory relative to rootPath (optional)
    workingDir?: string;
    
    // Allow this step to fail (optional)
    allowFailure?: boolean;
  }>;
  
  // Frequently used commands
  commonCommands: Record<string, string>;
  
  // Required dependencies (optional)
  dependencies?: {
    node?: string;      // Node.js version requirement
    python?: string;    // Python version requirement
    docker?: boolean;   // Docker required
    redis?: boolean;    // Redis required
    postgres?: boolean; // PostgreSQL required
    mongodb?: boolean;  // MongoDB required
    custom?: string[];  // Custom requirements
  };
  
  // Metadata (optional)
  metadata?: {
    description?: string;
    version?: string;
    createdAt?: string;
  };
}
```

### Examples

See the `config/` directory for complete examples:
- `microservices-example.json` - Multi-service architecture
- `monorepo-example.json` - Turborepo setup
- `single-app-example.json` - Simple single application

## Usage Examples

### Starting Development

```
You: Start my project
Claude: ✓ Loaded project configuration
        ✓ Created 3 terminal sessions
        ✓ Database running on port 5432
        ✓ API server on port 3001
        ✓ Frontend on port 3000
```

### Running Tests

```
You: Run tests for my project
Claude: ✓ Running tests...
        
        Results:
        - API: 24 tests passed ✓
        - Frontend: 18 tests passed ✓
        
        All tests passing!
```

### Checking Logs

```
You: Check the API logs
Claude: [Shows recent API terminal output]
```

### Debugging

```
You: Why is the backend failing?
Claude: Looking at the backend terminal output...
        
        Error: Cannot connect to database
        
        The database might not be running. 
        Should I start it?
```

## Troubleshooting

### Server Won't Start

**Problem:** Build errors or missing dependencies

**Solution:**
```bash
rm -rf dist node_modules
npm install
npm run build
```

### Claude Doesn't Show Tools

**Problem:** Configuration not recognized

**Solutions:**
1. Verify config path is **absolute** (not relative)
2. Ensure proper JSON syntax
3. Restart Claude Desktop completely
4. Check logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

### Commands Fail

**Problem:** Commands don't execute properly

**Solutions:**
1. Verify `rootPath` is correct absolute path
2. Check service `path` is relative to `rootPath`
3. Test commands manually first
4. Check terminal output with `get_terminal_output`

### Terminal Output Not Captured

**Problem:** Can't see what happened

**Solution:**
- Terminal output is captured but buffered (last 1000 lines)
- Use `get_terminal_output` with appropriate `lines` parameter
- Wait a moment after command execution before checking output

### Permission Errors

**Problem:** Commands fail with permission denied

**Solution:**
- Terminal runs with your user permissions
- Use `sudo` in commands if needed (not recommended)
- Fix file permissions: `chmod +x script.sh`

### Windows Issues

**Problem:** Commands don't work on Windows

**Solutions:**
1. Use WSL2 (Windows Subsystem for Linux)
2. Use PowerShell-compatible commands
3. Adjust paths (use forward slashes)

## Advanced Topics

### Custom Architecture Types

Extend the server to support custom types by modifying the TypeScript types and adding handlers.

### Environment-Specific Configs

Create multiple configs:
- `project.dev.json` - Development
- `project.staging.json` - Staging
- `project.prod.json` - Production

### Programmatic Usage

You can also use the underlying functions directly:

```typescript
import { loadProjectConfig, createTerminal } from './cli-manager';

const project = await loadProjectConfig('/path/to/config.json');
const terminal = createTerminal('my-terminal', project.rootPath);
```

### Integration with CI/CD

Use the same configs in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Setup Project
  run: npx cli-manager setup --config project.json

- name: Run Tests
  run: npx cli-manager execute --config project.json --command test
```

## Best Practices

1. **Use absolute paths** in configurations
2. **Test commands manually** before adding to config
3. **Define dependencies** for correct startup order
4. **Use descriptive names** for services and terminals
5. **Keep configs in version control**
6. **Document custom commands** in `commonCommands`
7. **Set environment variables** per-service when needed

## Getting Help

- Check [QUICK_START.md](./QUICK_START.md) for setup help
- See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for real-world scenarios
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand how it works

## Contributing

This is an open-source project. Contributions welcome!

## License

MIT License - See LICENSE file for details
