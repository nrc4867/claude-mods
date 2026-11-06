export type ArtifactRow = {
  slug: string
  title: string
  url: string
  /** The type it was made from (`Design`, `Docs`); null for a plain page. */
  kind: string | null
  /** Epoch ms of its last change. */
  updatedAt: number
  /** Unresolved comment threads; null where this server cannot read them, as on a Claude Doc. */
  openComments: number | null
}

export type ArtifactsRepo = {
  name: string
  /** The repo's shared git folder: every worktree answers the same one. */
  key: string
  /** The checkout's top folder, forward slashes. */
  dir: string
}

/** Repo key → refs: an artifact's slug, or its claude.ai URL until a list names its slug. */
export type LinkMap = Record<string, string[]>

export type RepoSection = {
  repo: ArtifactsRepo
  rows: ArtifactRow[]
}

export type ArtifactsModel = {
  /** Each repo holding an artifact; the active repo first, then by latest change. */
  sections: RepoSection[]
  /** The repos an artifact can be linked to: those under the session root, and any already holding one. */
  choices: ArtifactsRepo[]
  /** The user's own artifacts no repo holds. */
  unlinked: ArtifactRow[]
  /** Epoch ms of the read; ages count from here. */
  at: number
  /** Why the last read failed; null when it did not. */
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'project-artifacts': {
      artifactsModel: Shaped<ArtifactsModel | null>
      /** The repo this session last worked in: the one artifacts published now join. */
      artifactsActiveRepo: Shaped<ArtifactsRepo | null>
      /** The unlinked artifact whose repo is being picked; null otherwise. */
      artifactsLinking: string | null
      /** Keys of the repos whose artifacts are folded under their heading. */
      artifactsCollapsed: string[]
      /** True while a read is under way. */
      artifactsLoading: boolean
      /** True while the artifacts no repo holds are listed. */
      artifactsShowUnlinked: boolean
      /** What the status bar shows for this mod's command. */
      statusBar: Record<string, { text: string }>
    }
  }
}
