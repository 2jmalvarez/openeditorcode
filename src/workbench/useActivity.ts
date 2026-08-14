import { createMemo, createSignal, onCleanup } from "solid-js"

const SPINNER_FRAMES = ["|", "/", "-", "\\"]

export function useActivity() {
  const [activities, setActivities] = createSignal<{ id: number; message: string }[]>([])
  const [frame, setFrame] = createSignal(0)
  let nextId = 0
  let timer: ReturnType<typeof setInterval> | undefined

  function syncTimer() {
    if (activities().length && !timer) {
      timer = setInterval(() => setFrame((value) => (value + 1) % SPINNER_FRAMES.length), 90)
    } else if (!activities().length && timer) {
      clearInterval(timer)
      timer = undefined
      setFrame(0)
    }
  }

  function begin(message: string) {
    const id = nextId++
    setActivities((current) => [...current, { id, message }])
    syncTimer()
    return () => {
      setActivities((current) => current.filter((activity) => activity.id !== id))
      syncTimer()
    }
  }

  async function run<T>(message: string, operation: () => Promise<T>): Promise<T> {
    const finish = begin(message)
    try {
      return await operation()
    } finally {
      finish()
    }
  }

  onCleanup(() => { if (timer) clearInterval(timer) })

  const busy = createMemo(() => activities().length > 0)
  const message = createMemo(() => activities().at(-1)?.message ?? "")
  const spinner = createMemo(() => SPINNER_FRAMES[frame()])
  return { busy, message, spinner, run }
}
