import { env } from '@/app/config/env'

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LoggerOptions {
  module: string
  minLevel?: LogLevel
}

class Logger {
  private module: string
  private minLevel: LogLevel

  constructor({ module, minLevel = LogLevel.DEBUG }: LoggerOptions) {
    this.module = module
    this.minLevel = minLevel
  }

  private shouldLog(level: LogLevel): boolean {
    // In development, allow all logs including DEBUG
    if (env.MODE === 'development') {
      return this.getLogLevelValue(level) >= this.getLogLevelValue(this.minLevel)
    }
    
    // In other environments, only log INFO and above
    return this.getLogLevelValue(level) >= this.getLogLevelValue(LogLevel.INFO)
  }

  private getLogLevelValue(level: LogLevel): number {
    const levels = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
    }
    return levels[level]
  }

  private formatMessage(level: LogLevel, message: string): string {
    return `[${level}][${this.module}] ${message}`
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message), ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message), ...args)
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message), ...args)
    }
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options)
} 