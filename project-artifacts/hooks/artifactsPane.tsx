import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { ArtifactRow, ArtifactsModel, ArtifactsRepo, RepoSection } from '../types'
import {
  addRefs,
  groupArtifacts,
  orderSections,
  promptText,
  removeRef,
  settleRefs,
  statusBarValue,
  toRow,
} from './artifactsRules'
import {
  changeLinks,
  folderOf,
  isUnder,
  listArtifacts,
  listRepos,
  openComments,
  readLinks,
  repoFromKey,
  resolveRepo,
} from './artifactsService'
import { artifactsView } from './artifactsView'
import type { ArtifactsHandlers } from './artifactsView'
import { ARTIFACTS_PANE_TITLE, COLLAPSED_STORE_KEY } from './constants'

// Literals here so the engine can match the command and pane by name.
const COMMAND = 'repo-artifacts'
const PANE_ID = 'project-artifacts'

const model = atom({ plugin: 'project-artifacts', key: 'artifactsModel' } as const, null, {
  shape: 'artifacts-2',
})
const activeRepo = atom({ plugin: 'project-artifacts', key: 'artifactsActiveRepo' } as const, null, {
  shape: 'active-1',
})
const linking = atom({ plugin: 'project-artifacts', key: 'artifactsLinking' } as const, null)
const collapsed = atom({ plugin: 'project-artifacts', key: 'artifactsCollapsed' } as const, [])
const loading = atom({ plugin: 'project-artifacts', key: 'artifactsLoading' } as const, false)
const showUnlinked = atom({ plugin: 'project-artifacts', key: 'artifactsShowUnlinked' } as const, false)
const statusBar = atom({ plugin: 'project-artifacts', key: 'statusBar' } as const, {})

const asKeys = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : []

