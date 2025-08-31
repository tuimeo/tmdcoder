import type {
  Task,
  TaskResult,
  TaskExecution,
  Context,
} from '../types/index.js';
import { TaskStatus } from '../types/index.js';
import { PriorityQueue, Logger, generateId } from '../utils/index.js';

export class TaskManager {
  private taskQueue: PriorityQueue<Task> = new PriorityQueue<Task>();
  private executionPool: Map<string, TaskExecution> = new Map();
  private maxConcurrentTasks: number;
  private defaultTimeout: number;

  constructor(maxConcurrentTasks = 5, defaultTimeout = 30000) {
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.defaultTimeout = defaultTimeout;
  }

  async scheduleTask(
    task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<string> {
    const fullTask: Task = {
      ...task,
      id: generateId(),
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.taskQueue.enqueue(fullTask, task.priority);
    Logger.info(`Task scheduled: ${fullTask.id}`, { type: fullTask.type });

    this.processQueue();
    return fullTask.id;
  }

  async executeTask(task: Task, context: Context): Promise<TaskResult> {
    Logger.info(`Executing task: ${task.id}`, { type: task.type });

    const startTime = Date.now();
    task.status = TaskStatus.IN_PROGRESS;
    task.updatedAt = new Date();

    const abortController = new AbortController();
    const timeout = task.timeout ?? this.defaultTimeout;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const result = await this.executeTaskInternal(task, context, abortController.signal);
      clearTimeout(timeoutId);

      task.status = result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED;
      task.updatedAt = new Date();

      Logger.info(`Task ${result.success ? 'completed' : 'failed'}: ${task.id}`, {
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      task.status = TaskStatus.FAILED;
      task.updatedAt = new Date();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Task failed: ${task.id}`, error instanceof Error ? error : { error });

      return {
        taskId: task.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    } finally {
      this.executionPool.delete(task.id);
    }
  }

  private async executeTaskInternal(
    task: Task,
    _context: Context,
    signal: AbortSignal
  ): Promise<TaskResult> {
    const startTime = Date.now();

    if (signal.aborted) {
      throw new Error('Task was aborted before execution');
    }

    // 这里应该根据task.type调用不同的执行器
    // 目前先返回一个模拟结果
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (signal.aborted) {
      throw new Error('Task was aborted during execution');
    }

    return {
      taskId: task.id,
      success: true,
      data: { message: `Task ${task.id} executed successfully` },
      duration: Date.now() - startTime,
    };
  }

  async executeParallel(tasks: Task[], context: Context): Promise<TaskResult[]> {
    Logger.info(`Executing ${tasks.length} tasks in parallel`);

    const promises = tasks.map(task => this.executeTask(task, context));
    return Promise.all(promises);
  }

  private async processQueue(): Promise<void> {
    if (this.executionPool.size >= this.maxConcurrentTasks || this.taskQueue.isEmpty()) {
      return;
    }

    const task = this.taskQueue.dequeue();
    if (!task) return;

    // 检查依赖关系
    if (task.dependencies && task.dependencies.length > 0) {
      const dependenciesCompleted = task.dependencies.every(depId => {
        const execution = this.executionPool.get(depId);
        return !execution; // 如果不在执行池中，说明已经完成
      });

      if (!dependenciesCompleted) {
        // 重新加入队列，等待依赖完成
        this.taskQueue.enqueue(task, task.priority);
        return;
      }
    }

    const abortController = new AbortController();
    const promise = this.executeTask(task, {} as Context); // 临时使用空context

    const execution: TaskExecution = {
      task,
      startedAt: new Date(),
      promise,
      abortController,
    };

    this.executionPool.set(task.id, execution);

    // 继续处理队列
    promise.finally(() => {
      this.processQueue();
    });
  }

  getTaskStatus(taskId: string): TaskStatus | undefined {
    const execution = this.executionPool.get(taskId);
    return execution?.task.status;
  }

  cancelTask(taskId: string): boolean {
    const execution = this.executionPool.get(taskId);
    if (!execution) return false;

    execution.abortController.abort();
    execution.task.status = TaskStatus.CANCELLED;
    execution.task.updatedAt = new Date();
    this.executionPool.delete(taskId);

    Logger.info(`Task cancelled: ${taskId}`);
    return true;
  }

  getQueueSize(): number {
    return this.taskQueue.size();
  }

  getActiveTasksCount(): number {
    return this.executionPool.size;
  }

  getExecutionStats(): {
    queueSize: number;
    activeTasksCount: number;
    maxConcurrentTasks: number;
  } {
    return {
      queueSize: this.getQueueSize(),
      activeTasksCount: this.getActiveTasksCount(),
      maxConcurrentTasks: this.maxConcurrentTasks,
    };
  }

  clear(): void {
    // 取消所有执行中的任务
    for (const execution of this.executionPool.values()) {
      execution.abortController.abort();
    }

    this.executionPool.clear();
    this.taskQueue.clear();
    Logger.info('TaskManager cleared');
  }
}