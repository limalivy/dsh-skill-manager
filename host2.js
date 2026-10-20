/**
 * Skill Manager — Host half.
 *
 * Discovers the local skill roots the filesystem skill provider scans
 * (`<dshHome>/skills`, `<agentsHome>/skills`, and the project-level
 * `.dsh/skills` + `.agents/skills` of the default working directory), then
 * reads, creates, edits, and deletes those `SKILL.md` bundles over one
 * authenticated Connection RPC channel. The Settings page is the only
 * caller; nothing here is model-facing.
 */
import { existsSync } from 'node:fs'
import { promises as fsp } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const CHANNEL = '/skill-manager'
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 4000
const MAX_BODY_BYTES = 512 * 1024
const MAX_FILE_BYTES = 1024 * 1024

/** Abort a request with a stable code the Client localizes. */
class SkillManagerError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'SkillManagerError'
    this.code = `skill-manager/${code}`
    this.details = details
  }
}

function fail(code, message, details) {
  throw new SkillManagerError(code, message, details)
}

export const inject = ['connection', 'webServer']

export function apply(ctx) {
  // The Web transport owns `connection` and `webServer`; ask Cordis to start
  // this route only once both exist, so a composition without the Web surface
  // simply never serves the Settings page's requests.
  ctx.inject(['connection', 'webServer'], (scoped) => {
    scoped.effect(
      () =>
        scoped.webServer.register({
          kind: 'prefix',
          path: CHANNEL,
          handler: (request, response) => serve(scoped, request, response),
        }),
      'skill-manager: web route',
    )
  })
}

/**
 * Answer one `/skill-manager/<endpoint>` POST after the Connection fence has
 * checked the request's Host/Origin authority and browser session cookie.
 */
async function serve(ctx, request, response) {
  let connection
  try {
    connection = ctx.get('connection')
  } catch {
    connection = undefined
  }
  const rejection = typeof connection?.requestRejection === 'function'
    ? connection.requestRejection({ headers: request.headers })
    : undefined
  if (rejection !== undefined) {
    send(response, rejection, { ok: false, error: { code: 'skill-manager/unauthorized', message: 'Not authorized.', details: {} } })
    return
  }
  if (request.method !== 'POST') {
    send(response, 405, { ok: false, error: { code: 'skill-manager/method', message: 'Use POST.', details: {} } })
    return
  }

  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const endpoint = pathname.slice(CHANNEL.length).replace(/^\/+/, '')
  if (endpoint === '') {
    send(response, 404, { ok: false, error: { code: 'skill-manager/unknown-endpoint', message: 'Missing endpoint.', details: {} } })
    return
  }

  let payload = {}
  try {
    const body = await readJson(request)
    if (body !== null && typeof body === 'object' && !Array.isArray(body)) payload = body
  } catch (error) {
    send(response, error?.statusCode ?? 400, {
      ok: false,
      error: {
        code: 'skill-manager/bad-request',
        message: error instanceof Error ? error.message : 'Malformed request body.',
        details: {},
      },
    })
    return
  }

  send(response, 200, await respond(ctx, endpoint, payload, undefined))
}

function send(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  response.end(text)
}

function readJson(request) {
  const MAX_REQUEST_BYTES = 2 * 1024 * 1024
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_REQUEST_BYTES) {
        const error = new Error('The request body is too large.')
        error.statusCode = 413
        rejectPromise(error)
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('error', rejectPromise)
    request.on('end', () => {
      if (size === 0) {
        resolvePromise(null)
        return
      }
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        rejectPromise(new Error('The request body is not valid JSON.'))
      }
    })
  })
}

async function respond(ctx, endpoint, payload, signal) {
  try {
    if (signal?.aborted) fail('cancelled', 'The request was cancelled.')
    const args = payload !== null && typeof payload === 'object' ? payload : {}
    const value = await dispatch(ctx, endpoint, args)
    return { ok: true, value }
  } catch (error) {
    if (error instanceof SkillManagerError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details ?? {} } }
    }
    return {
      ok: false,
      error: {
        code: 'skill-manager/internal',
        message: error instanceof Error ? error.message : String(error),
        details: {},
      },
    }
  }
}

async function dispatch(ctx, endpoint, args) {
  switch (endpoint) {
    case 'list':
      return listSkills(ctx)
    case 'read':
      return readSkill(ctx, args)
    case 'create':
      return createSkill(ctx, args)
    case 'save':
      return saveSkill(ctx, args)
    case 'remove':
      return removeSkill(ctx, args)
    default:
      fail('unknown-endpoint', `No skill-manager endpoint named "${endpoint}".`)
  }
}