/** Folds a repo's artifacts under its heading, or unfolds them; kept across sessions. */
async function toggleCollapsed($: EngineInterface, repo: ArtifactsRepo): Promise<void> {
  const stored = asKeys(await $.store.get(COLLAPSED_STORE_KEY))
  const next = stored.includes(repo.key) ? stored.filter(key => key !== repo.key) : [...stored, repo.key]
  await $.store.set(COLLAPSED_STORE_KEY, next)
  await update($, collapsed, () => next)
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** The session's folder when it is a repo; it outranks any repo a tool touched. */
async function sessionRepo($: EngineInterface): Promise<ArtifactsRepo | null> {
  return resolveRepo($, await $.session.cwd())
}

/** The repo artifacts published now join: the session's own, else the one a tool last touched. */
async function currentActive($: EngineInterface): Promise<ArtifactsRepo | null> {
  return (await sessionRepo($)) ?? (await read($, activeRepo))
}

/** Makes the repo holding `path` the active one, unless the session's folder is a repo itself. */
export async function noteTouchedPath($: EngineInterface, path: string): Promise<void> {
  const active = await read($, activeRepo)
  if (active !== null && isUnder(path, active.dir)) return
  if ((await sessionRepo($)) !== null) return
  const repo = await resolveRepo($, folderOf(path))
  if (repo === null || repo.key === active?.key) return
  await update($, activeRepo, () => repo)
  const current = await read($, model)
  if (current !== null) await update($, model, () => ({ ...current, sections: orderSections(current.sections, repo.key) }))
}

/**
 * Lists the artifacts, groups them by the stored links and reads the open
 * comments of the linked ones. A failed list keeps the rows already shown.
 */
export async function refreshArtifacts($: EngineInterface): Promise<void> {
  await update($, loading, () => true)
  try {
    const folded = asKeys(await $.store.get(COLLAPSED_STORE_KEY))
    await update($, collapsed, () => folded)
    const [listed, repos, active] = await Promise.all([listArtifacts($), listRepos($), currentActive($)])
    const links = await changeLinks($, stored => settleRefs(stored, listed))
    const { byRepo, unlinked } = groupArtifacts(listed, links)
    const known = new Map(repos.map(repo => [repo.key, repo]))
    if (active !== null) known.set(active.key, active)
    const sections: RepoSection[] = await Promise.all(
      [...byRepo].map(async ([key, artifacts]) => ({
        repo: known.get(key) ?? repoFromKey(key),
        rows: await Promise.all(artifacts.map(async one => toRow(one, await openComments($, one.slug)))),
      })),
    )
    if (active !== null && !sections.some(section => section.repo.key === active.key)) {
      sections.push({ repo: active, rows: [] })
    }
    await update($, activeRepo, current => active ?? current)
    const choices = [...known.values(), ...sections.map(section => section.repo).filter(repo => !known.has(repo.key))]
    const next: ArtifactsModel = {
      sections: orderSections(sections, active?.key ?? null),
      choices: choices.sort((a, b) => a.name.localeCompare(b.name)),
      unlinked: unlinked.map(one => toRow(one, null)),
      at: Date.now(),
      error: null,
    }
    await update($, model, () => next)
    const shown = sections.find(section => section.repo.key === active?.key)?.rows ?? sections.flatMap(s => s.rows)
    await update($, statusBar, () => statusBarValue(shown))
  } catch (error) {
    await update($, model, current => ({
      sections: current?.sections ?? [],
      choices: current?.choices ?? [],
      unlinked: current?.unlinked ?? [],
      at: Date.now(),
      error: messageOf(error),
    }))
  } finally {
    await update($, loading, () => false)
  }
}

/** Links what a tool call created or changed to the active repo; true when a link was new. */
export async function linkToActiveRepo($: EngineInterface, refs: readonly string[]): Promise<boolean> {
  if (refs.length === 0) return false
  const repo = await currentActive($)
  if (repo === null) return false
  const before = (await readLinks($))[repo.key] ?? []
  if (refs.every(ref => before.includes(ref))) return false
  await changeLinks($, links => addRefs(links, repo.key, refs))
  return true
}

export async function openArtifactsPane($: EngineInterface): Promise<void> {
  await $.ui.open({ id: PANE_ID, title: ARTIFACTS_PANE_TITLE, focus: true })
  await refreshArtifacts($)
}

async function linkTo($: EngineInterface, row: ArtifactRow, repo: ArtifactsRepo): Promise<void> {
  await update($, linking, () => null)
  await changeLinks($, links => addRefs(links, repo.key, [row.slug]))
  await refreshArtifacts($)
}

async function unlink($: EngineInterface, row: ArtifactRow, repo: ArtifactsRepo): Promise<void> {
  await changeLinks($, links => removeRef(links, repo.key, row.slug))
  await refreshArtifacts($)
}

/** Appends the artifact to the draft for the person to send. */
async function toPrompt($: EngineInterface, row: ArtifactRow): Promise<void> {
  const filled = await $.prompt.fill({ text: promptText(row), mode: 'append' })
  if (!filled.isFilled) await $.ui.toast('The prompt box did not take the artifact')
}

const handlersFor = ($: EngineInterface): ArtifactsHandlers => {
  const quietly = (work: Promise<unknown>): void => void work.catch(() => undefined)
  return {
    refresh: () => quietly(refreshArtifacts($)),
    toPrompt: row => quietly(toPrompt($, row)),
    pick: row => quietly(update($, linking, current => (current === row.slug ? null : row.slug))),
    link: (row, repo) => quietly(linkTo($, row, repo)),
    unlink: (row, repo) => quietly(unlink($, row, repo)),
    toggleRepo: repo => quietly(toggleCollapsed($, repo)),
    toggleUnlinked: () => quietly(update($, showUnlinked, shown => !shown)),
  }
}

export const registerArtifactsPane = (on: Parameters<Register>[0]): void => {
  on('command.run', { command: COMMAND }, async $ => {
    try {
      await openArtifactsPane($)
      return { text: 'Artifacts pane opened.' }
    } catch (error) {
      return { text: `Could not open the Artifacts pane: ${messageOf(error)}` }
    }
  })

  on('ui.press', { plugin: 'project-status', element: COMMAND }, async ($, e, next) => {
    await openArtifactsPane($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Button, Link, Text } = $.ui.resolve(e)
    return artifactsView(
      { Box, Button, Link, Text },
      {
        model: await read($, model),
        activeKey: (await read($, activeRepo))?.key ?? null,
        linking: await read($, linking),
        collapsed: await read($, collapsed),
        isLoading: await read($, loading),
        showUnlinked: await read($, showUnlinked),
      },
      handlersFor($),
    )
  })
}
