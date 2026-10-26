// Stage 1 of the RAG pipeline: text extraction with page metadata.
import { normalizeWhitespace } from "./text";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB request bodies.
export const ALLOWED_MIME_TYPES = ["application/pdf", "text/plain", "text/markdown"] as const;

export interface ExtractedPage {
  page: number | null; // null for plain-text files (no pages)
  text: string;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  pageCount: number | null;
  characterCount: number;
}

export class ExtractionError extends Error {
  constructor(message: string, public readonly code: "unsupported_type" | "too_large" | "empty" | "unreadable") {
    super(message);
  }
}

export function detectMimeType(fileName: string, declared: string | undefined): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return declared || "application/octet-stream";
}

export function validateUpload(fileName: string, mimeType: string, sizeBytes: number): void {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new ExtractionError(`Unsupported file type for "${fileName}". Upload a PDF or a plain-text (.txt / .md) file.`, "unsupported_type");
  }
  if (sizeBytes <= 0) throw new ExtractionError(`"${fileName}" is empty.`, "empty");
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new ExtractionError(`"${fileName}" is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, "too_large");
  }
}

/** Minimum readable characters before we accept a document. Scanned PDFs usually produce ~0. */
const MIN_CHARS = 40;

export async function extractText(bytes: Uint8Array, mimeType: string, fileName: string): Promise<ExtractionResult> {
  let pages: ExtractedPage[];
  let pageCount: number | null = null;

  if (mimeType === "application/pdf") {
    let raw: string[];
    try {
      const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const result = await pdfExtract(pdf, { mergePages: false });
      raw = result.text as unknown as string[];
      pageCount = result.totalPages;
    } catch (err) {
      throw new ExtractionError(
        `Could not read "${fileName}" as a PDF (${err instanceof Error ? err.message : "unknown error"}). The file may be corrupted or password-protected.`,
        "unreadable"
      );
    }
    pages = raw.map((text, i) => ({ page: i + 1, text: normalizeWhitespace(text) }));
  } else {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (text.includes("\u0000")) {
      throw new ExtractionError(`"${fileName}" looks like a binary file, not plain text.`, "unreadable");
    }
    pages = [{ page: null, text: normalizeWhitespace(text) }];
  }

  const characterCount = pages.reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);
  if (characterCount < MIN_CHARS) {
    throw new ExtractionError(
      mimeType === "application/pdf"
        ? `No readable text was found in "${fileName}". It is probably a scanned PDF (images only). OCR is not supported yet — upload a text-based PDF or a .txt copy.`
        : `"${fileName}" contains too little text to analyse.`,
      "empty"
    );
  }
  return { pages: pages.filter((p) => p.text.length > 0), pageCount, characterCount };
}
