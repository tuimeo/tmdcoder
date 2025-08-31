import axios, { type AxiosInstance } from 'axios';
import type {
  ModelClient,
  ModelType,
  ModelConfig,
  CallOptions,
  ModelResponse,
  TokenUsage,
} from '../types/index.js';
import { Logger } from '../utils/index.js';

export class DeepSeekClient implements ModelClient {
  name: string;
  type: ModelType;
  config: ModelConfig;
  private httpClient: AxiosInstance;

  constructor(config: ModelConfig, type: ModelType) {
    this.name = `DeepSeek-${type}`;
    this.type = type;
    this.config = config;

    this.httpClient = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      timeout: 60000, // 60秒超时
    });
  }

  async call(prompt: string, options?: CallOptions): Promise<ModelResponse> {
    const requestData = {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      top_p: options?.topP ?? this.config.topP ?? 0.95,
      stream: options?.stream ?? false,
      stop: options?.stopWords,
    };

    try {
      Logger.debug(`Calling DeepSeek API`, { model: this.config.model });

      const response = await this.httpClient.post('/chat/completions', requestData);
      const data = response.data;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices returned from API');
      }

      const choice = data.choices[0];
      const usage: TokenUsage = {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      };

      const result: ModelResponse = {
        content: choice.message?.content ?? '',
        usage,
        finishReason: choice.finish_reason ?? 'unknown',
        model: data.model ?? this.config.model,
      };

      Logger.debug(`DeepSeek API call completed`, {
        model: this.config.model,
        tokens: usage.totalTokens,
      });

      return result;
    } catch (error) {
      Logger.error(`DeepSeek API call failed`, error instanceof Error ? error : { error });

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message ?? error.message;

        if (status === 401) {
          throw new Error(`Authentication failed: ${message}`);
        } else if (status === 429) {
          throw new Error(`Rate limit exceeded: ${message}`);
        } else if (status === 400) {
          throw new Error(`Bad request: ${message}`);
        } else {
          throw new Error(`API error (${status}): ${message}`);
        }
      } else {
        throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/models', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      Logger.warn(`DeepSeek API availability check failed`, { error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  updateConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新HTTP客户端的headers
    if (config.apiKey) {
      this.httpClient.defaults.headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // 更新base URL
    if (config.baseURL) {
      this.httpClient.defaults.baseURL = config.baseURL;
    }

    Logger.info(`DeepSeek client config updated`, { model: this.config.model });
  }

  getModelInfo(): { name: string; type: ModelType; model: string } {
    return {
      name: this.name,
      type: this.type,
      model: this.config.model,
    };
  }
}