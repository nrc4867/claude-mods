import type { EngineInterface } from 'claude-code'
import { DEFAULT_CONFIG_DIR_NAME, PROJECT_DIR_UNSAFE, RESUME_COMMAND } from './constants'

export type SessionInfo = {
  id: string
  /** The command that reopens this session. */
  resume: string
  /** The transcript as a file URL; null when the file is not where it is expected. */
  transcriptUrl: string | null
  /** The session's folder under `jobs`; only a background session has one. */
  job: { name: string; url: string } | null
}

const slashes = (path: string): string => path.replace(/\\/g, '/').replace(/\/+$/, '')

const fileUrl = (path: string): string => `file:///${encodeURI(path.replace(/^\/+/, ''))}`

async function configDir($: EngineInterface): Promise<string | null> {
  const configured = await $.env.get('CLAUDE_CONFIG_DIR')
  if (configured) return slashes(configured)
  const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME'))
  return home ? `${slashes(home)}/${DEFAULT_CONFIG_DIR_NAME}` : null
}

async function findTranscript($: EngineInterface, id: string): Promise<string | null> {
  const [config, root] = await Promise.all([configDir($), $.session.root()])
  if (config === null) return null
  const path = `${config}/projects/${root.replace(PROJECT_DIR_UNSAFE, '-')}/${id}.jsonl`
  const stat = await $.fs.stat(path).catch(() => null)
  return stat?.kind === 'file' ? fileUrl(path) : null
}

async function findJob($: EngineInterface): Promise<SessionInfo['job']> {
  const dir = await $.env.get('CLAUDE_JOB_DIR')
  if (!dir) return null
  const path = slashes(dir)
  const stat = await $.fs.stat(path).catch(() => null)
  if (stat?.kind !== 'dir') return null
  return { name: path.slice(path.lastIndexOf('/') + 1), url: fileUrl(path) }
}

/** This session's id, transcript and job folder as of now: `/resume` changes the first two. */
export async function readSessionInfo($: EngineInterface): Promise<SessionInfo | null> {
  const id = await $.session.id().catch(() => null)
  if (!id) return null
  const transcriptUrl = await findTranscript($, id).catch(() => null)
  const job = await findJob($).catch(() => null)
  return { id, resume: `${RESUME_COMMAND} ${id}`, transcriptUrl, job }
}
