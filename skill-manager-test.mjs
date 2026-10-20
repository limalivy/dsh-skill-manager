import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const sandbox = await mkdtemp(join(tmpdir(), 'skill-manager-test-'))
const dshHome = join(sandbox, 'dsh')
const agentsHome = join(sandbox, 'agents')
const project = join(sandbox, 'project')
await mkdir(join(project, '.git'), { recursive: true })
await mkdir(join(agentsHome, 'skills', 'alpha'), { recursive: true })
await writeFile(
  join(agentsHome, 'skills', 'alpha', 'SKILL.md'),
  `---\nname: alpha\ndescription: "A quoted description: with a colon"\nmetadata: {"a":{"b":1}}\ndisable-model-invocation: true\n---\n\n# Alpha\n\nBody line.\n`,
)
await writeFile(
  join(agentsHome, 'skills', 'broken.md'),
  `---\nname: Broken Name\ndescription:\n---\nbody\n`,
)

process.env.DSH_HOME = dshHome
process.env.DSH_AGENTS_HOME = agentsHome
process.chdir(project)

const { apply } = await import('./host3.js')
const handlers = new Map()
const routes = new Map()
const ctx = {
  effect: (fn) => fn(),
  inject: (deps, callback) => callback(ctx),
  get: () => undefined,
  connection: { requestRejection: () => undefined },
  webServer: {
    register: (route) => {
      routes.set(route.path, route)
      return () => {}
    },
  },
}
apply(ctx)
const route = routes.get('/skill-manager')
assert.ok(route, 'route registered')

// Drive the real HTTP route with a minimal request/response pair.
function invoke(endpoint, payload) {
  const body = Buffer.from(JSON.stringify(payload ?? {}))
  const listeners = {}
  const request = {
    method: 'POST',
    url: `/skill-manager/${endpoint}`,
    headers: { host: '127.0.0.1:54270' },
    on(event, listener) {
      listeners[event] = listener
      if (event === 'end') setImmediate(() => { listeners.data?.(body); listeners.end?.() })
      return this
    },
    destroy() {},
  }
  const response = {
    status: 0,
    headers: null,
    text: '',
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(text) {
      this.text = text
    },
  }
  const done = route.handler(request, response)
  return Promise.resolve(done).then(async () => {
    await new Promise((resolve) => setImmediate(resolve))
    const parsed = JSON.parse(response.text)
    return { status: response.status, body: parsed }
  })
}

const call = async (endpoint, payload) => {
  const result = await invoke(endpoint, payload)
  if (!result.body.ok) throw new Error(`${endpoint}: ${result.body.error.code} ${result.body.error.message}`)
  return result.body.value
}
const callFail = async (endpoint, payload) => {
  const result = await invoke(endpoint, payload)
  assert.equal(result.body.ok, false, `${endpoint} should fail`)
  return result.body.error
}

let list = await call('list')
assert.equal(list.roots.length, 4)
assert.deepEqual(list.roots.map((r) => r.id), ['user-dsh', 'user-agents', 'project-dsh', 'project-agents'])
const alpha = list.skills.find((s) => s.name === 'alpha')
assert.ok(alpha, 'alpha discovered')
assert.equal(alpha.description, 'A quoted description: with a colon')
assert.equal(alpha.modelInvocable, false)
assert.equal(alpha.valid, true)
const broken = list.skills.find((s) => s.path.endsWith('broken.md'))
assert.ok(broken)
assert.equal(broken.valid, false)

let read = await call('read', { path: alpha.path })
assert.match(read.skill.body, /# Alpha/)
assert.match(read.skill.frontmatter, /metadata: \{"a":\{"b":1\}\}/)

// Save keeps unknown frontmatter keys and flips invocation.
read = await call('save', {
  path: alpha.path,
  description: 'Rewritten description',
  whenToUse: 'When testing: yes',
  modelInvocable: true,
  userInvocable: false,
  body: '# Alpha\n\nNew body.\n',
})
assert.equal(read.skill.description, 'Rewritten description')
assert.equal(read.skill.whenToUse, 'When testing: yes')
assert.equal(read.skill.modelInvocable, true)
assert.equal(read.skill.userInvocable, false)
const text = await readFile(alpha.path, 'utf8')
assert.match(text, /metadata: \{"a":\{"b":1\}\}/, 'unknown key preserved')
assert.match(text, /user-invocable: false/)
assert.doesNotMatch(text, /disable-model-invocation/)
assert.ok(!text.includes('"true"'), 'booleans stay bare')

// Create in the user-dsh root.
const created = await call('create', {
  rootId: 'user-dsh',
  name: 'my-new-skill',
  description: 'Does a thing: reliably',
  body: '# my-new-skill\n\nHello.\n',
})
assert.equal(created.skill.name, 'my-new-skill')
assert.equal(created.skill.valid, true)
const createdText = await readFile(created.skill.path, 'utf8')
assert.equal(
  createdText,
  '---\nname: "my-new-skill"\ndescription: "Does a thing: reliably"\n---\n# my-new-skill\n\nHello.\n',
)
assert.deepEqual(await readdir(join(dshHome, 'skills')), ['my-new-skill'])

// Duplicate + invalid names + unknown roots.
let failure = await callFail('create', { rootId: 'user-dsh', name: 'my-new-skill', description: 'x' })
assert.equal(failure.code, 'skill-manager/duplicate')
failure = await callFail('create', { rootId: 'user-dsh', name: 'Bad Name', description: 'x' })
assert.equal(failure.code, 'skill-manager/invalid-name')
failure = await callFail('create', { rootId: 'user-dsh', name: 'ok', description: '  ' })
assert.equal(failure.code, 'skill-manager/invalid-description')

// Path guard refuses anything outside the four roots.
failure = await callFail('read', { path: '/etc/passwd' })
assert.equal(failure.code, 'skill-manager/forbidden')
failure = await callFail('read', { path: join(agentsHome, 'skills', 'alpha', '..', '..', '..', 'x.md') })
assert.equal(failure.code, 'skill-manager/forbidden')
failure = await callFail('read', { path: 'relative/path.md' })
assert.equal(failure.code, 'skill-manager/invalid-path')

// Delete removes the bundle directory, not the root.
await call('remove', { path: created.skill.path })
assert.deepEqual(await readdir(join(dshHome, 'skills')), [])
list = await call('list')
assert.ok(!list.skills.some((s) => s.name === 'my-new-skill'))

// Unknown endpoint.
failure = await callFail('nope', {})
assert.equal(failure.code, 'skill-manager/unknown-endpoint')

await rm(sandbox, { recursive: true, force: true })
console.log('host API tests passed')
