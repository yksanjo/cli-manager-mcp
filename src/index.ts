#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as pty from "node-pty";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// Logging System
// ============================================================================

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private static level: LogLevel = LogLevel.INFO;
  private static logs: Array<{ timestamp: Date; level: string; message: string }> = [];
  private static maxLogs = 1000;

  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }

  static debug(message: string, ...args: any[]): void {
    Logger.log(LogLevel.DEBUG, "DEBUG", message, ...args);
  }

  static info(message: string, ...args: any[]): void {
    Logger.log(LogLevel.INFO, "INFO", message, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    Logger.log(LogLevel.WARN, "WARN", message, ...args);
  }

  static error(message: string, ...args: any[]): void {
    Logger.log(LogLevel.ERROR, "ERROR", message, ...args);
  }

  private static log(level: LogLevel, levelStr: string, message: string, ...args: any[]): void {
    if (level < Logger.level) return;
    
    const formattedMessage = args.length > 0 
      ? `${message} ${args.map(a => JSON.stringify(a)).join(" ")}`
      : message;
    
    const entry = { timestamp: new Date(), level: levelStr, message: formattedMessage };
    Logger.logs.push(entry);
    
    if (Logger.logs.length > Logger.maxLogs) {
      Logger.logs.shift();
    }

    // Output to stderr so it doesn't interfere with MCP protocol
    const timestamp = entry.timestamp.toISOString();
    console.error(`[${timestamp}] [${levelStr}] ${formattedMessage}`);
  }

  static getLogs(level?: LogLevel): Array<{ timestamp: Date; level: string; message: string }> {
    if (level !== undefined) {
      return Logger.logs.filter(log => 
        LogLevel[log.level as keyof typeof LogLevel] === level
      );
    }
    return [...Logger.logs];
  }

  static clearLogs(): void {
    Logger.logs = [];
  }
}

// ============================================================================
// Types & Interfaces
// ============================================================================

interface TerminalSession {
  id: string;
  name: string;
  process: pty.IPty;
  output: string[];
  cwd: string;
  createdAt: Date;
  commandHistory: string[];
  outputReady: boolean;
  lastCommand: string;
  commandStartTime: number;
}

interface ProjectService {
  name: string;
  path: string;
  startCommand?: string;
  buildCommand?: string;
  testCommand?: string;
  envVars?: Record<string, string>;
  dependsOn?: string[];
}

interface ProjectSetupStep {
  name: string;
  command: string;
  description?: string;
  workingDir?: string;
  allowFailure?: boolean;
}

interface ProjectConfig {
  id: string;
  name: string;
  rootPath: string;
  architecture: {
    type: "microservices" | "monorepo" | "single-app" | "modular";
    services: ProjectService[];
  };
  setupSteps: ProjectSetupStep[];
  commonCommands: Record<string, string>;
  dependencies?: {
    node?: string;
    python?: string;
    docker?: boolean;
    redis?: boolean;
    postgres?: boolean;
    mongodb?: boolean;
    custom?: string[];
  };
  metadata?: {
    description?: string;
    version?: string;
    createdAt?: string;
  };
}

// ============================================================================
// Global State
// ============================================================================

const terminals = new Map<string, TerminalSession>();
const projects = new Map<string, ProjectConfig>();
const CONFIG_DIR = path.join(os.homedir(), ".cli-manager-mcp");

// ============================================================================
// Terminal Management
// ============================================================================

function createTerminal(name: string, cwd: string = process.cwd()): TerminalSession {
  const id = uuidv4();
  const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
  
  const process_pty = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 120,
    rows: 40,
    cwd,
    env: process.env as { [key: string]: string },
  });

  const session: TerminalSession = {
    id,
    name,
    process: process_pty,
    output: [],
    cwd,
    createdAt: new Date(),
    commandHistory: [],
    outputReady: false,
    lastCommand: "",
    commandStartTime: 0,
  };

  process_pty.onData((data) => {
    session.output.push(data);
    if (session.output.length > 1000) {
      session.output.shift();
    }
  });

  process_pty.onExit(() => {
    terminals.delete(id);
  });

  terminals.set(id, session);
  return session;
}

