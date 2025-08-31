export interface Task {
  id: string;
  type: TaskType;
  description: string;
  payload: Record<string, unknown>;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  dependencies?: string[];
  timeout?: number;
}

export enum TaskType {
  CODE_GENERATION = 'code_generation',
  CODE_ANALYSIS = 'code_analysis',
  FILE_OPERATION = 'file_operation',
  COMMAND_EXECUTION = 'command_execution',
  CHAT = 'chat',
  PLANNING = 'planning',
}

export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  logs?: string[];
}

export interface TaskExecution {
  task: Task;
  startedAt: Date;
  promise: Promise<TaskResult>;
  abortController: AbortController;
}

export interface Context {
  conversationId: string;
  userId?: string;
  workingDirectory: string;
  projectContext?: ProjectContext;
  history: ContextItem[];
  variables: Record<string, unknown>;
  settings: UserSettings;
}

export interface ContextItem {
  id: string;
  type: ContextType;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  importance: number;
}

export enum ContextType {
  USER_MESSAGE = 'user_message',
  ASSISTANT_MESSAGE = 'assistant_message',
  SYSTEM_MESSAGE = 'system_message',
  CODE_CONTEXT = 'code_context',
  FILE_CONTENT = 'file_content',
  TOOL_RESULT = 'tool_result',
}

export interface ProjectContext {
  root: string;
  type: ProjectType;
  language: string[];
  framework?: string[];
  dependencies: Record<string, string>;
  structure: FileNode[];
}

export enum ProjectType {
  NODE = 'node',
  PYTHON = 'python',
  RUST = 'rust',
  GO = 'go',
  JAVA = 'java',
  UNKNOWN = 'unknown',
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  children?: FileNode[];
}

export interface Tool {
  name: string;
  description: string;
  schema: ToolSchema;
  handler: ToolHandler;
  permissions: Permission[];
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export type ToolHandler = (params: Record<string, unknown>, context: Context) => Promise<ToolResult>;

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  logs?: string[];
}

export interface Permission {
  type: PermissionType;
  resource: string;
  action: PermissionAction;
}

export enum PermissionType {
  FILE = 'file',
  DIRECTORY = 'directory',
  COMMAND = 'command',
  NETWORK = 'network',
  SYSTEM = 'system',
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
  CREATE = 'create',
}

export interface ModelClient {
  name: string;
  type: ModelType;
  config: ModelConfig;
  call: (prompt: string, options?: CallOptions) => Promise<ModelResponse>;
  isAvailable: () => Promise<boolean>;
}

export enum ModelType {
  DEEPSEEK_V3 = 'deepseek_v3',
  DEEPSEEK_CODER = 'deepseek_coder',
  DEEPSEEK_MATH = 'deepseek_math',
  QWEN_CODER = 'qwen_coder',
  GLM4 = 'glm4',
}

export interface ModelConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stopWords?: string[];
}

export interface ModelResponse {
  content: string;
  usage: TokenUsage;
  finishReason: string;
  model: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  model: ModelClient;
  tools: Tool[];
  systemPrompt: string;
  execute: (task: Task, context: Context) => Promise<TaskResult>;
}

export enum AgentType {
  MAIN = 'main',
  SUB = 'sub',
  EXPERT = 'expert',
}

export interface UserSettings {
  preferredModel: ModelType;
  language: string;
  theme: 'light' | 'dark';
  verboseLogging: boolean;
  autoSave: boolean;
  maxConcurrentTasks: number;
  defaultTimeout: number;
}

export interface CLIOptions {
  verbose?: boolean;
  config?: string;
  model?: string;
  timeout?: number;
  interactive?: boolean;
}

export interface Config {
  models: Record<string, ModelConfig>;
  tools: Record<string, boolean>;
  permissions: Permission[];
  settings: UserSettings;
}