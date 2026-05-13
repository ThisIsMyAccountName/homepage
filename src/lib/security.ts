/**
 * Security utilities for name submission.
 */

// Patterns that indicate injection/exploit attempts
const EXPLOIT_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i, // onclick=, onerror=, etc.
  /<iframe/i,
  /<img[^>]+onerror/i,
  /document\./i,
  /window\./i,
  /eval\s*\(/i,
  /alert\s*\(/i,
  /fetch\s*\(/i,
  /XMLHttpRequest/i,
  /\bor\b.*=.*--/i, // SQL injection
  /union\s+select/i,
  /drop\s+table/i,
  /;\s*delete\s/i,
  /'\s*or\s+'1'\s*=\s*'1/i,
  /--\s*$/,
  /\/\*.*\*\//,
  /<\/?\w+[^>]*>/,  // Any HTML tags
  /&#x?[0-9a-f]+;/i, // HTML entities
  /%3[cC]/, // URL-encoded <
  /\$\{.*\}/, // Template literals
  /\{\{.*\}\}/, // Template injection
];

export interface SanitizeResult {
  clean: string;
  exploitDetected: boolean;
  exploitType?: string;
}

/**
 * Sanitize a name submission. Returns cleaned name and whether an exploit was attempted.
 */
export function sanitizeName(raw: string): SanitizeResult {
  // Check for exploit patterns
  for (const pattern of EXPLOIT_PATTERNS) {
    if (pattern.test(raw)) {
      return {
        clean: "",
        exploitDetected: true,
        exploitType: pattern.source,
      };
    }
  }

  // Basic sanitization: strip anything that's not alphanumeric, space, dash, underscore, period
  let clean = raw.replace(/[^a-zA-Z0-9 _.\-]/g, "").trim();

  // Enforce length limits
  if (clean.length > 20) clean = clean.slice(0, 20);
  if (clean.length < 1) clean = "Anonymous";

  return { clean, exploitDetected: false };
}

/**
 * Validate a leaderboard submission is plausible.
 */
export function validateSubmission(time: number, errors: number): boolean {
  // Time must be positive and under 1 hour
  if (time < 5 || time > 3600) return false;
  // Errors must be non-negative and reasonable
  if (errors < 0 || errors > 100) return false;
  return true;
}
