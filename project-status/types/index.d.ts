export type StatusBar = {
  project: string
  /** Null outside a git repo. */
  branch: string | null
  /** Null until the first context reading. */
  context: string | null
}

/** The bar's items that need no command; each is also its button's key. */
export type BuiltinItemId = 'project' | 'branch' | 'context' | 'tools' | 'links' | 'notes'

export type BarItem =
  | { kind: 'builtin'; id: BuiltinItemId; isHidden: boolean }
  | {
      kind: 'command'
      /** Shown until the command's mod publishes text. */
      title: string
      /** The name, without the slash. */
      command: string
      args: string
      isHidden: boolean
    }

export type PublishedColor = 'success' | 'warning' | 'error' | 'suggestion'

/** What a mod shows for one of its commands. */
export type PublishedItem = {
  text: string
  color?: PublishedColor
}

/** One mod's `statusBar` value: its items by command name. */
export type PublishedItems = Record<string, PublishedItem>

export type Notice = {
  text: string
  isError: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'project-status': {
      bar: Shaped<StatusBar | null>
      /** Tool calls made this session, subagents' included. */
      toolCount: number
      barItems: Shaped<BarItem[]>
      /** Each mod's latest `statusBar` value, by plugin. */
      barPublished: Shaped<Record<string, PublishedItems>>
      /** The session's slash commands; null until first read. */
      barKnownCommands: string[] | null
      barTitleDraft: string
      barCommandDraft: string
      barNotice: Notice | null
    }
  }
}
