import type { EngineInterface } from 'claude-code'
import type { Note, NotesRepo, RepoChoice } from '../types'
import { NOTES_FILE_NAME, NOTES_IMAGES_DIR } from './constants'
import { basename } from './formatUtils'
import { gitOut } from './gitRun'
import { parseNotes, serializeNotes } from './notesRules'

const GIT_DIR_SUFFIX = /[\\/]\.git$/
const BARE_SUFFIX = /\.git$/

/** A main checkout's `.git` is named by its folder; a bare repo by itself. */
export const repoName = (gitDir: string): string =>
  GIT_DIR_SUFFIX.test(gitDir)
    ? basename(gitDir.replace(GIT_DIR_SUFFIX, ''))
    : basename(gitDir).replace(BARE_SUFFIX, '')

/**
 * The repo holding `dir`, by its shared git folder: every worktree of a repo
 * answers the same one. Null outside a repo.
 */
export async function resolveNotesRepo($: EngineInterface, dir: string): Promise<NotesRepo | null> {
  const out = await gitOut($, dir, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  const gitDir = out?.trim()
  if (gitDir === undefined || gitDir === '') return null
  return {
    name: repoName(gitDir),
    file: `${gitDir}/${NOTES_FILE_NAME}`,
    imagesDir: `${gitDir}/${NOTES_IMAGES_DIR}`,
  }
}

/** The file's notes: empty when it does not exist yet, null when it cannot be understood. */
export async function readNotes($: EngineInterface, file: string): Promise<Note[] | null> {
  if (!(await $.fs.exists(file))) return []
  return parseNotes(await $.fs.read(file))
}

export async function writeNotes($: EngineInterface, file: string, notes: readonly Note[]): Promise<void> {
  await $.fs.write(file, serializeNotes(notes))
}

async function isRepoFolder($: EngineInterface, dir: string): Promise<boolean> {
  return $.fs.exists(`${dir}/.git`)
}

/** The repos to pick from: the root's children, or its siblings when the root is a repo. */
export async function listRepoChoices($: EngineInterface): Promise<RepoChoice[]> {
  const root = (await $.session.root()).replace(/\\/g, '/').replace(/\/$/, '')
  const dir = (await isRepoFolder($, root)) ? root.slice(0, root.lastIndexOf('/')) || '/' : root
  const folders = (await $.fs.list(dir))
    .filter(entry => entry.kind === 'dir' && !entry.name.startsWith('.'))
    .map(entry => ({ name: entry.name, path: `${dir}/${entry.name}` }))
  const found = await Promise.all(
    folders.map(async folder => ((await isRepoFolder($, folder.path)) ? folder : null)),
  )
  return found.filter((folder): folder is RepoChoice => folder !== null)
}
