export { Logger } from './logger.js';
export { PriorityQueue } from './priority-queue.js';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidPath(path: string): boolean {
  try {
    return path.length > 0 && !path.includes('\x00');
  } catch {
    return false;
  }
}

export function sanitizePath(path: string): string {
  return path.replace(/[<>:"|?*\x00-\x1f]/g, '').trim();
}

export function parseJSON<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}