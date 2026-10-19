/** Best-effort display protection, not a substitute for keeping secrets out of errors. */
export function redactSecrets(text: string): string {
  return text
    .replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z ]+ )?PRIVATE KEY-----|$)/g, "[REDACTED PRIVATE KEY]")
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@]+)@/gi, "$1[REDACTED]@")
    .replace(/\b(?:github_pat_[\w]+|gh[pousr]_[\w]+|npm_[A-Za-z0-9]+|(?:AKIA|ASIA)[0-9A-Z]{16}|AIza[\w-]{30,}|sk-[\w-]{20,})\b/g, "[REDACTED]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+\/_.=-]+/gi, "$1 [REDACTED]")
    .replace(/((?:["']?)(?:password|passwd|secret|client_secret|api[_-]?key|private[_-]?key|(?:aws_)?secret[_-]?access[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|(?:github|npm)[_-]?token|token)(?:["']?)\s*[:=]\s*)(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^\s&,;]+)/gi, "$1[REDACTED]")
}
