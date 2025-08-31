#!/usr/bin/env node

import { TMDCoder } from '../src/index.js';
import { Logger } from '../src/utils/index.js';

async function basicUsageExample(): Promise<void> {
  console.log('🚀 TMD Coder 基本使用示例');

  try {
    // 创建TMDCoder实例
    const coder = new TMDCoder();

    // 初始化（需要配置API密钥）
    await coder.initialize({
      verbose: true,
    });

    console.log('✅ TMD Coder 初始化成功');

    // 检查健康状态
    console.log('\n📊 检查系统健康状态...');
    const health = await coder.checkHealth();
    console.log(JSON.stringify(health, null, 2));

    // 列出可用模型
    console.log('\n🤖 可用模型列表...');
    const models = await coder.listModels();
    models.forEach(model => {
      console.log(`- ${model.name} (${model.type}) - ${model.healthy ? '健康' : '不可用'}`);
    });

    // 示例查询（如果有可用的API密钥）
    if (process.env.DEEPSEEK_API_KEY) {
      console.log('\n💬 处理示例查询...');
      try {
        const response = await coder.processQuery('你好，请介绍一下自己');
        console.log('🤖 回答:', response);
      } catch (error) {
        console.log('⚠️ 查询失败（可能是API密钥问题）:', error instanceof Error ? error.message : error);
      }
    } else {
      console.log('\n⚠️ 未设置 DEEPSEEK_API_KEY 环境变量，跳过查询示例');
    }

    // 代码分析示例
    console.log('\n📋 创建测试文件进行分析...');
    const fs = await import('fs-extra');
    const testFilePath = './test-example.js';
    const testCode = `
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5));
`;

    await fs.writeFile(testFilePath, testCode);

    try {
      if (process.env.DEEPSEEK_API_KEY) {
        const analysis = await coder.analyzeCode(testFilePath);
        console.log('📊 代码分析结果:', analysis);
      } else {
        console.log('⚠️ 未设置API密钥，跳过代码分析示例');
      }
    } catch (error) {
      console.log('⚠️ 代码分析失败:', error instanceof Error ? error.message : error);
    } finally {
      // 清理测试文件
      await fs.remove(testFilePath);
    }

    // 优雅关闭
    console.log('\n🔄 关闭TMD Coder...');
    await coder.shutdown();
    console.log('✅ 示例完成');

  } catch (error) {
    console.error('❌ 示例执行失败:', error);
    Logger.error('Basic usage example failed', error instanceof Error ? error : { error });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await basicUsageExample();
}