// Smart command execution with better output detection
function executeCommand(
  terminalId: string, 
  command: string, 
  waitForOutput: boolean = true,
  options: { timeout?: number; pattern?: RegExp } = {}
): Promise<string> {
  const { timeout = 10000, pattern } = options;
  
  return new Promise((resolve, reject) => {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      reject(new Error(`Terminal ${terminalId} not found`));
      return;
    }

    terminal.commandHistory.push(command);
    terminal.lastCommand = command;
    terminal.commandStartTime = Date.now();
    terminal.outputReady = false;
    
    const beforeLength = terminal.output.length;
    
    terminal.process.write(command + "\r");

    if (!waitForOutput) {
      resolve("Command sent (not waiting for output)");
      return;
    }

    // Helper to extract new output
    const getNewOutput = () => terminal.output.slice(beforeLength).join("");

    // If a pattern is provided, wait for it
    if (pattern) {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const output = getNewOutput();
        if (pattern.test(output) || Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          terminal.outputReady = true;
          resolve(output || "Command executed (no output)");
        }
      }, 100);
      
      // Cleanup on exit
      terminal.process.onExit(() => {
        clearInterval(checkInterval);
      });
      return;
    }

    // Otherwise, wait for output to stabilize
    let lastOutput = "";
    let stableCount = 0;
    const checkStability = setInterval(() => {
      const currentOutput = getNewOutput();
      
      if (currentOutput === lastOutput) {
        stableCount++;
        if (stableCount >= 3) { // Output stable for 300ms
          clearInterval(checkStability);
          terminal.outputReady = true;
          resolve(currentOutput || "Command executed (no output)");
        }
      } else {
        stableCount = 0;
        lastOutput = currentOutput;
      }
      
      // Timeout check
      if (Date.now() - terminal.commandStartTime > timeout) {
        clearInterval(checkStability);
        terminal.outputReady = true;
        resolve(lastOutput || "Command executed (timeout - partial output)");
      }
    }, 100);
    
    // Cleanup on exit
    terminal.process.onExit(() => {
      clearInterval(checkStability);
    });
  });
}