// ---------------------------------------------------------------------------
// Roots and discovery
// ---------------------------------------------------------------------------

function environment(ctx) {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const agentsHome = process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')
  let cwd = process.cwd()
  try {
    const working = ctx.get('workingDirectory')
    if (working?.defaultDirectory) cwd = working.defaultDirectory
  } catch {
    // A composition without the service still gets the process directory.
  }
  const projectRoot = findProjectRoot(cwd)
  return { dshHome, agentsHome, cwd, projectRoot }
}

function findProjectRoot(start) {
  let current = resolve(start)
  for (;;) {
    if (existsSync(join(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return resolve(start)
    current = parent
  }
}

function rootList(ctx) {
  const { dshHome, agentsHome, cwd, projectRoot } = environment(ctx)
  return {
    cwd,
    projectRoot,
    roots: [
      { id: 'user-dsh', scope: 'user', path: join(dshHome, 'skills') },
      { id: 'user-agents', scope: 'user', path: join(agentsHome, 'skills') },
      { id: 'project-dsh', scope: 'project', path: join(projectRoot, '.dsh', 'skills') },
      { id: 'project-agents', scope: 'project', path: join(projectRoot, '.agents', 'skills') },
    ],
  }
}

async function listSkills(ctx) {
  const view = rootList(ctx)
  const skills = []
  for (const root of view.roots) {
    if (!existsSync(root.path)) continue
    let entries
    try {
      entries = await fsp.readdir(root.path, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) {
        const file = join(root.path, entry.name, 'SKILL.md')
        if (!existsSync(file)) continue
        skills.push(await summarize(root, file, 'bundle'))
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        skills.push(await summarize(root, join(root.path, entry.name), 'flat'))
      }
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path))
  return {
    cwd: view.cwd,
    projectRoot: view.projectRoot,
    roots: view.roots.map((root) => ({ ...root, exists: existsSync(root.path) })),
    skills,
  }
}

async function summarize(root, file, format) {
  const fallbackName =
    format === 'bundle' ? basename(dirname(file)) : basename(file).replace(/\.md$/i, '')
  const base = {
    path: file,
    rootId: root.id,
    scope: root.scope,
    format,
    name: fallbackName,
    description: '',
    whenToUse: '',
    modelInvocable: true,
    userInvocable: true,
    valid: false,
    issue: '',
  }
  try {
    const stat = await fsp.stat(file)
    if (stat.size > MAX_FILE_BYTES) {
      return { ...base, issue: 'too-large' }
    }
    const text = await fsp.readFile(file, 'utf8')
    const parsed = parseSkillFile(text)
    return {
      ...base,
      name: parsed.name || fallbackName,
      description: parsed.description,
      whenToUse: parsed.whenToUse,
      modelInvocable: parsed.modelInvocable,
      userInvocable: parsed.userInvocable,
      valid: parsed.valid,
      issue: parsed.issue,
    }
  } catch {
    return { ...base, issue: 'unreadable' }
  }
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

async function readSkill(ctx, args) {
  const target = await resolveTarget(ctx, args.path)
  const text = await fsp.readFile(target.file, 'utf8')
  const split = splitFrontmatter(text)
  const parsed = parseSkillFile(text)
  return {
    skill: {
      ...(await summarize(target.root, target.file, target.format)),
      name: parsed.name || summarizeName(target),
      description: parsed.description,
      whenToUse: parsed.whenToUse,
      modelInvocable: parsed.modelInvocable,
      userInvocable: parsed.userInvocable,
      valid: parsed.valid,
      issue: parsed.issue,
      body: split.body,
      frontmatter: split.frontmatter,
      rawFormat: split.ok,
    },
  }
}

function summarizeName(target) {
  const name = basename(target.file)
  if (target.format === 'bundle') return basename(dirname(target.file))
  return name.slice(0, name.toLowerCase().endsWith('.md') ? -3 : name.length)
}

async function saveSkill(ctx, args) {
  const target = await resolveTarget(ctx, args.path)
  const description = requireText(args.description, 'description', MAX_DESCRIPTION_LENGTH)
  const whenToUse = optionalText(args.whenToUse, MAX_DESCRIPTION_LENGTH)
  const body = typeof args.body === 'string' ? args.body : ''
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    fail('body-too-large', 'The skill body is larger than 512 KiB.')
  }
  const modelInvocable = args.modelInvocable !== false
  const userInvocable = args.userInvocable !== false

  const text = await fsp.readFile(target.file, 'utf8')
  const split = splitFrontmatter(text)
  if (!split.ok) fail('invalid-frontmatter', 'The skill file has no YAML frontmatter block.')

  let frontmatter = split.frontmatter
  frontmatter = setString(frontmatter, 'description', description)
  frontmatter = setString(frontmatter, 'whenToUse', whenToUse)
  frontmatter = setRaw(frontmatter, 'disable-model-invocation', modelInvocable ? undefined : 'true')
  frontmatter = setRaw(frontmatter, 'user-invocable', userInvocable ? undefined : 'false')

  await fsp.writeFile(target.file, renderSkillFile(frontmatter, body), 'utf8')
  return readSkill(ctx, { path: target.file })
}

async function createSkill(ctx, args) {
  const view = rootList(ctx)
  const root = view.roots.find((entry) => entry.id === args.rootId) ?? view.roots.find((entry) => entry.id === 'user-dsh')
  if (!root) fail('unknown-root', `No skill root named "${String(args.rootId)}".`)

  const name = String(args.name ?? '').trim()
  if (!NAME_PATTERN.test(name)) {
    fail('invalid-name', 'A skill name is lowercase kebab-case: letters, digits, and single hyphens.')
  }
  if (name.length > MAX_NAME_LENGTH) fail('invalid-name', 'The skill name is too long.')
  const description = requireText(args.description, 'description', MAX_DESCRIPTION_LENGTH)
  const whenToUse = optionalText(args.whenToUse, MAX_DESCRIPTION_LENGTH)
  const body = typeof args.body === 'string' ? args.body : ''
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    fail('body-too-large', 'The skill body is larger than 512 KiB.')
  }

  await fsp.mkdir(root.path, { recursive: true })
  const directory = join(root.path, name)
  if (existsSync(directory) || existsSync(join(root.path, `${name}.md`))) {
    fail('duplicate', `A skill named "${name}" already exists in ${root.path}.`)
  }
  await fsp.mkdir(directory)

  const lines = [`name: ${quote(name)}`, `description: ${quote(description)}`]
  if (whenToUse) lines.push(`whenToUse: ${quote(whenToUse)}`)
  const file = join(directory, 'SKILL.md')
  await fsp.writeFile(file, renderSkillFile(lines.join('\n'), body), 'utf8')
  return readSkill(ctx, { path: file })
}

async function removeSkill(ctx, args) {
  const target = await resolveTarget(ctx, args.path)
  if (target.format === 'bundle') {
    await fsp.rm(dirname(target.file), { recursive: true, force: false })
  } else {
    await fsp.rm(target.file, { force: false })
  }
  return { removed: true, path: target.file }
}

// ---------------------------------------------------------------------------
// Path guarding
// ---------------------------------------------------------------------------

async function resolveTarget(ctx, input) {
  if (typeof input !== 'string' || input.trim() === '' || !isAbsolute(input)) {
    fail('invalid-path', 'A skill path must be absolute.')
  }
  const candidate = resolve(input)
  const view = rootList(ctx)
  for (const root of view.roots) {
    const rel = relative(root.path, candidate)
    if (rel === '' || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) continue
    const segments = rel.split(sep)
    const format = segments.length === 2 && segments[1] === 'SKILL.md' ? 'bundle' : segments.length === 1 && segments[0].toLowerCase().endsWith('.md') ? 'flat' : undefined
    if (!format) continue
    if (!existsSync(candidate)) fail('not-found', 'That skill file no longer exists.')
    const realRoot = await fsp.realpath(root.path).catch(() => root.path)
    const realFile = await fsp.realpath(candidate).catch(() => candidate)
    if (realFile !== realRoot && !realFile.startsWith(realRoot.endsWith(sep) ? realRoot : realRoot + sep)) {
      fail('forbidden', 'That path resolves outside the skill roots.')
    }
    return { root, file: candidate, format }
  }
  fail('forbidden', 'That path is not inside a managed skill root.')
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

function quote(value) {
  return JSON.stringify(String(value))
}

function requireText(value, label, max) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '') fail(`invalid-${label}`, `A skill needs a ${label}.`)
  if (text.length > max) fail(`invalid-${label}`, `The ${label} is longer than ${max} characters.`)
  return text
}

function optionalText(value, max) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) fail('invalid-text', `A frontmatter value is longer than ${max} characters.`)
  return text
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function splitFrontmatter(text) {
  const source = stripBom(text)
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source)
  if (!match) return { ok: false, frontmatter: '', body: source }
  return { ok: true, frontmatter: match[1], body: source.slice(match[0].length) }
}

