import winston from 'winston';
import path from 'path';

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: process.env['NODE_ENV'] === 'development' ? 'debug' : 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.simple()
        ),
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
          }),
          new winston.transports.File({
            filename: path.join(process.cwd(), 'tmd.log'),
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          }),
        ],
      });
    }
    return Logger.instance;
  }

  static debug(message: string, meta?: Record<string, unknown>): void {
    Logger.getInstance().debug(message, meta);
  }

  static info(message: string, meta?: Record<string, unknown>): void {
    Logger.getInstance().info(message, meta);
  }

  static warn(message: string, meta?: Record<string, unknown>): void {
    Logger.getInstance().warn(message, meta);
  }

  static error(message: string, error?: Error | Record<string, unknown>): void {
    Logger.getInstance().error(message, error);
  }
}