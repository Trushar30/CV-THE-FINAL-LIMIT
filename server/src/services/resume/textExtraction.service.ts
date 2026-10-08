import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';

export interface ExtractionResult {
  text: string;
  charCount: number;
  isScannedOrEmpty: boolean;
  mimeType: string;
}

export class TextExtractionService {
  /**
   * Minimum character threshold for a meaningful textual document.
   * Scanned PDFs (pure images without OCR layer) typically yield 0 or only pagination strings.
   */
  private static readonly MIN_MEANINGFUL_TEXT_LENGTH = 40;

  /**
   * Extracts raw text from a document buffer based on its verified MIME type.
   */
  public async extractText(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    if (!buffer || buffer.length === 0) {
      throw AppError.validation('Cannot extract text from an empty buffer.', {
        reason: 'EMPTY_BUFFER',
      });
    }

    let rawText = '';

    if (mimeType === 'application/pdf') {
      try {
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        rawText = textResult?.text ?? '';
        await parser.destroy();
      } catch (err) {
        logger.error(`[TextExtraction] PDF parsing failed: ${(err as Error).message}`);
        throw AppError.badRequest('Failed to extract text from PDF file.', {
          details: (err as Error).message,
        });
      }
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/docx'
    ) {
      try {
        const mammothModule =
          (mammoth as unknown as { default?: typeof mammoth }).default || mammoth;
        const result = await mammothModule.extractRawText({ buffer });
        rawText = result?.value ?? '';
      } catch (err) {
        logger.error(`[TextExtraction] DOCX parsing failed: ${(err as Error).message}`);
        throw AppError.badRequest('Failed to extract text from DOCX file.', {
          details: (err as Error).message,
        });
      }
    } else {
      throw AppError.badRequest(`Unsupported MIME type for text extraction: ${mimeType}`);
    }

    // Clean text: strip pagination artifacts, e.g. "-- 1 of 1 --"
    const cleaned = rawText
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Check alphanumeric character count to detect scanned image PDFs or blanks
    const alphaNumericCount = (cleaned.match(/[a-zA-Z0-9]/g) || []).length;
    const isScannedOrEmpty = alphaNumericCount < TextExtractionService.MIN_MEANINGFUL_TEXT_LENGTH;

    return {
      text: isScannedOrEmpty ? '' : cleaned,
      charCount: alphaNumericCount,
      isScannedOrEmpty,
      mimeType,
    };
  }
}

export const textExtractionService = new TextExtractionService();
