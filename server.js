import express from 'express';
import multer from 'multer';
import cors from 'cors';
import Tesseract from 'tesseract.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from './logger.js';
import { PDFExtract } from 'pdf.js-extract';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pdfExtract = new PDFExtract();

// Belge depolama için basit bir Map
const documents = new Map();

// PDF işleme fonksiyonu
async function extractTextFromPDF(buffer) {
    try {
        const options = {};
        const data = await pdfExtract.extractBuffer(buffer, options);

        let fullText = `Toplam Sayfa Sayısı: ${data.pages.length}\n\n`;

        data.pages.forEach((page, pageIndex) => {
            fullText += `Sayfa ${pageIndex + 1}:\n`;
            page.content.forEach(item => {
                fullText += item.str + ' ';
            });
            fullText += '\n\n';
        });

        return fullText;
    } catch (error) {
        logger.error('PDF işleme hatası:', error);
        throw new Error('PDF işlenirken bir hata oluştu');
    }
}

const app = express();
const port = 3000;

// Logs klasörünü oluştur
const logDir = path.join(__dirname, 'logs');
await fs.mkdir(logDir, { recursive: true }).catch(err => {
    console.error('Logs klasörü oluşturulamadı:', err);
});

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            logger.warn('Dosya yüklenmedi');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        logger.info('Dosya yükleme başladı', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        console.log('Processing file...');
        let text = '';

        // Check file type
        if (req.file.mimetype === 'application/pdf') {
            logger.info('PDF işleme başladı');
            text = await extractTextFromPDF(req.file.buffer);
            logger.info('PDF işleme tamamlandı', {
                textLength: text.length
            });
        } else {
            logger.info('OCR işleme başladı');
            const result = await Tesseract.recognize(
                req.file.buffer,
                'eng',
                {
                    logger: progress => {
                        logger.debug('OCR ilerleme', { progress });
                    }
                }
            );
            text = result.data.text;
            logger.info('OCR işleme tamamlandı', {
                textLength: text.length
            });
        }

        // Generate unique file ID
        const fileId = crypto.randomBytes(16).toString('hex');

        // Belgeyi sakla
        documents.set(fileId, {
            fileName: req.file.originalname,
            text: text,
            highlights: [],
            timestamp: new Date()
        });

        logger.info('İşlem başarıyla tamamlandı', {
            fileId,
            textLength: text.length
        });

        res.json({
            success: true,
            text: text,
            fileId: fileId
        });
    } catch (error) {
        logger.error('Dosya işleme hatası', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Error processing file' });
    }
});

// Highlights endpoints
app.post('/highlights/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { highlights } = req.body;

        logger.info('İşaretlemeler kaydediliyor', {
            fileId,
            highlightCount: highlights.length
        });

        // Belgeyi bul ve işaretlemeleri güncelle
        const document = documents.get(fileId);
        if (!document) {
            throw new Error('Belge bulunamadı');
        }

        document.highlights = highlights;
        documents.set(fileId, document);

        res.json({ success: true });

        logger.info('İşaretlemeler başarıyla kaydedildi', {
            fileId,
            highlightCount: highlights.length
        });
    } catch (error) {
        logger.error('İşaretleme kaydetme hatası', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Error saving highlights' });
    }
});

// Belge getirme endpoint'i
app.get('/document/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const document = documents.get(fileId);

        if (document) {
            logger.info('Belge başarıyla getirildi', { fileId });
            res.json(document);
        } else {
            logger.warn('Belge bulunamadı', { fileId });
            res.status(404).json({ error: 'Belge bulunamadı' });
        }
    } catch (error) {
        logger.error('Belge getirme hatası', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Error retrieving document' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Sunucu hatası', {
        error: err.message,
        stack: err.stack
    });
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
    logger.info(`Server started on port ${port}`);
    console.log(`Server running at http://localhost:${port}`);
}); 