import validator from "validator";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

// Create a DOM environment for DOMPurify (needed for Node.js)
const window = new JSDOM("").window;
const purify = DOMPurify(window as any);

/**
 * Sanitize a string by removing HTML tags and escaping special characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  // Trim whitespace
  let sanitized = input.trim();
  // Remove HTML tags
  sanitized = purify.sanitize(sanitized, { ALLOWED_TAGS: [] });
  // Escape special characters
  sanitized = validator.escape(sanitized);
  return sanitized;
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = sanitizeString(sanitized[key]) as any;
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key]) as any;
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map((item: any) => 
        typeof item === "string" ? sanitizeString(item) : 
        typeof item === "object" && item !== null ? sanitizeObject(item) : 
        item
      ) as any;
    }
  }
  
  return sanitized;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required and must be a string" };
  }
  
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Email cannot be empty" };
  }
  
  if (trimmed.length > 255) {
    return { valid: false, error: "Email must be 255 characters or less" };
  }
  
  if (!validator.isEmail(trimmed)) {
    return { valid: false, error: "Email must be a valid email address (e.g., user@example.com)" };
  }
  
  return { valid: true };
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters long` };
  }
  
  if (trimmed.length > max) {
    return { valid: false, error: `${fieldName} must be ${max} characters or less` };
  }
  
  return { valid: true };
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  fieldNames: { start: string; end: string }
): { valid: boolean; error?: string } {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  
  if (isNaN(start.getTime())) {
    return { valid: false, error: `${fieldNames.start} must be a valid date (format: YYYY-MM-DD or ISO 8601)` };
  }
  
  if (isNaN(end.getTime())) {
    return { valid: false, error: `${fieldNames.end} must be a valid date (format: YYYY-MM-DD or ISO 8601)` };
  }
  
  if (start > end) {
    return { valid: false, error: `${fieldNames.start} must be before or equal to ${fieldNames.end}` };
  }
  
  return { valid: true };
}

/**
 * Validate file size (in bytes)
 */
export function validateFileSize(sizeInBytes: number, maxSizeMB: number = 5): { valid: boolean; error?: string } {
  const maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert MB to bytes
  
  if (sizeInBytes > maxSizeBytes) {
    return { valid: false, error: `File size must be ${maxSizeMB}MB or less. Current size: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB` };
  }
  
  return { valid: true };
}

/**
 * Validate image file type
 */
export function validateImageType(mimeType: string): { valid: boolean; error?: string } {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  
  if (!allowedTypes.includes(mimeType.toLowerCase())) {
    return { 
      valid: false, 
      error: `File type must be one of: ${allowedTypes.join(", ")}. Received: ${mimeType}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate base64 image data
 */
export function validateBase64Image(base64Data: string): { valid: boolean; error?: string; mimeType?: string } {
  if (!base64Data || typeof base64Data !== "string") {
    return { valid: false, error: "Image data must be a valid base64 string" };
  }
  
  // Check if it's a data URL
  const dataUrlMatch = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (dataUrlMatch) {
    const mimeType = `image/${dataUrlMatch[1]}`;
    const base64String = dataUrlMatch[2];
    
    // Validate mime type
    const typeCheck = validateImageType(mimeType);
    if (!typeCheck.valid) {
      return typeCheck;
    }
    
    // Validate base64 string
    if (!validator.isBase64(base64String)) {
      return { valid: false, error: "Invalid base64 image data" };
    }
    
    // Check size (approximate)
    const sizeInBytes = (base64String.length * 3) / 4;
    const sizeCheck = validateFileSize(sizeInBytes);
    if (!sizeCheck.valid) {
      return sizeCheck;
    }
    
    return { valid: true, mimeType };
  }
  
  // If it's just base64 without data URL prefix
  if (validator.isBase64(base64Data)) {
    // Try to determine type from first bytes (basic check)
    return { valid: true, mimeType: "image/png" }; // Default assumption
  }
  
  return { valid: false, error: "Image data must be a valid base64 string or data URL" };
}

/**
 * Validate URL
 */
export function validateUrl(url: string, fieldName: string = "URL"): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  const trimmed = url.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }
  
  if (!validator.isURL(trimmed, { require_protocol: false })) {
    return { valid: false, error: `${fieldName} must be a valid URL (e.g., https://example.com or example.com)` };
  }
  
  return { valid: true };
}

/**
 * Validate time format (HH:mm)
 */
export function validateTimeFormat(time: string, fieldName: string): { valid: boolean; error?: string } {
  if (!time || typeof time !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  const trimmed = time.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }
  
  // Validate HH:mm format
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(trimmed)) {
    return { valid: false, error: `${fieldName} must be in HH:mm format (e.g., 09:00, 17:30)` };
  }
  
  return { valid: true };
}

/**
 * Validate timezone
 */
export function validateTimezone(timezone: string): { valid: boolean; error?: string } {
  if (!timezone || typeof timezone !== "string") {
    return { valid: false, error: "Timezone must be a string" };
  }
  
  const trimmed = timezone.trim();
  
  // Check against common timezone formats
  // This is a basic check - in production, use a proper timezone library
  const timezoneRegex = /^[A-Z][a-z]+(\/[A-Z][a-z]+)*$/;
  if (!timezoneRegex.test(trimmed) && trimmed !== "UTC") {
    return { valid: false, error: "Timezone must be a valid IANA timezone (e.g., America/New_York, UTC)" };
  }
  
  return { valid: true };
}

/**
 * Validate UUID
 */
export function validateUUID(uuid: string, fieldName: string = "ID"): { valid: boolean; error?: string } {
  if (!uuid || typeof uuid !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  if (!validator.isUUID(uuid)) {
    return { valid: false, error: `${fieldName} must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)` };
  }
  
  return { valid: true };
}

/**
 * Validate numeric range
 */
export function validateNumericRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (typeof value !== "number" || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }
  
  if (value < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  
  if (value > max) {
    return { valid: false, error: `${fieldName} must be ${max} or less` };
  }
  
  return { valid: true };
}
