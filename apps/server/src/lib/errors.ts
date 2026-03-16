export class NotFoundError extends Error {
	constructor(entity: string, id: string) {
		super(`${entity} not found: ${id}`);
		this.name = "NotFoundError";
	}
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

/** Thrown when a MIME type is not supported for text extraction (e.g. PDF/DOCX stub). */
export class ExtractionNotSupportedError extends Error {
	constructor(mimeType: string) {
		super(`Text extraction not supported for type: ${mimeType}`);
		this.name = "ExtractionNotSupportedError";
	}
}
