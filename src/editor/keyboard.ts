import { dlopen } from "bun:ffi"

const VK_SHIFT = 0x10
const VK_CONTROL = 0x11

const user32 = process.platform === "win32"
  ? dlopen("user32.dll", {
      GetAsyncKeyState: { args: ["i32"], returns: "i16" },
    })
  : undefined

function isPressed(key: number): boolean {
  return Boolean(user32 && (user32.symbols.GetAsyncKeyState(key) & 0x8000))
}

export const isShiftPressed = () => isPressed(VK_SHIFT)
export const isControlPressed = () => isPressed(VK_CONTROL)
