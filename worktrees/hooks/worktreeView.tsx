import type { DiffSide, FileChange, GitOverview, Notice, Worktree } from '../types'
import { basename, clock, elapsed } from './formatUtils'
import {
  canMerge,
  cleanupBlockers,
  describeLanding,
  isMergeBlockedByChanges,
  landingState,
} from './worktreeRules'

/** The surface's elements, as `$.ui.resolve(e)` hands them to the pane's hook. */
type Elements = { Box: any; Button: any; Text: any }

export type ViewHandlers = {
  refresh: () => void
  fetch: () => void
  /** The repo-dashboard mod answers this button's press. */
  repos: () => void
  select: (path: string) => void
  merge: (w: Worktree) => void
  cleanup: (w: Worktree) => void
  conflictPrompt: (w: Worktree) => void
  openFile: (w: Worktree, side: DiffSide, file: FileChange) => void
}

export type ViewModel = {
  state: GitOverview
  shown: Worktree | undefined
  isMergeArmed: boolean
  isCleanupArmed: boolean
  notice: Notice | null
}

const changeColor = (code: string): string =>
  code === '??' ? 'inactive' : code.includes('D') ? 'error' : code[0] !== ' ' ? 'success' : 'warning'

const fileRows = (
  { Button, Text }: Elements,
  side: DiffSide,
  files: FileChange[],
  onOpen: (side: DiffSide, file: FileChange) => void,
) =>
  files.map(f => (
    <Button key={`${side}:${f.path}`} plain onPress={() => onOpen(side, f)}>
      <Text color={changeColor(f.code)}>{f.code} </Text>
      <Text>{f.path}</Text>
    </Button>
  ))

const describeActivity = (w: Worktree, now: number): string | null => {
  if (w.activity === null) return null
  const age = elapsed(w.activity.at, now)
  const what = w.activity.kind === 'edit' ? 'Last edit' : 'Last commit'
  return age === 'now' ? `${what} just now` : `${what} ${age} ago`
}

const mergeLabel = (w: Worktree, base: string, isArmed: boolean): string => {
  if (w.merge === 'ff') return `Merge to ${base} (ff)`
  return isArmed ? 'Confirm rebase and merge' : `Rebase and merge to ${base}`
}

function mergeControl(ui: Elements, model: ViewModel, w: Worktree, handlers: ViewHandlers) {
  const { Box, Button, Text } = ui
  const { base } = model.state
  if (base === null) return null
  if (canMerge(w)) {
    return (
      <Button
        key="merge"
        variant={model.isMergeArmed ? 'primary' : undefined}
        label={mergeLabel(w, base, model.isMergeArmed)}
        onPress={() => handlers.merge(w)}
      />
    )
  }
  if (w.merge === 'conflicts') {
    return (
      <Box flexDirection="row" gap={1}>
        <Text color="error">Conflicts with {base}</Text>
        <Button key="conflict-prompt" label="Add to prompt" onPress={() => handlers.conflictPrompt(w)} />
      </Box>
    )
  }
  if (isMergeBlockedByChanges(w)) return <Text color="warning">Uncommitted changes block rebase</Text>
  if (w.merge === 'unknown') return <Text color="warning">Merge check failed</Text>
  return null
}

function cleanupControl(ui: Elements, model: ViewModel, w: Worktree, handlers: ViewHandlers) {
  const { Button, Text } = ui
  const blockers = cleanupBlockers(w)
  if (blockers.length > 0) return <Text dimColor>Cleanup: {blockers.join(', ')}</Text>
  return (
    <Button
      key="cleanup"
      variant={model.isCleanupArmed ? 'primary' : undefined}
      label={model.isCleanupArmed ? 'Confirm remove worktree and branch' : 'Safe cleanup'}
      onPress={() => handlers.cleanup(w)}
    />
  )
}

function details(ui: Elements, model: ViewModel, w: Worktree, handlers: ViewHandlers) {
  const { Box, Text } = ui
  const { base } = model.state
  return (
    <Box flexDirection="column">
      <Text bold>
        {'\n'}
        {basename(w.path)} <Text dimColor>{w.branch ?? 'detached'}</Text>
      </Text>
      {w.activity !== null && <Text dimColor>{describeActivity(w, model.state.at)}</Text>}
      {base !== null && w.branch !== base && (
        <Text color={landingState(w) === 'landed' ? 'success' : 'warning'}>{describeLanding(w)}</Text>
      )}
      <Box flexDirection="row" gap={2}>
        {mergeControl(ui, model, w, handlers)}
        {cleanupControl(ui, model, w, handlers)}
      </Box>

      {base !== null && w.branch !== base && (
        <Text bold>
          {'\n'}Against {base} <Text dimColor>{w.committed.length}</Text>
        </Text>
      )}
      {fileRows(ui, 'committed', w.committed, (side, file) => handlers.openFile(w, side, file))}

      <Text bold>
        {'\n'}Uncommitted <Text dimColor>{w.files.length}</Text>
      </Text>
      {fileRows(ui, 'uncommitted', w.files, (side, file) => handlers.openFile(w, side, file))}
    </Box>
  )
}

export function worktreeView(ui: Elements, model: ViewModel, handlers: ViewHandlers) {
  const { Box, Button, Text } = ui
  const { state, shown, notice } = model
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor wrap="truncate-end">
          {basename(state.repo)} · {clock(state.at)}
          {state.base !== null && state.baseBehind > 0 && (
            <Text color="error">
              {' '}
              · {state.base} ↓{state.baseBehind}
            </Text>
          )}
        </Text>
        <Box flexDirection="row" gap={1}>
          <Button key="repos" hotkey="p" label="Repos" onPress={handlers.repos} />
          <Button key="fetch" hotkey="f" label="Fetch" onPress={handlers.fetch} />
          <Button key="refresh" hotkey="r" label="Refresh" onPress={handlers.refresh} />
        </Box>
      </Box>
      {notice !== null && <Text color={notice.isError ? 'error' : 'success'}>{notice.text}</Text>}

      <Text bold>{'\n'}Worktrees</Text>
      {state.worktrees.map(w => (
        <Button key={`worktree:${w.path}`} plain onPress={() => handlers.select(w.path)}>
          {w === shown ? '▸ ' : '  '}
          <Text bold={w.isCurrent}>{basename(w.path)}</Text>{' '}
          <Text dimColor>{w.branch ?? 'detached'}</Text>
          {w.files.length > 0 && <Text color="warning"> ●{w.files.length}</Text>}
          {w.ahead > 0 && <Text color="suggestion"> ↑{w.ahead}</Text>}
          {w.behind > 0 && <Text color="error"> ↓{w.behind}</Text>}
          {landingState(w) === 'landed' && <Text color="success"> ✓ landed</Text>}
          {landingState(w) === 'uncommitted' && <Text color="warning"> ! uncommitted</Text>}
          {w.merge === 'conflicts' && <Text color="error"> ✗ conflicts</Text>}
          {w.activity !== null && <Text dimColor> · {elapsed(w.activity.at, state.at)}</Text>}
        </Button>
      ))}

      {shown !== undefined && details(ui, model, shown, handlers)}

      {state.otherBranches.length > 0 && <Text bold>{'\n'}Other branches</Text>}
      {state.otherBranches.map(b => (
        <Box flexDirection="row" key={`branch:${b.name}`}>
          <Text wrap="truncate-end">{b.name}</Text>
          {b.ahead > 0 && <Text color="suggestion"> ↑{b.ahead}</Text>}
          {b.behind > 0 && <Text color="error"> ↓{b.behind}</Text>}
        </Box>
      ))}
    </Box>
  )
}
