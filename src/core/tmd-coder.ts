import type {
  CLIOptions,
  Context,
  Config,
} from '../types/index.js';
import { TaskType, TaskPriority, ModelType, ContextType } from '../types/index.js';
import { TaskManager } from './task-manager.js';
import { ToolExecutor } from './tool-executor.js';
import { ModelManager } from '../models/model-manager.js';
import { Logger, generateId } from '../utils/index.js';

export class TMDCoder {
  private taskManager: TaskManager;
  private toolExecutor: ToolExecutor;
  private modelManager: ModelManager;
  private context: Context;
  private initialized = false;

  constructor() {
    this.taskManager = new TaskManager();
    this.toolExecutor = new ToolExecutor();
    this.modelManager = new ModelManager();
    
    this.context = {
      conversationId: generateId(),
      workingDirectory: process.cwd(),
      history: [],
      variables: {},
      settings: {
        preferredModel: ModelType.DEEPSEEK_V3,
        language: 'zh-CN',
        theme: 'dark',
        verboseLogging: false,
        autoSave: true,
        maxConcurrentTasks: 5,
        defaultTimeout: 30000,
      },
    };
  }

  async initialize(options?: CLIOptions): Promise<void> {
    if (this.initialized) return;

    Logger.info('Initializing TMD Coder...');

    // 应用CLI选项
    if (options?.verbose) {
      this.context.settings.verboseLogging = true;
    }

    // 初始化默认模型配置
    await this.initializeDefaultModels();

    // 执行健康检查
    await this.modelManager.performHealthCheck();

    this.initialized = true;
    Logger.info('TMD Coder initialized successfully');
  }

  private async initializeDefaultModels(): Promise<void> {
    // 注册DeepSeek模型（使用环境变量或默认配置）
    const deepseekConfig = {
      apiKey: process.env['DEEPSEEK_API_KEY'] || 'your-deepseek-api-key',
      baseURL: process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      maxTokens: 4096,
      temperature: 0.7,
    };

    try {
      this.modelManager.registerModel(ModelType.DEEPSEEK_V3, {
        ...deepseekConfig,
        model: 'deepseek-chat',
      });

      this.modelManager.registerModel(ModelType.DEEPSEEK_CODER, {
        ...deepseekConfig,
        model: 'deepseek-coder',
      });

      Logger.info('Default models registered');
    } catch (error) {
      Logger.warn('Failed to register some models', { error: error instanceof Error ? error.message : error });
    }
  }

  async processQuery(query: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('TMD Coder not initialized');
    }

    Logger.info('Processing query', { query: query.substring(0, 100) });

    try {
      // 创建任务
      await this.taskManager.scheduleTask({
        type: TaskType.CHAT,
        description: '处理用户查询',
        payload: { query },
        priority: TaskPriority.MEDIUM,
      });

      // 调用模型
      const response = await this.modelManager.callModel(query, {
        taskType: TaskType.CHAT,
        preferredModel: this.context.settings.preferredModel,
      });

      // 更新上下文
      this.updateContext('user', query);
      this.updateContext('assistant', response.content);

      return response.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Query processing failed', error instanceof Error ? error : { error });
      throw new Error(`处理查询失败: ${errorMessage}`);
    }
  }

  async analyzeCode(path: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('TMD Coder not initialized');
    }

    Logger.info('Analyzing code', { path });

    try {
      // 读取文件内容
      const fileResult = await this.toolExecutor.executeTool(
        'file',
        { operation: 'read', path },
        this.context
      );

      if (!fileResult.success || !fileResult.data) {
        throw new Error(`无法读取文件: ${fileResult.error}`);
      }

      const fileData = fileResult.data as { content: string };
      const prompt = `请分析以下代码，提供详细的分析报告，包括：
1. 代码结构和组织
2. 潜在问题和改进建议
3. 代码质量评估
4. 性能优化建议

代码内容：
\`\`\`
${fileData.content}
\`\`\``;

      const response = await this.modelManager.callModel(prompt, {
        taskType: TaskType.CODE_ANALYSIS,
        preferredModel: ModelType.DEEPSEEK_CODER,
      });

      return response.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Code analysis failed', error instanceof Error ? error : { error });
      throw new Error(`代码分析失败: ${errorMessage}`);
    }
  }

  async checkHealth(): Promise<Record<string, unknown>> {
    const stats = this.modelManager.getModelStats();
    const taskStats = this.taskManager.getExecutionStats();

    return {
      initialized: this.initialized,
      models: stats,
      tasks: taskStats,
      context: {
        conversationId: this.context.conversationId,
        historyLength: this.context.history.length,
        workingDirectory: this.context.workingDirectory,
      },
      tools: this.toolExecutor.listTools(),
    };
  }

  async listModels(): Promise<Array<{ name: string; type: ModelType; healthy: boolean }>> {
    return this.modelManager.listModels();
  }

  async getConfig(): Promise<Config> {
    return {
      models: {},
      tools: {},
      permissions: [],
      settings: this.context.settings,
    };
  }

  async getConfigValue(key: string): Promise<unknown> {
    // 简化的配置获取
    const config = await this.getConfig();
    const keys = key.split('.');
    let value: any = config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  async setConfigValue(key: string, value: string): Promise<void> {
    // 简化的配置设置
    const keys = key.split('.');
    if (keys.length >= 2 && keys[0] === 'settings') {
      const settingKey = keys[1] as keyof typeof this.context.settings;
      if (settingKey in this.context.settings) {
        // 简单类型转换
        let parsedValue: any = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        
        (this.context.settings as any)[settingKey] = parsedValue;
      }
    }
  }

  private updateContext(role: 'user' | 'assistant' | 'system', content: string): void {
    this.context.history.push({
      id: generateId(),
      type: role === 'user' ? ContextType.USER_MESSAGE : ContextType.ASSISTANT_MESSAGE,
      content,
      metadata: {},
      timestamp: new Date(),
      importance: 1,
    });

    // 限制历史记录长度
    if (this.context.history.length > 50) {
      this.context.history = this.context.history.slice(-40);
    }
  }

  getContext(): Context {
    return this.context;
  }

  async shutdown(): Promise<void> {
    Logger.info('Shutting down TMD Coder...');
    
    this.taskManager.clear();
    this.modelManager.clear();
    
    this.initialized = false;
    Logger.info('TMD Coder shutdown complete');
  }
}