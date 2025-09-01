import type {
  ModelClient,
  ModelConfig,
  CallOptions,
  ModelResponse,
} from '../types/index.js';
import { ModelType, TaskType } from '../types/index.js';
import { DeepSeekClient } from './deepseek-client.js';
import { Logger } from '../utils/index.js';

export interface LoadBalancerOptions {
  strategy: 'round-robin' | 'least-used' | 'random';
  healthCheck: boolean;
}

export class ModelManager {
  private models: Map<ModelType, ModelClient[]> = new Map();
  private modelUsage: Map<string, number> = new Map();
  private currentIndices: Map<ModelType, number> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private loadBalancerOptions: LoadBalancerOptions;

  constructor(loadBalancerOptions: LoadBalancerOptions = { strategy: 'round-robin', healthCheck: true }) {
    this.loadBalancerOptions = loadBalancerOptions;
  }

  registerModel(modelType: ModelType, config: ModelConfig): void {
    const client = this.createModelClient(modelType, config);

    if (!this.models.has(modelType)) {
      this.models.set(modelType, []);
      this.currentIndices.set(modelType, 0);
    }

    this.models.get(modelType)?.push(client);
    this.modelUsage.set(client.name, 0);
    this.healthStatus.set(client.name, true);

    Logger.info(`Model registered: ${client.name}`, { type: modelType });
  }

  private createModelClient(modelType: ModelType, config: ModelConfig): ModelClient {
    switch (modelType) {
      case ModelType.DEEPSEEK_V3:
      case ModelType.DEEPSEEK_CODER:
      case ModelType.DEEPSEEK_MATH:
        return new DeepSeekClient(config, modelType);

      // 未来可以扩展其他模型
      case ModelType.QWEN_CODER:
      case ModelType.GLM4:
        throw new Error(`Model type ${modelType} not yet implemented`);

      default:
        throw new Error(`Unknown model type: ${String(modelType)}`);
    }
  }

  async selectModel(taskType?: TaskType, preferredModel?: ModelType): Promise<ModelClient | null> {
    let modelType: ModelType;

    // 根据任务类型选择最适合的模型
    if (preferredModel) {
      modelType = preferredModel;
    } else {
      modelType = this.getModelTypeForTask(taskType);
    }

    const modelPool = this.models.get(modelType);
    if (!modelPool || modelPool.length === 0) {
      Logger.warn(`No models available for type: ${modelType}`);
      return null;
    }

    // 健康检查过滤
    const healthyModels = this.loadBalancerOptions.healthCheck
      ? modelPool.filter(model => this.healthStatus.get(model.name) === true)
      : modelPool;

    if (healthyModels.length === 0) {
      Logger.warn(`No healthy models available for type: ${modelType}`);
      return null;
    }

    // 根据负载均衡策略选择模型
    const selectedModel = this.selectByStrategy(healthyModels, modelType);
    Logger.debug(`Selected model: ${selectedModel.name}`, { strategy: this.loadBalancerOptions.strategy });

    return selectedModel;
  }

  private getModelTypeForTask(_taskType?: TaskType): ModelType {
    switch (_taskType) {
      case TaskType.CODE_GENERATION:
      case TaskType.CODE_ANALYSIS:
        return ModelType.DEEPSEEK_CODER;

      case TaskType.PLANNING:
        return ModelType.DEEPSEEK_V3;

      case TaskType.CHAT:
      case TaskType.FILE_OPERATION:
      case TaskType.COMMAND_EXECUTION:
      default:
        return ModelType.DEEPSEEK_V3;
    }
  }

  private selectByStrategy(models: ModelClient[], modelType: ModelType): ModelClient {
    switch (this.loadBalancerOptions.strategy) {
      case 'round-robin':
        return this.selectRoundRobin(models, modelType);

      case 'least-used':
        return this.selectLeastUsed(models);

      case 'random':
        return this.selectRandom(models);

      default:
        return models[0] as ModelClient;
    }
  }

  private selectRoundRobin(models: ModelClient[], modelType: ModelType): ModelClient {
    const currentIndex = this.currentIndices.get(modelType) ?? 0;
    const model = models[currentIndex] as ModelClient;

    // 更新索引
    this.currentIndices.set(modelType, (currentIndex + 1) % models.length);

    return model;
  }

