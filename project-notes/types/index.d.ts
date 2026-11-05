export type Notice = {
  text: string
  isError: boolean
}

export type NoteImage = {
  /** The PNG's name in the repo's notes images folder. */
  file: string
  width: number
  height: number
}

export type Note = {
  id: string
  /** Whole, newlines kept; empty on a note that is only pictures. */
  text: string
  images: NoteImage[]
  /** Epoch ms it was written. */
  at: number
  /** Epoch ms it was last put in the prompt; null while it waits. */
  addedAt: number | null
}

export type NotesRepo = {
  name: string
  /** The notes file's absolute path. */
  file: string
  /** The absolute path of the folder holding the notes' pictures. */
  imagesDir: string
}

export type RepoChoice = {
  name: string
  path: string
}

export type NotesModel = {
  /** Null until a repo is known. */
  repo: NotesRepo | null
  notes: Note[]
  /** Pictures pasted for the note being written. */
  pending: NoteImage[]
  /** True when the file holds something other than notes. */
  isUnreadable: boolean
  /** Epoch ms of the read; note ages count from here. */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'project-notes': {
      notesModel: Shaped<NotesModel | null>
      /** A folder in the repo notes were picked for; null for the session's. */
      notesRepo: string | null
      /** The repos on offer while the picker shows; null otherwise. */
      notesChoices: RepoChoice[] | null
      /** The field's text. */
      notesDraft: string
      /** The note the field is editing; null when it adds a new one. */
      notesEditing: string | null
      /** The note id or action waiting for its confirming press. */
      notesArmed: string | null
      notesNotice: Notice | null
      /** What the status bar shows for this mod's command. */
      statusBar: Record<string, { text: string }>
    }
  }
}
