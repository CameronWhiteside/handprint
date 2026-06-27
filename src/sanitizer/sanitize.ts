/**
 * Aggressive PII / secret sanitizer.
 * False positives are acceptable, leaked secrets are not.
 */

// Email pattern
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Item 6: PEM key/certificate blocks (private keys, certificates, etc.)
const PEM_RE = /-----BEGIN [A-Z0-9 ]+-----[\s\S]+?-----END [A-Z0-9 ]+-----/g;

// Item 6: Known prefixed token formats (Slack, Stripe, GitHub PATs/OAuth/apps)
const KNOWN_TOKEN_PREFIX_RE = /\b(?:xox[abprs]-[\w-]+|sk_(?:live|test)_[A-Za-z0-9]+|pk_(?:live|test)_[A-Za-z0-9]+|rk_(?:live|test)_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9]+)\b/g;

// Item 6: Value-aware assignment, captures the value of an ALL_CAPS key= or key:
// Run BEFORE the name-only KEY_CASE pass so both name and value get redacted.
const KEY_VALUE_RE = /((?:[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|API)[A-Z0-9_]*)\s*[=:]\s*)([^\s"']+)/g;

// ALL_CAPS identifiers containing KEY, SECRET, TOKEN, PASSWORD, or API.
// The negative lookbehind (?<!\[) prevents re-matching inside already-placed
// [REDACTED_TOKEN] / [REDACTED_KEY] / [REDACTED_API] markers.
const KEY_CASE_RE = /(?<!\[)\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|API)[A-Z0-9_]*\b/g;

// Key-like flags (hyphenated words containing key/api/token/secret/password)
const KEY_FLAG_RE = /\b[\w]+-(?:key|token|secret|password)\b|\b(?:api)-[\w]+\b/gi;

// Mixed alphanumeric tokens: 8+ chars with 2+ digits AND 2+ letters (hashes, credentials)
const MIXED_TOKEN_RE = /\b(?=[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*[a-zA-Z])(?=[a-zA-Z0-9]*[0-9][a-zA-Z0-9]*[0-9])[a-zA-Z0-9]{8,}\b/g;

// URL auth query params
const URL_AUTH_PARAM_RE = /((?:token|key|password|secret|api_key|apikey|access_token|auth)=)([^&\s]+)/gi;

export function sanitize(text: string): string {
  let result = text;

  // 1. Emails
  result = result.replace(EMAIL_RE, "[REDACTED_EMAIL]");

  // 2. PEM blocks (item 6, before mixed-token pass)
  result = result.replace(PEM_RE, "[REDACTED_PEM]");

  // 3. Known prefixed tokens (item 6, before mixed-token pass)
  result = result.replace(KNOWN_TOKEN_PREFIX_RE, "[REDACTED_TOKEN]");

  // 4. Value-aware key assignments (item 6, before KEY_CASE name-only pass)
  result = result.replace(KEY_VALUE_RE, "$1[REDACTED_VALUE]");

  // 5. KEY_CASE identifiers (name-only pass for bare identifiers without a value)
  result = result.replace(KEY_CASE_RE, "[REDACTED_KEY]");

  // 6. Key-like flags
  result = result.replace(KEY_FLAG_RE, "[REDACTED_KEY]");

  // 7. URL auth params (before mixed token, so we catch the param values)
  result = result.replace(URL_AUTH_PARAM_RE, "$1[REDACTED_TOKEN]");

  // 8. Mixed alphanumeric tokens (hashes, credentials)
  result = result.replace(MIXED_TOKEN_RE, "[REDACTED_TOKEN]");

  return result;
}

export function sanitizeObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitize(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "string") return sanitize(item);
        if (item !== null && typeof item === "object") {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    } else if (value !== null && typeof value === "object") {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
