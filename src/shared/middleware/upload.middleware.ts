import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ValidationError } from '../utils/app-error';

// Ensure upload directory exists
const uploadDir = 'uploads/receipts';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

// File filter to allow only images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    }
    cb(new ValidationError('Only image files (jpeg, jpg, png, webp) are allowed'));
};

// Create multer instance
export const uploadReceipt = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: fileFilter,
});

// Middleware to validate file content (Magic Numbers)
export const validateFileContent = (req: any, res: any, next: any) => {
    if (!req.file) return next();

    const filePath = req.file.path;
    const buffer = Buffer.alloc(12); // Read first 12 bytes

    fs.open(filePath, 'r', (err, fd) => {
        if (err) return next(new ValidationError('Failed to process file'));

        fs.read(fd, buffer, 0, 12, 0, (err, bytesRead, buffer) => {
            fs.close(fd, () => { }); // Close file descriptor

            if (err) return next(new ValidationError('Failed to read file'));

            // Magic Numbers
            // JPEG: FF D8 FF
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            // WebP: 52 49 46 46 ... 57 45 42 50

            const header = buffer.toString('hex').toUpperCase();

            const isJpeg = header.startsWith('FFD8FF');
            const isPng = header.startsWith('89504E470D0A1A0A');
            const isWebp = header.startsWith('52494646') && header.endsWith('57454250');

            if (isJpeg || isPng || isWebp) {
                return next();
            }

            // Invalid file - delete it
            fs.unlink(filePath, () => { });
            return next(new ValidationError('Invalid file format. Only actual images are allowed.'));
        });
    });
};
