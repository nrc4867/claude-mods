export type TouchedFile = {
  /** Path relative to the session root, or absolute when outside it. */
  path: string
  /** Absolute path, as the edit named it; what the editor opens. */
  absPath: string
  lines: number
  edits: number
  /** Epoch ms of the latest edit. */
  at: number
}

export type ReadFile = {
  /** Path relative to the session root, or absolute when outside it. */
  path: string
  /** Absolute path; what the editor opens. */
  absPath: string
  reads: number
  /** Epoch ms of the latest read. */
  at: number
}

export type ToolRunStatus = 'running' | 'ok' | 'error' | 'denied'

export type ToolRun = {
  id: string
  /** The tool's display name (`Bash`, `intellij:read_file`). */
  tool: string
  /** One line naming what the call acted on: a command, path or pattern. */
  summary: string
  status: ToolRunStatus
  /** True when a subagent made the call. */
  isSubagent: boolean
  startedAt: number
  /** Wall time in ms once the call settled. */
  ms?: number
}

/** `flagged` when Claude asked the person to look; `mentioned` when its reply named it. */
export type LinkSource = 'flagged' | 'mentioned'

export type SessionLink = {
  /** Identity in the list: the target and line, case folded for a file. */
  id: string
  kind: 'file' | 'url' | 'command'
  /** The absolute path, URL or shell command. */
  target: string
  /** The display path, relative to the session root when inside it, or the URL. */
  label: string
  line: number | null
  /** The absolute folder a command runs in; null for any other kind. */
  cwd: string | null
  note: string | null
  source: LinkSource
  /** Epoch ms it was added. */
  at: number
}

export type CommandRunStatus = 'running' | 'ok' | 'failed' | 'stopped'

/** The latest run of an attached command. */
export type CommandRun = {
  status: CommandRunStatus
  exitCode: number | null
  /** The end of what it wrote, as drawable text. */
  output: string
  startedAt: number
  /** Wall time in ms once it ended. */
  ms: number | null
}

export type SectionId = 'written' | 'read' | 'tools'

/** Whether each pane section is expanded. */
export type SectionsOpen = Record<SectionId, boolean>

declare module 'claude-code' {
  interface PluginState {
    'session-files': {
      files: Shaped<TouchedFile[]>
      reads: Shaped<ReadFile[]>
      calls: Shaped<ToolRun[]>
      sections: Shaped<SectionsOpen>
      links: Shaped<SessionLink[]>
      /** Each attached command's latest run, by link id. */
      commandRuns: Shaped<Record<string, CommandRun>>
      /** The command link waiting for its confirming press. */
      armedCommand: string | null
    }
  }
}
