import type { Elements as SurfaceElements } from 'claude-code'
import type { ArtifactRow, ArtifactsModel, ArtifactsRepo, RepoSection } from '../types'
import { elapsed } from './formatUtils'

type Elements = Pick<SurfaceElements['terminal'], 'Box' | 'Button' | 'Link' | 'Text'>

export type ArtifactsHandlers = {
  refresh: () => void
  /** Leaves the artifact's title and link in the prompt, unsent. */
  toPrompt: (row: ArtifactRow) => void
  /** Shows, or hides again, the repos an unlinked artifact can join. */
  pick: (row: ArtifactRow) => void
  link: (row: ArtifactRow, repo: ArtifactsRepo) => void
  unlink: (row: ArtifactRow, repo: ArtifactsRepo) => void
  /** Folds a repo's artifacts under its heading, or unfolds them. */
  toggleRepo: (repo: ArtifactsRepo) => void
  toggleUnlinked: () => void
}

export type ArtifactsViewModel = {
  model: ArtifactsModel | null
  /** The repo artifacts published now join; its header is drawn in the accent color. */
  activeKey: string | null
  /** The unlinked artifact whose repo is being picked. */
  linking: string | null
  /** Keys of the repos drawn as their heading alone. */
  collapsed: readonly string[]
  isLoading: boolean
  showUnlinked: boolean
}

const PLAIN_PAGE = 'Page'
const FOLDED_MARK = '▸'
const OPEN_MARK = '▾'
const ACTIVE_COLOR = 'claude'

const age = (at: number, now: number): string => {
  const ago = elapsed(at, now)
  return ago === 'now' ? 'just now' : `${ago} ago`
}

const commentTotal = (rows: readonly ArtifactRow[]): number =>
  rows.reduce((sum, row) => sum + (row.openComments ?? 0), 0)

type RowAction = { key: string; label: string; onPress: () => void }

/** `To prompt`, keyed by where the row is drawn, as an artifact may sit in more than one repo. */
const promptAction = (place: string, row: ArtifactRow, handlers: ArtifactsHandlers): RowAction => ({
  key: `prompt:${place}:${row.slug}`,
  label: 'To prompt',
  onPress: () => handlers.toPrompt(row),
})

const artifactRow = (
  { Box, Button, Link, Text }: Elements,
  row: ArtifactRow,
  now: number,
  actions: readonly RowAction[],
) => (
  <Box key={`row:${actions[0]?.key ?? row.slug}`} flexDirection="column">
    <Text>
      <Link href={row.url} label={row.title} />
    </Text>
    <Box flexDirection="row" gap={1}>
      <Text dimColor>
        {row.kind ?? PLAIN_PAGE} · {age(row.updatedAt, now)}
      </Text>
      {row.openComments !== null && row.openComments > 0 && (
        <Text color="warning">
          {row.openComments} open {row.openComments === 1 ? 'comment' : 'comments'}
        </Text>
      )}
      {actions.map(action => (
        <Button key={action.key} label={action.label} onPress={action.onPress} />
      ))}
    </Box>
  </Box>
)

const repoSection = (elements: Elements, section: RepoSection, view: ArtifactsViewModel, handlers: ArtifactsHandlers, now: number) => {
  const { Box, Button, Text } = elements
  const isActive = section.repo.key === view.activeKey
  const isFolded = view.collapsed.includes(section.repo.key)
  const comments = commentTotal(section.rows)
  return (
    <Box key={`repo:${section.repo.key}`} flexDirection="column" marginTop={1}>
      <Button key={`fold:${section.repo.key}`} plain onPress={() => handlers.toggleRepo(section.repo)}>
        <Text dimColor>{isFolded ? FOLDED_MARK : OPEN_MARK}</Text>{' '}
        <Text bold color={isActive ? ACTIVE_COLOR : undefined}>
          {section.repo.name}
        </Text>{' '}
        <Text dimColor>{section.rows.length}</Text>
        {comments > 0 && ' '}
        {comments > 0 && <Text color="warning">{comments} open</Text>}
      </Button>
      {!isFolded && section.rows.map(row =>
        artifactRow(elements, row, now, [
          promptAction(section.repo.key, row, handlers),
          { key: `unlink:${section.repo.key}:${row.slug}`, label: 'Unlink', onPress: () => handlers.unlink(row, section.repo) },
        ]),
      )}
    </Box>
  )
}

const unlinkedRow = (elements: Elements, row: ArtifactRow, view: ArtifactsViewModel, handlers: ArtifactsHandlers, now: number) => {
  const { Box, Button } = elements
  const isPicking = view.linking === row.slug
  return (
    <Box key={`unlinked:${row.slug}`} flexDirection="column">
      {artifactRow(elements, row, now, [
        promptAction('unlinked', row, handlers),
        { key: `pick:${row.slug}`, label: isPicking ? 'Cancel' : 'Link to…', onPress: () => handlers.pick(row) },
      ])}
      {isPicking && (
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {(view.model?.choices ?? []).map(repo => (
            <Button
              key={`link:${row.slug}:${repo.key}`}
              label={repo.name}
              onPress={() => handlers.link(row, repo)}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

/** Each repo's artifacts, the active repo first, then on request the user's own that no repo holds. */
export const artifactsView = (elements: Elements, view: ArtifactsViewModel, handlers: ArtifactsHandlers) => {
  const { Box, Button, Text } = elements
  const { model } = view
  const now = model?.at ?? Date.now()
  const unlinked = model?.unlinked ?? []

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Button key="refresh" label="Refresh" onPress={handlers.refresh} />
        {view.isLoading && <Text dimColor>Reading…</Text>}
      </Box>
      {model?.error != null && <Text color="error">{model.error}</Text>}
      {(model?.sections ?? []).map(section => repoSection(elements, section, view, handlers, now))}
      {unlinked.length > 0 && (
        <Box flexDirection="row" marginTop={1}>
          <Button
            key="toggle-unlinked"
            label={`${view.showUnlinked ? 'Hide' : 'Show'} ${unlinked.length} in no repo`}
            onPress={handlers.toggleUnlinked}
          />
        </Box>
      )}
      {view.showUnlinked && unlinked.map(row => unlinkedRow(elements, row, view, handlers, now))}
    </Box>
  )
}
