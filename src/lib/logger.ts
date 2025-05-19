/**
 * 日志模块
 */

import winston from 'winston';
const { format } = winston;

// 创建日志格式化器
const logFormat = format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// 创建Winston日志记录器
const loggerInstance = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        logFormat
      )
    }),
    // 文件输出
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
  exitOnError: false
});

/**
 * 输出调试信息
 * @param {string} message 日志消息
 */
function debug(message: string): void {
  loggerInstance.debug(message);
}

/**
 * 输出信息
 * @param {string} message 日志消息
 */
function info(message: string): void {
  loggerInstance.info(message);
}

/**
 * 输出警告
 * @param {string} message 日志消息
 */
function warn(message: string): void {
  loggerInstance.warn(message);
}

/**
 * 输出错误
 * @param {string} message 日志消息
 * @param {Error} [error] 错误对象
 */
function error(message: string, error: Error | null = null): void {
  if (error) {
    loggerInstance.error(`${message}: ${error.message}\n${error.stack}`);
  } else {
    loggerInstance.error(message);
  }
}

export const logger = {
  debug,
  info,
  warn,
  error
};
