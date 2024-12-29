import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log dosyaları için klasör yolu
const logDir = path.join(__dirname, 'logs');

// Winston logger yapılandırması
export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'ocr-service' },
    transports: [
        // Hata logları için ayrı dosya
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Tüm loglar için genel dosya
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Geliştirme ortamında konsola da yazdır
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Hata yakalama
logger.exceptions.handle(
    new winston.transports.File({
        filename: path.join(logDir, 'exceptions.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    })
); 