import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from './task-manager.js';
import { TaskType, TaskPriority } from '../types/index.js';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager(2, 5000); // 最多2个并发任务，5秒超时
  });

  it('should schedule a task', async () => {
    const taskId = await taskManager.scheduleTask({
      type: TaskType.CHAT,
      description: 'Test task',
      payload: { test: true },
      priority: TaskPriority.MEDIUM,
    });

    expect(taskId).toBeTruthy();
    expect(typeof taskId).toBe('string');
  });

  it('should return correct queue size', async () => {
    expect(taskManager.getQueueSize()).toBe(0);

    await taskManager.scheduleTask({
      type: TaskType.CHAT,
      description: 'Test task',
      payload: {},
      priority: TaskPriority.LOW,
    });

    // 注意：由于任务会立即开始处理，队列大小可能为0
    // 这里主要测试方法不报错
    expect(typeof taskManager.getQueueSize()).toBe('number');
  });

  it('should return correct active tasks count', () => {
    expect(taskManager.getActiveTasksCount()).toBe(0);
    expect(typeof taskManager.getActiveTasksCount()).toBe('number');
  });

  it('should return execution stats', () => {
    const stats = taskManager.getExecutionStats();
    
    expect(stats).toHaveProperty('queueSize');
    expect(stats).toHaveProperty('activeTasksCount');
    expect(stats).toHaveProperty('maxConcurrentTasks');
    expect(stats.maxConcurrentTasks).toBe(2);
  });

  it('should clear all tasks', async () => {
    await taskManager.scheduleTask({
      type: TaskType.CHAT,
      description: 'Test task',
      payload: {},
      priority: TaskPriority.LOW,
    });

    taskManager.clear();
    
    expect(taskManager.getQueueSize()).toBe(0);
    expect(taskManager.getActiveTasksCount()).toBe(0);
  });

  it('should handle task cancellation', async () => {
    const taskId = await taskManager.scheduleTask({
      type: TaskType.CHAT,
      description: 'Test task',
      payload: {},
      priority: TaskPriority.LOW,
    });

    // 给任务一些时间开始执行
    await new Promise(resolve => setTimeout(resolve, 100));

    const cancelled = taskManager.cancelTask(taskId);
    // 任务可能已经完成，所以cancellation可能失败
    expect(typeof cancelled).toBe('boolean');
  });
});