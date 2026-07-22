/**
 * Upload endpoint contract — types and constraint constants only.
 *
 * The endpoint itself (Vercel Blob-backed, multipart) is Track B5; the
 * frontend capture flow (getUserMedia, contractor spec §4) and the agent
 * pipe consume these types. Binary uploads never travel over the agent
 * tool transport — the web app uploads and tools receive the returned
 * reference (PLAN.md, "Vercel Blob" stack note).
 *
 * T1 contract freeze: changes to this file after T1 merges are deliberate
 * contract PRs (docs/features/t1-contracts/plan.md).
 */

/** Multipart form field name carrying the binary. */
export const UPLOAD_FILE_FIELD = "file" as const;

/** Accepted image mime types (plan D4: jpeg/png/webp). */
export const UPLOAD_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type UploadAcceptedMimeType =
  (typeof UPLOAD_ACCEPTED_MIME_TYPES)[number];

/**
 * Maximum accepted upload size in bytes (10 MiB).
 *
 * No spec-mandated value exists (contractor spec §9.5 leaves photo
 * size/compression open); 10 MiB comfortably covers uncompressed phone
 * camera output while bounding Blob cost. Revisit alongside §9.5.
 */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Request shape for the upload endpoint (B5).
 *
 * The wire format is `multipart/form-data` with the binary under
 * {@link UPLOAD_FILE_FIELD}; this type describes the validated result the
 * endpoint derives from that form, not a JSON body.
 */
export interface UploadRequest {
  /** The uploaded file part; `type` must be an accepted mime type. */
  file: {
    name: string;
    type: UploadAcceptedMimeType;
    /** Byte length; must be ≤ {@link UPLOAD_MAX_BYTES}. */
    size: number;
  };
}

/** Success response: an opaque id plus the stored blob's URL. */
export interface UploadResponse {
  uploadId: string;
  url: string;
}

/** Machine-readable failure reasons the endpoint may return. */
export type UploadErrorCode =
  /** Missing/malformed multipart body or missing file field. */
  | "invalid_request"
  /** File `type` not in {@link UPLOAD_ACCEPTED_MIME_TYPES}. */
  | "unsupported_media_type"
  /** File `size` exceeds {@link UPLOAD_MAX_BYTES}. */
  | "payload_too_large"
  /** Caller's session/token failed resolution. */
  | "unauthorized"
  /** Blob storage write failed. */
  | "upload_failed";

/** Error response body for any non-2xx upload result. */
export interface UploadErrorResponse {
  error: {
    code: UploadErrorCode;
    message: string;
  };
}

/** Union of every body the upload endpoint can return. */
export type UploadResult = UploadResponse | UploadErrorResponse;