function renderSkillFile(frontmatter, body) {
  const trimmed = frontmatter.replace(/\s+$/, '')
  const normalizedBody = body.replace(/^\r?\n+/, '')
  return `---\n${trimmed}\n---\n${normalizedBody.endsWith('\n') ? normalizedBody : `${normalizedBody}\n`}`
}

/** Index top-level `key: value` entries, including their indented continuations. */
function topLevelEntries(frontmatter) {
  const lines = frontmatter.split(/\r?\n/)
  const entries = []
  let index = 0
  while (index < lines.length) {
    const match = /^([A-Za-z0-9_.-]+)[ \t]*:[ \t]*(.*)$/.exec(lines[index])
    if (!match) {
      index += 1
      continue
    }
    const start = index
    let end = index + 1
    while (end < lines.length) {
      const line = lines[end]
      if (line.trim() === '') {
        let lookahead = end + 1
        while (lookahead < lines.length && lines[lookahead].trim() === '') lookahead += 1
        if (lookahead < lines.length && /^[ \t]/.test(lines[lookahead])) {
          end = lookahead
          continue
        }
        break
      }
      if (/^[ \t]/.test(line)) {
        end += 1
        continue
      }
      break
    }
    entries.push({ key: match[1], value: match[2], start, end, lines })
    index = end
  }
  return entries
}

