import crypto from 'crypto';
import { AppError } from '../utils/app-error';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_key_must_be_32_bytes_long!'; // Must be 32 chars
const IV_LENGTH = 16; // For AES, this is always 16

class EncryptionService {
    encrypt(text: string): string {
        try {
            if (!text) return text;
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(
                'aes-256-cbc',
                Buffer.from(ENCRYPTION_KEY),
                iv
            );
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new AppError('Data processing failed', 500);
        }
    }

    decrypt(text: string): string {
        try {
            if (!text) return text;
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(
                'aes-256-cbc',
                Buffer.from(ENCRYPTION_KEY),
                iv
            );
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            console.error('Decryption failed:', error);
            // Return original text if decryption fails (fallback for unencrypted data)
            return text;
        }
    }
}

export default new EncryptionService();
