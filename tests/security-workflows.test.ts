import { expect, test } from "bun:test"
import { YAML } from "bun"

type Job = { uses?: string; needs?: string | string[]; permissions?: Record<string, string>; steps?: { uses?: string; with?: Record<string, unknown> }[] }
type Workflow = { permissions: Record<string, string>; jobs: Record<string, Job> }

test("all workflows pin actions and disable checkout credential persistence", async () => {
  for (const name of ["ci", "publish", "publish-opencode-editor", "security"]) {
    const workflow = YAML.parse(await Bun.file(`.github/workflows/${name}.yml`).text()) as Workflow
    expect(workflow.permissions["id-token"]).not.toBe("write")
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (!step.uses) continue
        expect(step.uses).toMatch(/^[\w-]+\/[\w-]+@[a-f0-9]{40}$/)
        if (step.uses.startsWith("actions/checkout@")) expect(step.with?.["persist-credentials"]).toBe(false)
      }
    }
  }
})

test("publication depends on secret scanning and only publishing receives OIDC", async () => {
  for (const name of ["publish", "publish-opencode-editor"]) {
    const workflow = YAML.parse(await Bun.file(`.github/workflows/${name}.yml`).text()) as Workflow
    expect(workflow.jobs.security.uses).toBe("./.github/workflows/security.yml")
    for (const [id, job] of Object.entries(workflow.jobs)) {
      if (id === "publish") expect(job.permissions?.["id-token"]).toBe("write")
      else expect(job.permissions?.["id-token"]).not.toBe("write")
      if (id.startsWith("build-") || id === "verify") expect(job.needs).toBe("security")
    }
  }
})
