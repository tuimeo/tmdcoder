import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import type { CLIOptions } from '../types/index.js';
import { TMDCoder } from '../core/tmd-coder.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('tmd-coder')
    .description('TMD Coder - AI编程助手，模仿Claude Code，使用DeepSeek模型')
    .version('0.1.0');

  // 主要的交互式命令
  program
    .command('chat')
    .description('启动交互式对话模式')
    .option('-v, --verbose', '详细日志输出')
    .option('-m, --model <model>', '指定使用的模型类型')
    .option('-c, --config <path>', '指定配置文件路径')
    .action(async (options: CLIOptions) => {
      try {
        console.log(chalk.blue.bold('🚀 TMD Coder 交互式模式'));
        console.log(chalk.gray('输入 /help 查看可用命令，输入 /exit 退出\n'));

        const coder = new TMDCoder();
        await coder.initialize(options);

        await startInteractiveMode(coder);
      } catch (error) {
        console.error(chalk.red('❌ 启动失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // 单次执行命令
  program
    .command('ask <question>')
    .description('单次提问模式')
    .option('-v, --verbose', '详细日志输出')
    .option('-m, --model <model>', '指定使用的模型类型')
    .option('-c, --config <path>', '指定配置文件路径')
    .option('-t, --timeout <ms>', '设置超时时间（毫秒）')
    .action(async (question: string, options: CLIOptions) => {
      const spinner = ora('正在思考中...').start();

      try {
        const coder = new TMDCoder();
        await coder.initialize(options);

        const response = await coder.processQuery(question);
        spinner.stop();

        console.log(chalk.green('\n🤖 TMD Coder:'));
        console.log(response);
      } catch (error) {
        spinner.fail(chalk.red('处理失败'));
        console.error(chalk.red('❌ 错误:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // 代码分析命令
  program
    .command('analyze <path>')
    .description('分析代码文件或目录')
    .option('-v, --verbose', '详细日志输出')
    .option('-m, --model <model>', '指定使用的模型类型')
    .option('-c, --config <path>', '指定配置文件路径')
    .action(async (path: string, options: CLIOptions) => {
      const spinner = ora('正在分析代码...').start();

      try {
        const coder = new TMDCoder();
        await coder.initialize(options);

        const analysis = await coder.analyzeCode(path);
        spinner.stop();

        console.log(chalk.green('\n📊 代码分析结果:'));
        console.log(analysis);
      } catch (error) {
        spinner.fail(chalk.red('分析失败'));
        console.error(chalk.red('❌ 错误:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // 配置命令
  program
    .command('config')
    .description('管理配置')
    .option('--set <key=value>', '设置配置项')
    .option('--get <key>', '获取配置项')
    .option('--list', '列出所有配置')
    .action(async (options: { set?: string; get?: string; list?: boolean }) => {
      try {
        const coder = new TMDCoder();
        
        if (options.list) {
          const config = await coder.getConfig();
          console.log(chalk.blue('📋 当前配置:'));
          console.log(JSON.stringify(config, null, 2));
        } else if (options.get) {
          const value = await coder.getConfigValue(options.get);
          console.log(chalk.blue(`${options.get}:`), value);
        } else if (options.set) {
          const [key, value] = options.set.split('=');
          if (!key || !value) {
            console.error(chalk.red('❌ 无效的配置格式，请使用 key=value'));
            process.exit(1);
          }
          await coder.setConfigValue(key, value);
          console.log(chalk.green(`✅ 配置已更新: ${key} = ${value}`));
        } else {
          console.log(chalk.yellow('请指定操作: --set, --get, 或 --list'));
        }
      } catch (error) {
        console.error(chalk.red('❌ 配置操作失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // 健康检查命令
  program
    .command('health')
    .description('检查系统健康状态')
    .action(async () => {
      const spinner = ora('检查系统健康状态...').start();

      try {
        const coder = new TMDCoder();
        await coder.initialize();

        const health = await coder.checkHealth();
        spinner.stop();

        console.log(chalk.blue('\n🔍 系统健康状态:'));
        console.log(JSON.stringify(health, null, 2));
      } catch (error) {
        spinner.fail(chalk.red('健康检查失败'));
        console.error(chalk.red('❌ 错误:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return program;
}

async function startInteractiveMode(coder: TMDCoder): Promise<void> {
  while (true) {
    try {
      const answers = await inquirer.prompt({
        type: 'input',
        name: 'input',
        message: chalk.cyan('You:'),
      });
      const { input } = answers;

      if (!input.trim()) continue;

      // 处理特殊命令
      if (input.startsWith('/')) {
        const handled = await handleSpecialCommand(input.trim(), coder);
        if (handled === 'exit') break;
        continue;
      }

      // 处理普通查询
      const spinner = ora('正在思考中...').start();
      try {
        const response = await coder.processQuery(input);
        spinner.stop();

        console.log(chalk.green('\n🤖 TMD Coder:'));
        console.log(response);
        console.log(''); // 添加空行
      } catch (error) {
        spinner.fail(chalk.red('处理失败'));
        console.error(chalk.red('❌ 错误:'), error instanceof Error ? error.message : error);
        console.log(''); // 添加空行
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'isTTYError' in error) {
        // 用户可能按了 Ctrl+C
        break;
      }
      console.error(chalk.red('❌ 输入错误:'), error);
    }
  }
}

async function handleSpecialCommand(command: string, coder: TMDCoder): Promise<string | void> {
  const [cmd] = command.slice(1).split(' ');

  switch (cmd) {
    case 'help':
      showHelp();
      break;

    case 'exit':
    case 'quit':
      console.log(chalk.yellow('👋 再见！'));
      return 'exit';

    case 'clear':
      console.clear();
      console.log(chalk.blue.bold('🚀 TMD Coder 交互式模式'));
      console.log(chalk.gray('输入 /help 查看可用命令，输入 /exit 退出\n'));
      break;

    case 'status':
      try {
        const health = await coder.checkHealth();
        console.log(chalk.blue('📊 系统状态:'));
        console.log(JSON.stringify(health, null, 2));
      } catch (error) {
        console.error(chalk.red('❌ 获取状态失败:'), error);
      }
      break;

    case 'models':
      try {
        const models = await coder.listModels();
        console.log(chalk.blue('🤖 可用模型:'));
        models.forEach(model => {
          const status = model.healthy ? chalk.green('✅') : chalk.red('❌');
          console.log(`  ${status} ${model.name} (${model.type})`);
        });
      } catch (error) {
        console.error(chalk.red('❌ 获取模型列表失败:'), error);
      }
      break;

    default:
      console.log(chalk.red(`❌ 未知命令: ${cmd}`));
      showHelp();
      break;
  }
}

function showHelp(): void {
  console.log(chalk.blue('\n📚 可用命令:'));
  console.log(chalk.yellow('  /help') + '     - 显示此帮助信息');
  console.log(chalk.yellow('  /exit') + '     - 退出程序');
  console.log(chalk.yellow('  /clear') + '    - 清空屏幕');
  console.log(chalk.yellow('  /status') + '   - 显示系统状态');
  console.log(chalk.yellow('  /models') + '   - 显示可用模型');
  console.log(chalk.gray('\n直接输入问题即可开始对话\n'));
}