import { expect, test } from "bun:test"
import { useLogs } from "../src/logs/useLogs"
import { t } from "../src/localization"
import { selectedText } from "../src/editor/clipboard"
import { redactSecrets } from "../src/logs/redact"

test("redacts credentials in all log fields before retaining them", () => {
  const logs = useLogs()
  const token = ["ghp", "a".repeat(36)].join("_")
  logs.report({ source: `Bearer ${token}`, operation: "password=private-value", summary: "https://alice:private-value@example.org/repo", details: `remote rejected ${token}\n{"api_key": "private-value"}\nAuthorization: Basic dXNlcjpwYXNz\n?access_token=private-value&safe=yes` })
  const retained = JSON.stringify(logs.entries())
  expect(retained).not.toContain(token)
  expect(retained).not.toContain("private-value")
  expect(retained).not.toContain("dXNlcjpwYXNz")
  expect(retained).toContain("safe=yes")
  expect(retained).toContain("remote rejected")
})

test("redacts multiline private keys and keeps useful diagnostics", () => {
  const key = ["-----BEGIN RSA", "PRIVATE KEY-----"].join(" ") + "\nprivate-material\n" + ["-----END RSA", "PRIVATE KEY-----"].join(" ")
  expect(redactSecrets(`failure\n${key}\nEACCES`)).toBe("failure\n[REDACTED PRIVATE KEY]\nEACCES")
})

test("redacts database URLs and complete escaped JSON secret values", () => {
  expect(redactSecrets("postgresql://user:private-value@localhost/database")).toBe("postgresql://[REDACTED]@localhost/database")
  const result = redactSecrets(JSON.stringify({ password: 'private-"quoted"-value', error: "connection refused" }))
  expect(result).not.toContain("private")
  expect(result).not.toContain("quoted")
  expect(result).toContain("connection refused")
  expect(redactSecrets("AWS_SECRET_ACCESS_KEY=private-value")).not.toContain("private-value")
})

test("keeps session errors until they are read and removes terminal control sequences", () => {
  const logs = useLogs()
  logs.report({ source: "Git", operation: "git pull", summary: "git pull falló.", details: "\x1b[31mremote rejected\x1b[0m" })
  logs.report({ source: "Archivos", operation: "Guardar archivo", summary: "Acceso denegado.", details: "EACCES" })

  expect(logs.unreadCount()).toBe(2)
  expect(logs.notice()).toBe(t("log.manyUnread", { count: 2 }))
  expect(logs.entries()[0].details).toBe("remote rejected")
  logs.markRead()
  expect(logs.unreadCount()).toBe(0)
  expect(logs.entries()).toHaveLength(2)
})

test("reads a selection from any text viewer", () => {
  expect(selectedText({ getSelectedText: () => "log selection" })).toBe("log selection")
  expect(selectedText({ getSelectedText: () => "" })).toBeUndefined()
})