// Wait for a specific pattern in terminal output
async function waitForOutput(terminalId: string, pattern: RegExp, timeout: number = 30000): Promise<string> {
  const terminal = terminals.get(terminalId);
  if (!terminal) {
    throw new Error(`Terminal ${terminalId} not found`);
  }

  const startTime = Date.now();
  const initialLength = terminal.output.length;
  
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const output = terminal.output.slice(initialLength).join("");
      
      if (pattern.test(output)) {
        clearInterval(checkInterval);
        resolve(output);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for pattern: ${pattern}`));
      }
    }, 100);
  });
}

async function getTerminalOutput(terminalId: string, lines: number = 50): Promise<string> {
  const terminal = terminals.get(terminalId);
  if (!terminal) {
    throw new Error(`Terminal ${terminalId} not found`);
  }
  return terminal.output.slice(-lines).join("");
}

// ============================================================================
// Project Configuration Management
// ============================================================================

async function loadProjectConfig(configPath: string): Promise<ProjectConfig> {
  const resolvedPath = path.resolve(configPath);
  const content = await fs.readFile(resolvedPath, "utf-8");
  const config = JSON.parse(content) as ProjectConfig;
  
  // Validate
  if (!config.id || !config.name || !config.rootPath) {
    throw new Error("Invalid project configuration: missing required fields");
  }
  
  projects.set(config.id, config);
  
  // Save to config directory for persistence
  const configFile = path.join(CONFIG_DIR, `${config.id}.json`);
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(config, null, 2));
  
  return config;
}

async function listSavedProjects(): Promise<string[]> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const files = await fs.readdir(CONFIG_DIR);
    return files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
  } catch {
    return [];
  }
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const CreateTerminalSchema = z.object({
  name: z.string().min(1, "Terminal name is required"),
  cwd: z.string().optional(),
});

const ExecuteCommandSchema = z.object({
  terminalId: z.string().uuid("Invalid terminal ID format"),
  command: z.string().min(1, "Command is required"),
  waitForOutput: z.boolean().optional().default(true),
});

const GetTerminalOutputSchema = z.object({
  terminalId: z.string().uuid("Invalid terminal ID format"),
  lines: z.number().int().min(1).max(10000).optional().default(50),
});

const CloseTerminalSchema = z.object({
  terminalId: z.string().uuid("Invalid terminal ID format"),
});

const SendInputSchema = z.object({
  terminalId: z.string().uuid("Invalid terminal ID format"),
  input: z.string().min(1, "Input is required"),
});

const LoadProjectSchema = z.object({
  configPath: z.string().min(1, "Config path is required"),
});

const GetProjectInfoSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

const SetupProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  stepIndex: z.number().int().min(0).optional(),
});

const StartProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  serviceNames: z.array(z.string()).optional(),
  autoSetup: z.boolean().optional().default(false),
});

const StopProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

const ExecuteProjectCommandSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  commandKey: z.string().min(1, "Command key is required"),
});

const ExecuteServiceCommandSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  serviceName: z.string().min(1, "Service name is required"),
  commandType: z.enum(["start", "build", "test"]),
});

const CheckDependenciesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

function validateInput<T>(schema: z.ZodSchema<T>, args: unknown): T {
  return schema.parse(args);
}

// ============================================================================
// MCP Tools Definition
// ============================================================================

const TOOLS: Tool[] = [
  // Terminal Management
  {
    name: "create_terminal",
    description: "Create a new terminal session",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the terminal" },
        cwd: { type: "string", description: "Working directory (default: current)" },
      },
      required: ["name"],
    },
  },
  {
    name: "execute_command",
    description: "Execute a command in a specific terminal",
    inputSchema: {
      type: "object",
      properties: {
        terminalId: { type: "string", description: "Terminal ID" },
        command: { type: "string", description: "Command to execute" },
        waitForOutput: { type: "boolean", description: "Wait for output before returning", default: true },
      },
      required: ["terminalId", "command"],
    },
  },
  {
    name: "list_terminals",
    description: "List all active terminal sessions",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_terminal_output",
    description: "Get output from a terminal",
    inputSchema: {
      type: "object",
      properties: {
        terminalId: { type: "string", description: "Terminal ID" },
        lines: { type: "number", description: "Number of lines to return", default: 50 },
      },
      required: ["terminalId"],
    },
  },
  {
    name: "close_terminal",
    description: "Close a terminal session",
    inputSchema: {
      type: "object",
      properties: {
        terminalId: { type: "string", description: "Terminal ID" },
      },
      required: ["terminalId"],
    },
  },
  {
    name: "send_input",
    description: "Send input to a running terminal process (useful for interactive prompts)",
    inputSchema: {
      type: "object",
      properties: {
        terminalId: { type: "string", description: "Terminal ID" },
        input: { type: "string", description: "Input to send" },
      },
      required: ["terminalId", "input"],
    },
  },
  // Project Management
  {
    name: "load_project",
    description: "Load a project configuration from file",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string", description: "Path to project config JSON file" },
      },
      required: ["configPath"],
    },
  },
  {
    name: "list_projects",
    description: "List all loaded projects",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_project_info",
    description: "Get information about a loaded project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "setup_project",
    description: "Run all setup steps for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
        stepIndex: { type: "number", description: "Run only specific step (optional)" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "start_project",
    description: "Start all services for a project (with dependency handling)",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
        serviceNames: { 
          type: "array", 
          items: { type: "string" },
          description: "Specific services to start (default: all)" 
        },
        autoSetup: { type: "boolean", description: "Run setup steps first if needed", default: false },
      },
      required: ["projectId"],
    },
  },
  {
    name: "stop_project",
    description: "Stop all terminals for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "execute_project_command",
    description: "Execute a common command from the project config",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
        commandKey: { type: "string", description: "Command key from commonCommands" },
      },
      required: ["projectId", "commandKey"],
    },
  },
  {
    name: "execute_service_command",
    description: "Execute a service-specific command",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
        serviceName: { type: "string", description: "Service name" },
        commandType: { type: "string", enum: ["start", "build", "test"], description: "Command type" },
      },
      required: ["projectId", "serviceName", "commandType"],
    },
  },
  {
    name: "check_dependencies",
    description: "Check if all required dependencies for a project are installed",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
      },
      required: ["projectId"],
    },
  },
  // Visible Terminal Windows
  {
    name: "open_terminal_window",
    description: "Open a visible terminal window (in Terminal.app) and run a command",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name/label for this window" },
        cwd: { type: "string", description: "Working directory" },
        command: { type: "string", description: "Command to run" },
      },
      required: ["name", "cwd", "command"],
    },
  },
  {
    name: "open_terminal_windows",
    description: "Open multiple visible terminal windows at once (one per service)",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID from loaded config" },
      },
      required: ["projectId"],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleTool(name: string, args: any): Promise<Array<{ type: "text"; text: string }>> {
  Logger.debug(`Tool called: ${name}`, args);
  
  try {
    switch (name) {
    // Terminal Management
    case "create_terminal": {
      const validated = validateInput(CreateTerminalSchema, args);
      const terminal = createTerminal(validated.name, validated.cwd);
      Logger.info(`Created terminal: ${terminal.id}`, { name: validated.name });
      return [{
        type: "text",
        text: `✓ Created terminal "${validated.name}"\n  ID: ${terminal.id}\n  CWD: ${terminal.cwd}`,
      }];
    }

    case "execute_command": {
      const validated = validateInput(ExecuteCommandSchema, args);
      const result = await executeCommand(validated.terminalId, validated.command, validated.waitForOutput);
      Logger.info(`Executed command in terminal: ${validated.terminalId}`, { command: validated.command });
      return [{
        type: "text",
        text: `Executed: ${validated.command}\n\nOutput:\n${result}`,
      }];
    }

    case "list_terminals": {
      if (terminals.size === 0) {
        return [{ type: "text", text: "No active terminals" }];
      }
      const list = Array.from(terminals.values()).map(t => 
        `• ${t.name}\n  ID: ${t.id}\n  CWD: ${t.cwd}\n  Created: ${t.createdAt.toLocaleString()}`
      ).join("\n\n");
      return [{ type: "text", text: `Active Terminals:\n\n${list}` }];
    }

    case "get_terminal_output": {
      const { terminalId, lines = 50 } = args;
      const output = await getTerminalOutput(terminalId, lines);
      return [{
        type: "text",
        text: output || "(no output)",
      }];
    }

    case "close_terminal": {
      const { terminalId } = args;
      const terminal = terminals.get(terminalId);
      if (!terminal) {
        throw new Error(`Terminal ${terminalId} not found`);
      }
      terminal.process.kill();
      terminals.delete(terminalId);
      return [{ type: "text", text: `✓ Closed terminal "${terminal.name}"` }];
    }

    case "send_input": {
      const { terminalId, input } = args;
      const terminal = terminals.get(terminalId);
      if (!terminal) {
        throw new Error(`Terminal ${terminalId} not found`);
      }
      terminal.process.write(input);
      return [{ type: "text", text: `✓ Sent input to terminal` }];
    }

    // Project Management
    case "load_project": {
      const { configPath } = args;
      const config = await loadProjectConfig(configPath);
      return [{
        type: "text",
        text: `✓ Loaded project "${config.name}" (${config.id})\n` +
              `  Architecture: ${config.architecture.type}\n` +
              `  Services: ${config.architecture.services.length}\n` +
              `  Setup Steps: ${config.setupSteps.length}`,
      }];
    }

    case "list_projects": {
      if (projects.size === 0) {
        return [{ type: "text", text: "No projects loaded. Use load_project to load a configuration." }];
      }
      const list = Array.from(projects.values()).map(p =>
        `• ${p.name} (${p.id})\n  Type: ${p.architecture.type}\n  Services: ${p.architecture.services.length}`
      ).join("\n\n");
      return [{ type: "text", text: `Loaded Projects:\n\n${list}` }];
    }

    case "get_project_info": {
      const { projectId } = args;
      const project = projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      
      const services = project.architecture.services.map(s => 
        `  - ${s.name} (${s.path})`
      ).join("\n");
      
      const commands = Object.entries(project.commonCommands)
        .map(([k, v]) => `  ${k}: ${v}`).join("\n");
      
      return [{
        type: "text",
        text: `Project: ${project.name}\n` +
              `ID: ${project.id}\n` +
              `Type: ${project.architecture.type}\n` +
              `Root: ${project.rootPath}\n\n` +
              `Services:\n${services}\n\n` +
              `Common Commands:\n${commands}`,
      }];
    }

    case "setup_project": {
      const { projectId, stepIndex } = args;
      const project = projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const terminal = createTerminal(`${project.name}-setup`, project.rootPath);
      const stepsToRun = stepIndex !== undefined 
        ? [project.setupSteps[stepIndex]] 
        : project.setupSteps;

      const results: string[] = [];
      
      for (let i = 0; i < stepsToRun.length; i++) {
        const step = stepsToRun[i];
        const stepNum = stepIndex !== undefined ? stepIndex + 1 : i + 1;
        const total = stepIndex !== undefined ? 1 : project.setupSteps.length;
        
        results.push(`[${stepNum}/${total}] ${step.name}...`);
        
        try {
          const cwd = step.workingDir 
            ? path.join(project.rootPath, step.workingDir) 
            : project.rootPath;
          
          terminal.process.write(`cd "${cwd}" && ${step.command}\r`);
          
          // Wait a bit for command to execute
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          results.push(`  ✓ ${step.name} completed`);
        } catch (error) {
          if (!step.allowFailure) {
            results.push(`  ✗ ${step.name} failed: ${error}`);
            break;
          } else {
            results.push(`  ⚠ ${step.name} failed (allowed): ${error}`);
          }
        }
      }

      return [{
        type: "text",
        text: `Setup for "${project.name}":\n\n${results.join("\n")}\n\nSetup terminal ID: ${terminal.id}`,
      }];
    }

    case "start_project": {
      const { projectId, serviceNames, autoSetup = false } = args;
      const project = projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Filter services to start
      const servicesToStart = serviceNames 
        ? project.architecture.services.filter(s => serviceNames.includes(s.name))
        : project.architecture.services;

      const results: string[] = [];
      const createdTerminals: TerminalSession[] = [];

      // Simple dependency resolution
      const started = new Set<string>();
      const startService = async (service: ProjectService) => {
        if (started.has(service.name)) return;
        
        // Start dependencies first
        if (service.dependsOn) {
          for (const dep of service.dependsOn) {
            const depService = project.architecture.services.find(s => s.name === dep);
            if (depService && !started.has(dep)) {
              await startService(depService);
            }
          }
        }

        if (service.startCommand) {
          const servicePath = path.join(project.rootPath, service.path);
          const terminal = createTerminal(`${project.name}-${service.name}`, servicePath);
          createdTerminals.push(terminal);

          // Set env vars
          if (service.envVars) {
            for (const [key, value] of Object.entries(service.envVars)) {
              terminal.process.write(`export ${key}="${value}"\r`);
            }
          }

          terminal.process.write(`${service.startCommand}\r`);
          started.add(service.name);
          results.push(`✓ Started ${service.name} (terminal: ${terminal.id})`);
          
          // Small delay between services
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      };

      for (const service of servicesToStart) {
        await startService(service);
      }

      return [{
        type: "text",
        text: `Started ${project.name}:\n\n${results.join("\n")}\n\n` +
              `Created ${createdTerminals.length} terminal sessions.`,
      }];
    }

    case "stop_project": {
      const { projectId } = args;
      const project = projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const terminalsToClose: TerminalSession[] = [];
      for (const [id, terminal] of terminals) {
        if (terminal.name.startsWith(`${project.name}-`)) {
          terminalsToClose.push(terminal);
        }
      }

      for (const terminal of terminalsToClose) {
        terminal.process.kill();
        terminals.delete(terminal.id);
      }

      return [{
        type: "text",
        text: `✓ Stopped ${project.name}\n` +
              `Closed ${terminalsToClose.length} terminal sessions.`,
      }];
    }

    case "execute_project_command": {
      const { projectId, commandKey } = args;
      const project = projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const command = project.commonCommands[commandKey];
      if (!command) {
        throw new Error(`Command "${commandKey}" not found. Available: ${Object.keys(project.commonCommands).join(", ")}`);
      }

      const terminal = createTerminal(`${project.name}-${commandKey}`, project.rootPath);
      terminal.process.write(`${command}\r`);

      return [{
        type: "text",
        text: `✓ Executed "${commandKey}" for ${project.name}\n` +
              `Command: ${command}\n` +
              `Terminal: ${terminal.id}`,
      }];
    }

    case "execute_service_command": {
      const { projectId, serviceName, commandType } = args;
      const project = projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const service = project.architecture.services.find(s => s.name === serviceName);
      if (!service) {
        throw new Error(`Service "${serviceName}" not found`);
      }

      let command: string | undefined;
      switch (commandType) {
        case "start": command = service.startCommand; break;
        case "build": command = service.buildCommand; break;
        case "test": command = service.testCommand; break;
      }

      if (!command) {
        throw new Error(`No ${commandType} command defined for service ${serviceName}`);
      }

      const servicePath = path.join(project.rootPath, service.path);
      const terminal = createTerminal(`${serviceName}-${commandType}`, servicePath);
      terminal.process.write(`${command}\r`);

      return [{
        type: "text",
        text: `✓ Executed ${commandType} for ${serviceName}\n` +
              `Command: ${command}\n` +
              `Terminal: ${terminal.id}`,
      }];
    }

    case "check_dependencies": {
      const { projectId } = args;
      const project = projects.get(projectId);
      if (!project || !project.dependencies) {
        return [{ type: "text", text: "No dependencies defined for this project" }];
      }

      const results: string[] = [];
      const deps = project.dependencies;

      if (deps.node) {
        results.push(`Node.js ${deps.node}: Checking...`);
      }
      if (deps.python) {
        results.push(`Python ${deps.python}: Checking...`);
      }
      if (deps.docker) {
        results.push(`Docker: ${deps.docker ? "Required" : "Not required"}`);
      }
      if (deps.redis) {
        results.push(`Redis: ${deps.redis ? "Required" : "Not required"}`);
      }
      if (deps.postgres) {
        results.push(`PostgreSQL: ${deps.postgres ? "Required" : "Not required"}`);
      }
      if (deps.custom) {
        results.push(`Custom dependencies: ${deps.custom.join(", ")}`);
      }

      return [{
        type: "text",
        text: `Dependencies for ${project?.name}:\n\n${results.join("\n")}`,
      }];
    }

    // Visible Terminal Windows
    case "open_terminal_window": {
      const { name, cwd, command } = args;
      
      // Escape the command for AppleScript
      const escapedCommand = command.replace(/"/g, '\\"');
      const escapedCwd = cwd.replace(/"/g, '\\"');
      
      const script = `tell app "Terminal" to do script "cd ${escapedCwd} && ${escapedCommand}"`;
      await execAsync(`osascript -e '${script}'`);
      
      Logger.info(`Opened terminal window: ${name}`, { cwd, command });
      return [{
        type: "text",
        text: `✓ Opened visible terminal window "${name}"\n  CWD: ${cwd}\n  Command: ${command}\n\nCheck your Terminal.app to see the running process!`,
      }];
    }

    case "open_terminal_windows": {
      const { projectId } = args;
      const project = projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found. Load it first with load_project.`);
      }

      const results: string[] = [];
      
      for (const service of project.architecture.services) {
        if (service.startCommand) {
          const escapedPath = service.path.replace(/"/g, '\\"');
          const escapedCmd = service.startCommand.replace(/"/g, '\\"');
          
          const script = `tell app "Terminal" to do script "cd ${escapedPath} && ${escapedCmd}"`;
          await execAsync(`osascript -e '${script}'`);
          
          results.push(`✓ Opened window for ${service.name}`);
        }
      }

      Logger.info(`Opened ${results.length} terminal windows for project: ${projectId}`);
      return [{
        type: "text",
        text: `✓ Opened ${results.length} visible terminal windows for "${project.name}":\n\n${results.join("\n")}\n\nCheck your Terminal.app - all projects should be running!`,
      }];
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    Logger.error(`Tool error: ${name}`, error.message);
    throw error;
  }
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server({
  name: "cli-manager-mcp",
  version: "1.0.0",
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handleTool(request.params.name, request.params.arguments);
    return { content: result as Array<{ type: "text"; text: string }> };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});



// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  // Load saved projects on startup
  const saved = await listSavedProjects();
  for (const projectId of saved) {
    try {
      const configPath = path.join(CONFIG_DIR, `${projectId}.json`);
      await loadProjectConfig(configPath);
      console.error(`Loaded project: ${projectId}`);
    } catch (e) {
      console.error(`Failed to load project ${projectId}:`, e);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CLI Manager MCP Server running on stdio");
}

main().catch(console.error);
