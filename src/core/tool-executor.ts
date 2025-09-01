import fs from 'fs-extra';
import { execa } from 'execa';
import path from 'path';
import type {
  Tool,
  ToolResult,
  Context,
  Permission,
} from '../types/index.js';
import { PermissionType, PermissionAction } from '../types/index.js';
import { Logger, isValidPath, sanitizePath } from '../utils/index.js';

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'create' | 'list';
  path: string;
  content?: string;
  options?: Record<string, unknown>;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  shell?: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
}

export class ToolExecutor {
  private tools: Map<string, Tool> = new Map();
  private workingDirectory: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
    this.initializeBuiltinTools();
  }

  private initializeBuiltinTools(): void {
    // 文件操作工具
    this.registerTool({
      name: 'file',
      description: '文件操作工具，支持读取、写入、删除文件',
      schema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: '操作类型',
            enum: ['read', 'write', 'delete', 'create', 'list'],
          },
          path: {
            type: 'string',
            description: '文件路径',
          },
          content: {
            type: 'string',
            description: '文件内容（write操作时使用）',
          },
        },
        required: ['operation', 'path'],
      },
      handler: this.handleFileOperation.bind(this),
      permissions: [
        { type: PermissionType.FILE, resource: '*', action: PermissionAction.READ },
        { type: PermissionType.FILE, resource: '*', action: PermissionAction.WRITE },
      ],
    });

    // 命令执行工具
    this.registerTool({
      name: 'command',
      description: '执行系统命令',
      schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的命令',
          },
          args: {
            type: 'array',
            description: '命令参数',
          },
          cwd: {
            type: 'string',
            description: '工作目录',
          },
          timeout: {
            type: 'number',
            description: '超时时间（毫秒）',
            default: 10000,
          },
        },
        required: ['command'],
      },
      handler: this.handleCommandExecution.bind(this),
      permissions: [
        { type: PermissionType.COMMAND, resource: '*', action: PermissionAction.EXECUTE },
      ],
    });
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    Logger.info(`Tool registered: ${tool.name}`);
  }

  unregisterTool(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      Logger.info(`Tool unregistered: ${name}`);
    }
    return result;
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    context: Context
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    // 验证权限
    const permissionCheck = this.checkPermissions(tool.permissions, params, context);
    if (!permissionCheck.allowed) {
      return {
        success: false,
        error: `Permission denied: ${permissionCheck.reason}`,
      };
    }

    // 验证参数
    const validationResult = this.validateParams(tool.schema, params);
    if (!validationResult.valid) {
      return {
        success: false,
        error: `Invalid parameters: ${validationResult.error}`,
      };
    }

    try {
      Logger.debug(`Executing tool: ${toolName}`, { params });
      const result = await tool.handler(params, context);
      Logger.debug(`Tool execution completed: ${toolName}`, { success: result.success });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Tool execution failed: ${toolName}`, error instanceof Error ? error : { error });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async handleFileOperation(
    params: Record<string, unknown>,
    _context: Context
  ): Promise<ToolResult> {
    const operation = params['operation'] as string;
    const filePath = params['path'] as string;
    const content = params['content'] as string | undefined;

    if (!isValidPath(filePath)) {
      return {
        success: false,
        error: 'Invalid file path',
      };
    }

    const resolvedPath = path.resolve(this.workingDirectory, sanitizePath(filePath));

    try {
      switch (operation) {
        case 'read': {
          const fileContent = await fs.readFile(resolvedPath, 'utf8');
          return {
            success: true,
            data: { content: fileContent, path: resolvedPath },
          };
        }

        case 'write': {
          if (content === undefined) {
            return {
              success: false,
              error: 'Content is required for write operation',
            };
          }
          await fs.writeFile(resolvedPath, content, 'utf8');
          return {
            success: true,
            data: { path: resolvedPath, bytesWritten: Buffer.byteLength(content, 'utf8') },
          };
        }

        case 'delete': {
          await fs.remove(resolvedPath);
          return {
            success: true,
            data: { path: resolvedPath },
          };
        }

        case 'create': {
          await fs.ensureFile(resolvedPath);
          if (content) {
            await fs.writeFile(resolvedPath, content, 'utf8');
          }
          return {
            success: true,
            data: { path: resolvedPath },
          };
        }

        case 'list': {
          const items = await fs.readdir(resolvedPath, { withFileTypes: true });
          const fileList = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: path.join(resolvedPath, item.name),
          }));
          return {
            success: true,
            data: { items: fileList, path: resolvedPath },
          };
        }

        default:
          return {
            success: false,
            error: `Unknown file operation: ${operation}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'File operation failed';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async handleCommandExecution(
    params: Record<string, unknown>,
    _context: Context
  ): Promise<ToolResult> {
    const command = params['command'] as string;
    const args = (params['args'] as string[]) ?? [];
    const cwd = (params['cwd'] as string) ?? this.workingDirectory;
    const timeout = (params['timeout'] as number) ?? 10000;

    try {
      const result = await execa(command, args, {
        cwd,
        timeout,
        reject: false, // 不抛出异常，而是返回结果
      });

      const commandResult: CommandResult = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0,
        command: `${command} ${args.join(' ')}`,
      };

      const isSuccess = (result.exitCode ?? 0) === 0;
      const returnValue: ToolResult = {
        success: isSuccess,
        data: commandResult,
      };
      
      if (!isSuccess) {
        returnValue.logs = [result.stderr];
      }
      
      return returnValue;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private checkPermissions(
    requiredPermissions: Permission[],
    params: Record<string, unknown>,
    _context: Context
  ): { allowed: boolean; reason?: string } {
    // 简化的权限检查，实际实现应该更复杂
    for (const permission of requiredPermissions) {
      if (permission.type === PermissionType.FILE) {
        const filePath = params['path'] as string;
        if (filePath?.includes('..')) {
          return {
            allowed: false,
            reason: 'Path traversal not allowed',
          };
        }
      }
    }

    return { allowed: true };
  }

  private validateParams(
    schema: any,
    params: Record<string, unknown>
  ): { valid: boolean; error?: string } {
    // 简化的参数验证，实际实现应该使用JSON Schema验证库
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in params)) {
          return {
            valid: false,
            error: `Required parameter missing: ${requiredField}`,
          };
        }
      }
    }

    return { valid: true };
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolInfo(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  setWorkingDirectory(directory: string): void {
    this.workingDirectory = directory;
    Logger.info(`Working directory changed to: ${directory}`);
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }
}