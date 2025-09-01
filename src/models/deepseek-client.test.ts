import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DeepSeekClient } from './deepseek-client.js';
import { ModelType } from '../types/index.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('DeepSeekClient', () => {
  let client: DeepSeekClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    const config = {
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      maxTokens: 4096,
      temperature: 0.7,
    };

    // Reset axios mock
    vi.clearAllMocks();
    
    // Mock axios.create to return a mock instance
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      defaults: {
        headers: {},
        baseURL: config.baseURL,
      },
    };
    
    (mockedAxios.create as any).mockReturnValue(mockAxiosInstance);

    client = new DeepSeekClient(config, ModelType.DEEPSEEK_V3);
  });

  it('should create client with correct name and type', () => {
    expect(client.name).toBe('DeepSeek-deepseek_v3');
    expect(client.type).toBe(ModelType.DEEPSEEK_V3);
  });

  it('should call API successfully', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: { content: 'Hello, world!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        model: 'deepseek-chat',
      },
    };

    mockAxiosInstance.post.mockResolvedValue(mockResponse);

    const response = await client.call('Hello');

    expect(response.content).toBe('Hello, world!');
    expect(response.usage.totalTokens).toBe(15);
    expect(response.finishReason).toBe('stop');
  });

  it('should handle API errors', async () => {
    mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

    await expect(client.call('Hello')).rejects.toThrow('Network error');
  });

  it('should check availability', async () => {
    mockAxiosInstance.get.mockResolvedValue({ status: 200 });

    const available = await client.isAvailable();
    expect(available).toBe(true);
  });

  it('should handle availability check failure', async () => {
    mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

    const available = await client.isAvailable();
    expect(available).toBe(false);
  });

  it('should update config', () => {
    const newConfig = {
      apiKey: 'new-key',
      maxTokens: 8192,
    };

    client.updateConfig(newConfig);

    expect(client.config.apiKey).toBe('new-key');
    expect(client.config.maxTokens).toBe(8192);
  });

  it('should return model info', () => {
    const info = client.getModelInfo();
    
    expect(info.name).toBe('DeepSeek-deepseek_v3');
    expect(info.type).toBe(ModelType.DEEPSEEK_V3);
    expect(info.model).toBe('deepseek-chat');
  });
});