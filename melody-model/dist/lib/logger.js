"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/logger.ts
const winston_1 = __importDefault(require("winston"));
const logPrefix = 'melody-model';
const ignoreErrorFilter = winston_1.default.format((info) => {
    if (info.level === 'error') {
        return false;
    }
    return info;
});
const baseFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}] [${logPrefix}] [${level.toUpperCase()}] ${message}`;
}));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: baseFormat,
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new winston_1.default.transports.File({
            filename: 'logs/info.log',
            format: winston_1.default.format.combine(ignoreErrorFilter(), baseFormat),
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
        }),
    ],
});
exports.default = logger;
