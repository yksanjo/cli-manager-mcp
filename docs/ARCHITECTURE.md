# CLI Manager MCP - Architecture

Understanding how the system works.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│                    (Claude Desktop)                         │
└───────────────────────┬─────────────────────────────────────┘
                        │ Natural Language
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Protocol                             │
│              (Model Context Protocol)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │ JSON-RPC over stdio
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              CLI Manager MCP Server                         │
│                   (This Server)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐        │
│  │  Terminal   │  │   Project   │  │   Resource   │        │
│  │  Manager    │  │   Manager   │  │   Provider   │        │
│  └──────┬──────┘  └─────────────┘  └──────────────┘        │
└─────────┼───────────────────────────────────────────────────┘
          │ node-pty
          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Terminal Sessions                         │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │Service1│ │Service2│ │Service3│ │Database│ │ Worker │   │
│  │Terminal│ │Terminal│ │Terminal│ │Terminal│ │Terminal│   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. MCP Server Core

The server implements the Model Context Protocol:

```typescript
const server = new Server(
  { name: "cli-manager-mcp", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);
```

**Responsibilities:**
- Handle incoming requests from Claude
- Route to appropriate handlers
- Return structured responses
- Manage lifecycle

### 2. Terminal Manager

Creates and manages actual terminal processes:

```typescript
interface TerminalSession {
  id: string;
  name: string;
  process: pty.IPty;      // node-pty process
  output: string[];       // Rolling buffer of output
  cwd: string;
  createdAt: Date;
  commandHistory: string[];
}
```

**Key Features:**
- Spawns real PTY processes (not just exec)
- Captures output in real-time
- Maintains working directory
- Supports interactive programs
- Persists across Claude sessions

### 3. Project Configuration

JSON-based project definitions:

```typescript
interface ProjectConfig {
  id: string;
  name: string;
  rootPath: string;
  architecture: {
    type: "microservices" | "monorepo" | "single-app";
    services: ProjectService[];
  };
  setupSteps: ProjectSetupStep[];
  commonCommands: Record<string, string>;
}
```

**Benefits:**
- Declarative project structure
- Version control friendly
- Shareable across team
- Environment-specific overrides

### 4. Tools

Available Claude tools (20 total):

| Category | Tool | Purpose |
|----------|------|---------|
| Terminal | `create_terminal` | Spawn new terminal |
| Terminal | `execute_command` | Run command in terminal |
| Terminal | `list_terminals` | Show active sessions |
| Terminal | `get_terminal_output` | Read terminal output |
| Terminal | `close_terminal` | Kill terminal session |
| Terminal | `send_input` | Interactive input |
| Project | `load_project` | Load config file |
| Project | `list_projects` | Show loaded projects |
| Project | `get_project_info` | Project details |
| Project | `setup_project` | Run setup steps |
| Project | `start_project` | Start all services |
| Project | `stop_project` | Stop all terminals |
| Project | `execute_project_command` | Run common command |
| Project | `execute_service_command` | Service-specific |
| Project | `check_dependencies` | Validate deps |

### 5. Resources

Exposes projects as MCP resources:

```
project://{id} → JSON project configuration
```

Claude can read project configs as resources for context.

## Data Flow

### Scenario: "Start my project"

```
1. User: "Start my project"
   ↓
2. Claude parses intent → "start_project" tool
   ↓
3. MCP Server receives tool call
   ↓
4. Load project configuration
   ↓
5. Resolve service dependencies (topological sort)
   ↓
6. For each service:
   a. Create terminal session (node-pty)
   b. Set working directory
   c. Export environment variables
   d. Execute start command
   e. Store terminal reference
   ↓
7. Return status to Claude
   ↓
8. Claude displays results to user
```

### Scenario: "Check the API logs"

```
1. User: "Check the API logs"
   ↓
2. Claude finds API service terminal
   ↓
3. Calls "get_terminal_output" tool
   ↓
4. Server retrieves output buffer
   ↓
5. Returns last N lines
   ↓
6. Claude shows logs to user
```

## Terminal Output Handling

Output is captured using node-pty's `onData` event:

```typescript
process_pty.onData((data) => {
  session.output.push(data);
  // Keep rolling buffer of last 1000 lines
  if (session.output.length > 1000) {
    session.output.shift();
  }
});
```

**Storage:** In-memory (lost on server restart)
**Retention:** Last 1000 lines per terminal
**Access:** Via `get_terminal_output` tool

## Dependency Resolution

When starting services, dependencies are resolved:

```typescript
const started = new Set<string>();

const startService = async (service: ProjectService) => {
  if (started.has(service.name)) return;
  
  // Start dependencies first
  if (service.dependsOn) {
    for (const dep of service.dependsOn) {
      const depService = services.find(s => s.name === dep);
      if (depService) await startService(depService);
    }
  }
  
  // Then start this service
  // ...
  started.add(service.name);
};
```

## Project Persistence

Projects are saved to `~/.cli-manager-mcp/`:

```bash
~/.cli-manager-mcp/
├── project-1.json
├── project-2.json
└── ...
```

Loaded automatically on server startup.

## Communication Protocol

MCP uses JSON-RPC 2.0 over stdio:

### Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_terminal",
    "arguments": {
      "name": "backend",
      "cwd": "/project/backend"
    }
  }
}
```

### Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "✓ Created terminal \"backend\"\n  ID: abc-123\n  CWD: /project/backend"
    }]
  }
}
```

## Security Considerations

### Process Execution
- Runs with user's permissions
- No sandboxing
- Be careful with untrusted configs

### Path Handling
- All paths resolved to absolute
- No directory traversal protection
- Trust your project configs

### Environment Variables
- Inherits parent's env
- Can set per-service vars
- No secrets management (use .env files)

## Extensibility

### Adding New Tools

```typescript
// 1. Add to TOOLS array
{
  name: "my_new_tool",
  description: "Does something",
  inputSchema: { ... }
}

// 2. Add handler
case "my_new_tool": {
  // Implementation
  return [{ type: "text", text: "Done!" }];
}
```

### Custom Project Types

Add new architecture types:

```typescript
type ArchitectureType = 
  | "microservices" 
  | "monorepo" 
  | "single-app"
  | "your-custom-type";  // Add here
```

## Performance

| Metric | Value |
|--------|-------|
| Terminal startup | ~50ms |
| Command execution | ~100ms + command time |
| Output retrieval | ~10ms |
| Max terminals | Limited by system resources |
| Memory per terminal | ~2-5 MB |

## Limitations

1. **No persistent output** - Terminal history lost on restart
2. **Single machine** - No remote terminal support
3. **No GUI apps** - Terminal only
4. **No built-in secrets** - Handle manually
5. **One server instance** - Per Claude Desktop session

## Debugging

### Enable verbose logging

```typescript
// Add to src/index.ts
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
```

### Check terminal state

```bash
# List all node processes
ps aux | grep node

# Check terminal output file (if implemented)
cat ~/.cli-manager-mcp/terminal.log
```

### Claude Desktop logs

**macOS:**
```bash
cd ~/Library/Logs/Claude
ls -la
```

---

Understanding this architecture helps you customize and troubleshoot the system effectively.
