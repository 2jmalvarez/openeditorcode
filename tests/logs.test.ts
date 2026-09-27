import { expect, test } from "bun:test"
import { useLogs } from "../src/logs/useLogs"
import { t } from "../src/localization"
import { selectedText } from "../src/editor/clipboard"

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