function dedent(lines) {
  const indents = lines.filter((line) => line.trim() !== '').map((line) => /^[ \t]*/.exec(line)[0].length)
  const width = indents.length === 0 ? 0 : Math.min(...indents)
  return lines.map((line) => line.slice(Math.min(width, /^[ \t]*/.exec(line)[0].length)))
}

function unquote(raw) {
  const value = raw.trim()
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value.slice(0, value.lastIndexOf('"') + 1))
    } catch {
      return value.replace(/^"|"$/g, '')
    }
  }
  if (value.startsWith("'")) {
    return value.slice(1, value.lastIndexOf("'") === 0 ? undefined : value.lastIndexOf("'")).replace(/''/g, "'")
  }
  return value
}

function entryText(entry) {
  const raw = entry.value.trim()
  if (raw === '' || raw.startsWith('>') || raw.startsWith('|')) {
    const block = entry.lines.slice(entry.start + 1, entry.end)
    const body = dedent(block).join(raw.startsWith('|') ? '\n' : ' ')
    return body.trim()
  }
  if (raw.startsWith('"') || raw.startsWith("'")) return unquote(raw)
  const comment = raw.search(/[ \t]#/)
  return (comment === -1 ? raw : raw.slice(0, comment)).trim()
}

function parseBoolean(entry, fallback) {
  if (!entry) return fallback
  const word = entryText(entry).toLowerCase()
  if (word === '') return fallback
  if (['true', 'yes', 'on', '1'].includes(word)) return true
  if (['false', 'no', 'off', '0'].includes(word)) return false
  return fallback
}

function parseSkillFile(text) {
  const split = splitFrontmatter(text)
  if (!split.ok) {
    return {
      valid: false,
      issue: 'missing-frontmatter',
      name: '',
      description: '',
      whenToUse: '',
      modelInvocable: true,
      userInvocable: true,
    }
  }
  const entries = topLevelEntries(split.frontmatter)
  const byKey = new Map()
  for (const entry of entries) if (!byKey.has(entry.key)) byKey.set(entry.key, entry)

  const name = byKey.has('name') ? entryText(byKey.get('name')) : ''
  const description = byKey.has('description') ? entryText(byKey.get('description')) : ''
  const whenToUse = byKey.has('whenToUse') ? entryText(byKey.get('whenToUse')) : ''
  const disableModel = parseBoolean(byKey.get('disable-model-invocation'), false)
  const userInvocable = parseBoolean(byKey.get('user-invocable'), true)

  let issue = ''
  if (!NAME_PATTERN.test(name)) issue = name === '' ? 'missing-name' : 'invalid-name'
  else if (description.trim() === '') issue = 'missing-description'

  return {
    valid: issue === '',
    issue,
    name,
    description,
    whenToUse,
    modelInvocable: !disableModel,
    userInvocable,
  }
}

function setRaw(frontmatter, key, rawValue) {
  const entries = topLevelEntries(frontmatter)
  const entry = entries.find((candidate) => candidate.key === key)
  const lines = frontmatter === '' ? [] : frontmatter.split(/\r?\n/)
  if (rawValue === undefined) {
    if (!entry) return frontmatter
    lines.splice(entry.start, entry.end - entry.start)
    return lines.join('\n')
  }
  const rendered = `${key}: ${rawValue}`
  if (entry) {
    lines.splice(entry.start, entry.end - entry.start, rendered)
    return lines.join('\n')
  }
  if (lines.length === 0) return rendered
  lines.push(rendered)
  return lines.join('\n')
}

function setString(frontmatter, key, value) {
  return setRaw(frontmatter, key, value === undefined || value === '' ? undefined : quote(value))
}
