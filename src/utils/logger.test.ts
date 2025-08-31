import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from './logger.js';

describe('Logger', () => {
  beforeEach(() => {
    // 重置winston实例
    (Logger as any).instance = undefined;
  });

  it('should create singleton instance', () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should log debug messages', () => {
    const mockDebug = vi.spyOn(Logger.getInstance(), 'debug');
    Logger.debug('test debug message');
    expect(mockDebug).toHaveBeenCalledWith('test debug message', undefined);
  });

  it('should log info messages', () => {
    const mockInfo = vi.spyOn(Logger.getInstance(), 'info');
    Logger.info('test info message');
    expect(mockInfo).toHaveBeenCalledWith('test info message', undefined);
  });

  it('should log warn messages', () => {
    const mockWarn = vi.spyOn(Logger.getInstance(), 'warn');
    Logger.warn('test warn message');
    expect(mockWarn).toHaveBeenCalledWith('test warn message', undefined);
  });

  it('should log error messages', () => {
    const mockError = vi.spyOn(Logger.getInstance(), 'error');
    const error = new Error('test error');
    Logger.error('test error message', error);
    expect(mockError).toHaveBeenCalledWith('test error message', error);
  });
});