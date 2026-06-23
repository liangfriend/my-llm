// src/logger.ts
import winston from 'winston';

const logPrefix = 'melody-model';
const ignoreErrorFilter = winston.format((info) => {
    if (info.level === 'error') {
        return false;
    }
    return info;
});
const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp }) => {
        return `[${timestamp}] [${logPrefix}] [${level.toUpperCase()}] ${message}`;
    }),
);

const logger = winston.createLogger({
    level: 'info',
    format: baseFormat,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/info.log',
            format: winston.format.combine(ignoreErrorFilter(), baseFormat),
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
        }),
    ],
});

export default logger;
