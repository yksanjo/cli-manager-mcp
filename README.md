# 🖥️ CLI Manager MCP

[![CI](https://github.com/yksanjo/cli-manager-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yksanjo/cli-manager-mcp/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-purple?style=for-the-badge)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **AI-Powered Terminal Management for Claude Desktop**  
> Let Claude intelligently manage your CLI sessions, remember project architectures, and automate your development workflows.

---

## ✨ What is CLI Manager MCP?

**CLI Manager MCP** is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that enables Claude to create, manage, and monitor multiple terminal sessions automatically. It remembers your project structures, handles service dependencies, and lets you control everything through natural language.

### New in v1.1.0

- **Smart Output Detection** - Commands now wait for output to stabilize instead of fixed delays
- **Zod Validation** - All tool inputs are validated with detailed error messages
- **Comprehensive Logging** - Built-in logger with DEBUG, INFO, WARN, ERROR levels
- **Pattern Matching** - Wait for specific output patterns in commands

### The Problem

```bash
# Before: You manually manage everything
Terminal 1: cd backend && npm run dev
Terminal 2: cd frontend && npm start  
Terminal 3: docker-compose up postgres
Terminal 4: cd worker && npm run start
# ... constantly switching, remembering commands
```

### The Solution

```markdown
You: "Start my full-stack project"

Claude: ✓ Created 4 terminal sessions
        ✓ Database running on localhost:5432
        ✓ API server on localhost:3001
        ✓ Frontend on localhost:3000
        ✓ Worker processing jobs
        
        All services ready! 🚀
```

---

## 🎥 Demo

```markdown
You: Set up the project from scratch

Claude: [1/5] Installing dependencies... ✓
        [2/5] Starting Docker infrastructure... ✓
        [3/5] Running database migrations... ✓
        [4/5] Seeding sample data... ✓
        [5/5] Building shared packages... ✓
        
        Project ready in 45 seconds!

You: Run tests across all services

Claude: API Gateway:    24 tests passed ✓
        User Service:   18 tests passed ✓
        Product Service: 31 tests passed ✓
        
        All tests passing! ✅

You: Check the backend logs

Claude: [Shows recent backend terminal output]
        Found error: Connection timeout to database
        Suggestion: Check if postgres container is running
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Claude Desktop](https://claude.ai/download)

### Installation

```bash
# Clone the repository
git clone https://github.com/yksanjo/cli-manager-mcp.git
cd cli-manager-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Configure Claude Desktop

Add to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

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

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Linux:** `~/.config/Claude/claude_desktop_config.json`

### Restart Claude Desktop

Quit and reopen Claude Desktop. You should see a 🔧 tool icon.

---

## 📖 Usage

### 1. Create Your Project Configuration

```bash
cp config/single-app-example.json config/my-project.json
```

Edit `config/my-project.json`:

```json
{
  "id": "my-app",
  "name": "My Application",
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
    { "name": "Install deps", "command": "npm install" }
  ],
  "commonCommands": {
    "test": "npm test",
    "build": "npm run build"
  }
}
```

### 2. Load Your Project in Claude

```markdown
Load my project from /path/to/config/my-project.json
```

### 3. Start Managing Your Terminals

```markdown
Start my project
Run tests
Check the backend logs
Restart the API service
```

---

## 🛠️ Available Tools

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
| `start_project` | Start all services (with dependencies) |
| `stop_project` | Stop all project terminals |
| `execute_project_command` | Run common command |
| `execute_service_command` | Run service-specific command |
| `check_dependencies` | Check required dependencies |

---

## 🏗️ Architecture Support

### ✅ Single Application
Simple standalone apps with one service

### ✅ Microservices
Multi-service architectures with dependency management

### ✅ Monorepo
Turborepo, Nx, or Lerna-based projects

### ✅ Docker-Based
Projects with containerized infrastructure

---

## 📚 Examples

### Full-Stack Web App

```json
{
  "id": "fullstack-app",
  "name": "Full-Stack App",
  "rootPath": "/Users/me/fullstack",
  "architecture": {
    "type": "single-app",
    "services": [
      {
        "name": "api",
        "path": "backend",
        "startCommand": "npm run dev",
        "envVars": { "PORT": "3001" }
      },
      {
        "name": "web",
        "path": "frontend",
        "startCommand": "npm run dev",
        "dependsOn": ["api"]
      }
    ]
  }
}
```

### Microservices Platform

```json
{
  "id": "platform",
  "name": "E-Commerce Platform",
  "architecture": {
    "type": "microservices",
    "services": [
      { "name": "gateway", "path": "gateway", "startCommand": "npm run dev" },
      { "name": "users", "path": "services/users", "startCommand": "npm run dev", "dependsOn": ["postgres"] },
      { "name": "orders", "path": "services/orders", "startCommand": "npm run dev", "dependsOn": ["users", "postgres"] },
      { "name": "postgres", "path": ".", "startCommand": "docker-compose up postgres" }
    ]
  }
}
```

---

## 📁 Project Structure

```
cli-manager-mcp/
├── src/
│   └── index.ts              # Main MCP server
├── config/
│   ├── microservices-example.json
│   ├── monorepo-example.json
│   └── single-app-example.json
├── docs/
│   ├── QUICK_START.md
│   ├── ARCHITECTURE.md
│   └── USAGE_EXAMPLES.md
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧪 Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Start
npm start
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - The protocol that makes this possible
- [node-pty](https://github.com/microsoft/node-pty) - Terminal emulation
- [Claude](https://claude.ai/) - The AI assistant that brings it all together

---

## 🔗 Links

- [Documentation](./docs/)
- [Repository](https://github.com/yksanjo/cli-manager-mcp)
- [Report Bug](https://github.com/yksanjo/cli-manager-mcp/issues)
- [Request Feature](https://github.com/yksanjo/cli-manager-mcp/issues)


---

<p align="center">
  Made with ❤️ for the Claude community
</p>