  private selectLeastUsed(models: ModelClient[]): ModelClient {
    return models.reduce((least, current) => {
      const leastUsage = this.modelUsage.get(least.name) ?? 0;
      const currentUsage = this.modelUsage.get(current.name) ?? 0;
      return currentUsage < leastUsage ? current : least;
    });
  }

  private selectRandom(models: ModelClient[]): ModelClient {
    const randomIndex = Math.floor(Math.random() * models.length);
    return models[randomIndex] as ModelClient;
  }

  async callModel(
    prompt: string,
    options?: CallOptions & { taskType?: TaskType; preferredModel?: ModelType }
  ): Promise<ModelResponse> {
    const model = await this.selectModel(options?.taskType, options?.preferredModel);
    if (!model) {
      throw new Error('No available models for the request');
    }

    try {
      // 增加使用计数
      const currentUsage = this.modelUsage.get(model.name) ?? 0;
      this.modelUsage.set(model.name, currentUsage + 1);

      const response = await model.call(prompt, options);

      // 标记模型为健康状态
      this.healthStatus.set(model.name, true);

      Logger.info(`Model call completed`, {
        model: model.name,
        tokens: response.usage.totalTokens,
      });

      return response;
    } catch (error) {
      // 标记模型为不健康状态
      this.healthStatus.set(model.name, false);
      Logger.error(`Model call failed: ${model.name}`, error instanceof Error ? error : { error });

      // 尝试降级到其他模型
      return this.handleFailover(prompt, options, model);
    }
  }

  private async handleFailover(
    prompt: string,
    options?: CallOptions & { taskType?: TaskType; preferredModel?: ModelType },
    _failedModel?: ModelClient
  ): Promise<ModelResponse> {
    Logger.info(`Attempting failover from failed model: ${_failedModel?.name}`);

    // 获取所有可用的模型类型
    const availableTypes = Array.from(this.models.keys()).filter(type => {
      const models = this.models.get(type) ?? [];
      return models.some(model => 
        model !== _failedModel && this.healthStatus.get(model.name) !== false
      );
    });

    if (availableTypes.length === 0) {
      throw new Error('No fallback models available');
    }

    // 选择一个备用模型类型
    const fallbackType = availableTypes[0] as ModelType;
    const fallbackModel = await this.selectModel(undefined, fallbackType);

    if (!fallbackModel) {
      throw new Error('Failover model selection failed');
    }

    Logger.info(`Failing over to model: ${fallbackModel.name}`);
    return fallbackModel.call(prompt, options);
  }

  async performHealthCheck(): Promise<void> {
    Logger.info('Performing health check on all models');

    for (const modelPool of this.models.values()) {
      for (const model of modelPool) {
        try {
          const isHealthy = await model.isAvailable();
          this.healthStatus.set(model.name, isHealthy);
          Logger.debug(`Health check: ${model.name}`, { healthy: isHealthy });
        } catch (error) {
          this.healthStatus.set(model.name, false);
          Logger.warn(`Health check failed: ${model.name}`, { error: error instanceof Error ? error.message : error });
        }
      }
    }
  }

  getModelStats(): Record<string, { usage: number; healthy: boolean }> {
    const stats: Record<string, { usage: number; healthy: boolean }> = {};

    for (const modelPool of this.models.values()) {
      for (const model of modelPool) {
        stats[model.name] = {
          usage: this.modelUsage.get(model.name) ?? 0,
          healthy: this.healthStatus.get(model.name) ?? false,
        };
      }
    }

    return stats;
  }

  listModels(): Array<{ name: string; type: ModelType; healthy: boolean }> {
    const models: Array<{ name: string; type: ModelType; healthy: boolean }> = [];

    for (const modelPool of this.models.values()) {
      for (const model of modelPool) {
        models.push({
          name: model.name,
          type: model.type,
          healthy: this.healthStatus.get(model.name) ?? false,
        });
      }
    }

    return models;
  }

  clear(): void {
    this.models.clear();
    this.modelUsage.clear();
    this.currentIndices.clear();
    this.healthStatus.clear();
    Logger.info('ModelManager cleared');
  }
}