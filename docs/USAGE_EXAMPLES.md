# CLI Manager MCP - Usage Examples

Real-world scenarios and how to handle them.

## Scenario 1: Daily Development Workflow

**Setup:** Full-stack app with frontend, backend, and database

### Morning: Start Working

```
User: Start my development environment
```

Claude does:
1. Loads your project config
2. Creates terminals for:
   - PostgreSQL database
   - Backend API server
   - Frontend dev server
3. Starts all services in dependency order
4. Reports:
   ```
   ✓ Database running on localhost:5432
   ✓ API server on localhost:3001
   ✓ Frontend on localhost:3000
   
   All services ready! Open http://localhost:3000
   ```

### During Development

```
User: Check the backend logs, I see an error
```

Claude shows recent backend terminal output, highlighting errors.

```
User: Restart just the backend
```

Claude closes the backend terminal and creates a new one.

```
User: Run tests for the frontend
```

Claude executes the test command in a new terminal.

### End of Day

```
User: Stop all services
```

Claude gracefully closes all terminals.

---

## Scenario 2: Microservices Project

**Setup:** 6 services + infrastructure

### Full Project Start

```
User: Start the entire platform
```

Claude starts:
1. Docker infrastructure (postgres, redis, kafka)
2. API Gateway
3. User Service
4. Product Service (waits for user-service)
5. Order Service (waits for product-service)
6. Notification Worker

```
User: What's running?
```

Claude lists all active terminals with their status.

### Selective Start

```
User: Start just the API gateway and user service
```

Claude starts only those two services (and their dependencies).

### Running Tests

```
User: Run tests for all services
```

Claude:
1. Creates test terminals for each service
2. Runs tests in parallel
3. Reports results:
   ```
   API Gateway: 24 tests passed ✓
   User Service: 18 tests passed ✓
   Product Service: 31 tests passed ✓
   Order Service: 12 tests passed ✓
   Notification Worker: 8 tests passed ✓
   
   All tests passing!
   ```

---

## Scenario 3: Onboarding New Developer

**Setup:** Complex project with many setup steps

### One-Command Setup

```
User: Set up the project from scratch
```

Claude runs:
1. Install root dependencies
2. Start Docker infrastructure
3. Install service dependencies
4. Run database migrations
5. Seed sample data
6. Build shared packages
7. Verify everything works

```
User: Start the full stack
```

New developer is ready to code in minutes, not hours.

---

## Scenario 4: Monorepo Management

**Setup:** Turborepo with 3 apps, 5 packages

### Development Mode

```
User: Start the monorepo in dev mode
```

Claude:
1. Builds shared packages first
2. Starts all apps in parallel
3. Watches for changes

### Selective Building

```
User: Build only the web app and its dependencies
```

Claude uses Turborepo to build the minimal set needed.

### Database Operations

```
User: Reset the database and reseed
```

Claude:
1. Stops running services
2. Runs the reset-db command
3. Restarts services

---

## Scenario 5: Debugging Issues

### Investigating Failures

```
User: The API is returning 500 errors
```

Claude:
1. Checks API terminal output
2. Identifies the error
3. Shows relevant log lines
4. Suggests potential fixes

```
User: Show me the last 100 lines of the API logs
```

Claude retrieves and displays the output.

### Interactive Debugging

```
User: I need to run a database query
```

Claude creates a terminal for database access.

```
User: Start a shell in the database container
```

Claude runs the docker exec command.

---

## Scenario 6: Deployment Preparation

### Pre-Deployment Checks

```
User: Run all tests and build everything
```

Claude:
1. Executes test suite
2. Runs production builds
3. Reports any failures

```
User: Deploy to staging
```

Claude executes the deployment command.

### Environment Management

Create separate configs:
- `project.development.json` - Local dev
- `project.staging.json` - Staging env
- `project.production.json` - Production

```
User: Load the staging config
```

Claude switches to staging configuration.

---

## Scenario 7: Code Review Workflow

```
User: Pull the latest changes and restart
```

Claude:
1. Runs git pull
2. Installs any new dependencies
3. Runs migrations if needed
4. Restarts services

```
User: Run the test suite on this branch
```

Claude executes tests and reports results.

---

## Scenario 8: Infrastructure Management

**Setup:** Docker Compose infrastructure

```
User: Start all infrastructure services
```

Claude starts:
- PostgreSQL
- Redis
- Elasticsearch
- MinIO (S3)

```
User: Check if PostgreSQL is healthy
```

Claude shows the database container status.

