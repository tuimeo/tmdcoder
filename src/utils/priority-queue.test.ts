import { describe, it, expect } from 'vitest';
import { PriorityQueue } from './priority-queue.js';

describe('PriorityQueue', () => {
  it('should enqueue and dequeue items in priority order', () => {
    const queue = new PriorityQueue<string>();
    
    queue.enqueue('low priority', 1);
    queue.enqueue('high priority', 10);
    queue.enqueue('medium priority', 5);
    
    expect(queue.dequeue()).toBe('high priority');
    expect(queue.dequeue()).toBe('medium priority');
    expect(queue.dequeue()).toBe('low priority');
  });

  it('should return undefined when dequeuing empty queue', () => {
    const queue = new PriorityQueue<string>();
    expect(queue.dequeue()).toBeUndefined();
  });

  it('should return front item without removing it', () => {
    const queue = new PriorityQueue<string>();
    queue.enqueue('test item', 5);
    
    expect(queue.front()).toBe('test item');
    expect(queue.size()).toBe(1);
  });

  it('should check if queue is empty', () => {
    const queue = new PriorityQueue<string>();
    expect(queue.isEmpty()).toBe(true);
    
    queue.enqueue('test', 1);
    expect(queue.isEmpty()).toBe(false);
  });

  it('should return correct size', () => {
    const queue = new PriorityQueue<string>();
    expect(queue.size()).toBe(0);
    
    queue.enqueue('item1', 1);
    queue.enqueue('item2', 2);
    expect(queue.size()).toBe(2);
    
    queue.dequeue();
    expect(queue.size()).toBe(1);
  });

  it('should clear all items', () => {
    const queue = new PriorityQueue<string>();
    queue.enqueue('item1', 1);
    queue.enqueue('item2', 2);
    
    queue.clear();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('should convert to array', () => {
    const queue = new PriorityQueue<string>();
    queue.enqueue('low', 1);
    queue.enqueue('high', 10);
    queue.enqueue('medium', 5);
    
    const array = queue.toArray();
    expect(array).toEqual(['high', 'medium', 'low']);
  });
});