import crypto from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from './errors.js';

export interface ValidatedResumeFile {
  mimeType:
    'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  extension: 'pdf' | 'docx';
  sanitizedFilename: string;
  sha256: string;
  sizeBytes: number;
}

/**
 * Sanitizes a filename to protect against path traversal and special characters.
 */
export function sanitizeFilename(originalName: string, expectedExt: 'pdf' | 'docx'): string {
  // Strip any directory traversal paths
  const base = path.basename(originalName || `resume.${expectedExt}`);

  // Remove existing extension for cleaning
  const nameWithoutExt = base.replace(/\.[^/.]+$/, '');

  // Keep only alphanumeric characters, underscores, hyphens, and dots
  const cleaned = nameWithoutExt.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_{2,}/g, '_');

  // Limit length to 100 characters for the base name
  const truncated = (cleaned.length > 0 ? cleaned : 'resume').slice(0, 100);

  return `${truncated}.${expectedExt}`;
}

/**
 * Computes SHA-256 hex checksum of a buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validates a resume buffer via binary magic bytes, integrity / corruption checks,
 * and password-protection detection. Never trusts user-supplied file extensions or MIME types.
 */
export async function validateResumeFile(
  buffer: Buffer,
  originalFilename: string
): Promise<ValidatedResumeFile> {
  if (!buffer || buffer.length === 0) {
    throw AppError.validation('Uploaded file is empty.', { reason: 'EMPTY_FILE' });
  }

  // Minimum realistic size for a PDF or DOCX file (headers, structure, EOF)
  if (buffer.length < 32) {
    throw AppError.validation('File size is too small to be a valid document.', {
      reason: 'CORRUPT_FILE',
    });
  }

  const detected = await fileTypeFromBuffer(buffer);

  // Check PDF signature: Starts with %PDF- (0x25 0x50 0x44 0x46 0x2D)
  const isPdfMagic =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d;

  // Check ZIP signature: Starts with PK\x03\x04 (0x50 0x4B 0x03 0x04)
  const isZipMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (detected?.ext === 'pdf' || isPdfMagic) {
    // 1. Password protection check for PDF
    // Encrypted PDFs contain an /Encrypt entry in the trailer dictionary or cross-reference table
    const latinStr = buffer.toString('latin1');
    const isEncryptedPdf = /\/Encrypt\s*(\d+\s+\d+\s+R|<)/i.test(latinStr);
    if (isEncryptedPdf) {
      throw AppError.validation(
        'Password-protected or encrypted PDF files are not supported. Please upload an unprotected resume.',
        { reason: 'PASSWORD_PROTECTED_FILE' }
      );
    }

    // 2. Corrupt / truncated file check for PDF
    // A complete, uncorrupted PDF must terminate with the %%EOF marker
    const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString('latin1');
    if (!tail.includes('%%EOF')) {
      throw AppError.validation(
        'The uploaded PDF file is corrupt or truncated (missing %%EOF marker).',
        { reason: 'CORRUPT_FILE' }
      );
    }

    const sanitizedFilename = sanitizeFilename(originalFilename, 'pdf');
    const sha256 = computeSha256(buffer);

    return {
      mimeType: 'application/pdf',
      extension: 'pdf',
      sanitizedFilename,
      sha256,
      sizeBytes: buffer.length,
    };
  }

  // Check OLE compound signature (used by password-encrypted Office documents)
  const isOleMagic =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1;

  const latinStr = buffer.toString('latin1');
  const hasOfficeEncryptionStream =
    (isZipMagic || isOleMagic) &&
    (latinStr.includes('EncryptedPackage') || latinStr.includes('EncryptionInfo'));

  // If encrypted OLE compound document
  if (isOleMagic && hasOfficeEncryptionStream) {
    throw AppError.validation(
      'Password-protected or encrypted DOCX files are not supported. Please upload an unprotected resume.',
      { reason: 'PASSWORD_PROTECTED_FILE' }
    );
  }

  if (isZipMagic || detected?.ext === 'docx') {
    // 1. Password protection check for DOCX (standard zip encryption flag bit 0 or Office encryption stream)
    const hasZipEncryptionFlag = buffer.length > 6 && ((buffer[6] ?? 0) & 0x01) !== 0;

    if (hasZipEncryptionFlag || hasOfficeEncryptionStream) {
      throw AppError.validation(
        'Password-protected or encrypted DOCX files are not supported. Please upload an unprotected resume.',
        { reason: 'PASSWORD_PROTECTED_FILE' }
      );
    }

    // 2. Corrupt / truncated file check for DOCX (ZIP archive)
    // A valid ZIP file must contain the End of Central Directory (EOCD) signature: PK\x05\x06 (0x50 0x4B 0x05 0x06)
    const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const tailBuf = buffer.subarray(Math.max(0, buffer.length - 65557));
    if (!tailBuf.includes(eocdSignature)) {
      throw AppError.validation(
        'The uploaded DOCX file is corrupt or truncated (invalid ZIP structure).',
        { reason: 'CORRUPT_FILE' }
      );
    }

    // 3. Must be an actual OOXML Word document, not a generic ZIP or other format
    const hasWordStructure =
      buffer.includes(Buffer.from('word/')) || buffer.includes(Buffer.from('[Content_Types].xml'));

    if (detected?.ext !== 'docx' && !hasWordStructure) {
      throw AppError.validation(
        'Invalid file type. Only genuine PDF and DOCX files are accepted (verified by file content).',
        {
          reason: 'INVALID_FILE_TYPE',
          detectedType: detected?.ext ?? 'zip',
          detectedMime: detected?.mime ?? 'application/zip',
        }
      );
    }

    const sanitizedFilename = sanitizeFilename(originalFilename, 'docx');
    const sha256 = computeSha256(buffer);

    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      sanitizedFilename,
      sha256,
      sizeBytes: buffer.length,
    };
  }

  // Not a valid PDF or DOCX
  throw AppError.validation(
    'Invalid file type. Only genuine PDF and DOCX files are accepted (verified by file content).',
    {
      reason: 'INVALID_FILE_TYPE',
      detectedType: detected?.ext ?? 'unknown',
      detectedMime: detected?.mime ?? 'unknown',
    }
  );
}