```
User: View all container logs
```

Claude streams logs from the Docker terminal.

---

## Common Command Patterns

### Starting Projects

```
Start my project
Start the full stack
Spin up the development environment
Launch all services
Get the app running
```

### Checking Status

```
What terminals are running?
Show me all active terminals
Check the status of my project
Which services are up?
List running terminals
```

### Viewing Output

```
Check the backend logs
Show me the frontend output
Get the last 50 lines from the API terminal
What errors is the database showing?
Display recent terminal output
```

### Running Commands

```
Run tests on my project
Execute the build command
Start the linter
Deploy to staging
Reset the database
```

### Managing Terminals

```
Close the frontend terminal
Create a new terminal for Redis CLI
Kill all terminals for this project
Restart the backend service
```

---

## Advanced Patterns

### Conditional Commands

```
User: If tests pass, deploy to staging
```

Claude:
1. Runs tests
2. Checks results
3. If passing, runs deployment

### Multi-Step Workflows

```
User: Reset everything and start fresh
```

Claude:
1. Stops all services
2. Drops database
3. Runs migrations
4. Seeds data
5. Restarts services

### Comparing Environments

```
User: Compare the staging and production configs
```

Claude loads both and highlights differences.

---

## Tips for Effective Use

### 1. Name Your Terminals Meaningfully

In your config:
```json
{
  "name": "api-gateway",
  "startCommand": "npm run dev"
}
```

Not:
```json
{
  "name": "terminal-1",
  "startCommand": "npm run dev"
}
```

### 2. Use Common Commands

Define frequently used commands:
```json
{
  "commonCommands": {
    "test": "npm test",
    "build": "npm run build",
    "lint": "npm run lint",
    "typecheck": "tsc --noEmit"
  }
}
```

### 3. Set Up Dependencies

Define service dependencies for correct startup order:
```json
{
  "name": "api",
  "dependsOn": ["postgres", "redis"]
}
```

### 4. Organize Setup Steps

Break setup into logical steps:
```json
{
  "setupSteps": [
    { "name": "Install dependencies", "command": "npm install" },
    { "name": "Start infrastructure", "command": "docker-compose up -d" },
    { "name": "Run migrations", "command": "npm run migrate" },
    { "name": "Seed data", "command": "npm run seed", "allowFailure": true }
  ]
}
```

### 5. Use Environment Variables

Set per-service environment:
```json
{
  "name": "api",
  "envVars": {
    "PORT": "3001",
    "NODE_ENV": "development",
    "DATABASE_URL": "postgresql://localhost:5432/app"
  }
}
```

---

## Troubleshooting Workflows

### When Something Breaks

```
User: The API won't start
```

Claude:
1. Checks terminal output
2. Identifies the error
3. Suggests fixes
4. Can restart if needed

```
User: I need to debug the database connection
```

Claude:
1. Shows database logs
2. Checks environment variables
3. Tests the connection
4. Helps identify the issue

---

## Project-Specific Examples

### React + Node.js App

```json
{
  "id": "fullstack-app",
  "name": "My Full-Stack App",
  "rootPath": "/Users/me/app",
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
  }
}
```

### Python + React

```json
{
  "id": "python-react",
  "name": "Python Backend + React Frontend",
  "rootPath": "/Users/me/project",
  "architecture": {
    "type": "single-app",
    "services": [
      {
        "name": "backend",
        "path": "backend",
        "startCommand": "uvicorn main:app --reload",
        "envVars": { "DATABASE_URL": "sqlite:///app.db" }
      },
      {
        "name": "frontend",
        "path": "frontend",
        "startCommand": "npm run dev"
      }
    ]
  }
}
```

### Multi-Package Monorepo

```json
{
  "id": "company-platform",
  "name": "Company Platform",
  "rootPath": "/Users/me/platform",
  "architecture": {
    "type": "monorepo",
    "services": [
      { "name": "design-system", "path": "packages/design", "buildCommand": "npm run build" },
      { "name": "shared-utils", "path": "packages/utils", "buildCommand": "npm run build" },
      { "name": "api-client", "path": "packages/api", "buildCommand": "npm run build" },
      { "name": "web", "path": "apps/web", "startCommand": "npm run dev" },
      { "name": "mobile", "path": "apps/mobile", "startCommand": "npm run start" },
      { "name": "admin", "path": "apps/admin", "startCommand": "npm run dev" }
    ]
  }
}
```

---

These examples show the flexibility of the system. Adapt them to your specific workflows!
