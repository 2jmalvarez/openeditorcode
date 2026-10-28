/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { DocumentTabs } from "../src/documents/DocumentTabs"
import type { OpenTab } from "../src/documents/types"

test("middle-click closes the clicked tab from padding, label and close icon without activating it", async () => {
  const tabs: OpenTab[] = [
    { kind: "manual", path: "/first.md", content: "first" },
    { kind: "manual", path: "/second.md", content: "second" },
  ]
  const closed: number[] = []
  const activated: number[] = []
  const setup = await testRender(() => <DocumentTabs tabs={() => tabs} activeTab={() => 0} isTabDirty={() => false}
    onActivate={(index) => activated.push(index)} onClose={(index) => closed.push(index)} />, { width: 80, height: 5 })
  try {
    await setup.renderOnce()
    const tab = setup.renderer.root.findDescendantById("document-tab:1")!
    for (const offset of [0, 3, tab.width - 2, tab.width - 1]) {
      await setup.mockMouse.click(tab.screenX + offset, tab.screenY, 1)
    }
    expect(closed).toEqual([1, 1, 1, 1])
    expect(activated).toEqual([])
    await setup.mockMouse.click(tab.screenX + 3, tab.screenY, 2)
    expect(closed).toHaveLength(4)
    expect(activated).toEqual([])
    await setup.mockMouse.click(tab.screenX + 3, tab.screenY)
    expect(activated).toEqual([1])
    await setup.mockMouse.click(tab.screenX + tab.width - 2, tab.screenY)
    expect(closed).toEqual([1, 1, 1, 1, 1])
  } finally { setup.renderer.destroy() }
})
