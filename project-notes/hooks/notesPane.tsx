import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Note, NoteImage, NotesModel, NotesRepo, RepoChoice } from '../types'
import { NOTES_PANE_TITLE, NOTES_PENDING_PREFIX, NOTES_STORE_PREFIX } from './constants'
import { openImageFile, removeImageFiles, saveClipboardImage } from './notesImages'
import { listRepoChoices, readNotes, resolveNotesRepo, writeNotes } from './notesFile'
import {
  appendNote,
  attachImages,
  droppedImages,
  editNote,
  markAdded,
  parsePending,
  promptText,
  removeAdded,
  removeImage,
  removeNote,
  statusBarValue,
  waitingNotes,
} from './notesRules'
import { CLEAR_ADDED, imageArmKey, notesView, repoPicker } from './notesView'
import type { NotesHandlers } from './notesView'

// Literals here so the engine can match the command and pane by name.
const COMMAND = 'notes'
const PANE_ID = 'project-notes'

const model = atom({ plugin: 'project-notes', key: 'notesModel' } as const, null, {
  shape: 'notes-3',
})
const pickedRepo = atom({ plugin: 'project-notes', key: 'notesRepo' } as const, null)
const choices = atom({ plugin: 'project-notes', key: 'notesChoices' } as const, null)
const draft = atom({ plugin: 'project-notes', key: 'notesDraft' } as const, '')
const editing = atom({ plugin: 'project-notes', key: 'notesEditing' } as const, null)
const armed = atom({ plugin: 'project-notes', key: 'notesArmed' } as const, null)
const notice = atom({ plugin: 'project-notes', key: 'notesNotice' } as const, null)
const statusBar = atom({ plugin: 'project-notes', key: 'statusBar' } as const, {})

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** The picked repo, else the session's, else the one last picked from this session root. */
async function currentRepo($: EngineInterface): Promise<NotesRepo | null> {
  const picked = await read($, pickedRepo)
  if (picked !== null) return resolveNotesRepo($, picked)
  const own = await resolveNotesRepo($, await $.session.cwd())
  if (own !== null) return own
  const last = await $.store.get(`${NOTES_STORE_PREFIX}${await $.session.root()}`)
  return typeof last === 'string' ? resolveNotesRepo($, last) : null
}

const pendingKey = (repo: NotesRepo): string => `${NOTES_PENDING_PREFIX}${repo.imagesDir}`

async function readPending($: EngineInterface, repo: NotesRepo): Promise<NoteImage[]> {
  return parsePending(await $.store.get(pendingKey(repo)))
}

/** Reads the current repo's notes from disk, where other sessions may have changed them. */
export async function refreshNotes($: EngineInterface): Promise<void> {
  const repo = await currentRepo($)
  const notes = repo === null ? null : await readNotes($, repo.file)
  const pending = repo === null ? [] : await readPending($, repo)
  const next: NotesModel = {
    repo,
    notes: notes ?? [],
    pending,
    isUnreadable: notes === null && repo !== null,
    at: Date.now(),
  }
  await update($, model, () => next)
  await update($, statusBar, () => statusBarValue(waitingNotes(next.notes).length))
}

/** Opens the pane with the keyboard; a tab behind another comes forward. */
export async function openNotesPane($: EngineInterface): Promise<void> {
  const panes = await $.ui.panes()
  if (panes.some(p => p.id === PANE_ID && !p.isShown)) await $.ui.close({ id: PANE_ID })
  await update($, notice, () => null)
  await update($, armed, () => null)
  await refreshNotes($)
  const repo = (await read($, model))?.repo ?? null
  await update($, choices, () => null)
  if (repo === null) {
    const found = await listRepoChoices($)
    await update($, choices, () => found)
  }
  await $.ui.open({ id: PANE_ID, title: NOTES_PANE_TITLE, focus: true })
}

/** Applies a change to the notes as they stand on disk; false when it could not be saved. */
async function changeNotes($: EngineInterface, change: (notes: readonly Note[]) => Note[]): Promise<boolean> {
  await update($, armed, () => null)
  try {
    const repo = await currentRepo($)
    if (repo === null) throw new Error('No repo')
    const notes = await readNotes($, repo.file)
    if (notes === null) throw new Error('Notes file not understood; it was left as it is:')
    const next = change(notes)
    await writeNotes($, repo.file, next)
    await removeImageFiles($, droppedImages(notes, next).map(file => `${repo.imagesDir}/${file}`))
    await update($, notice, () => null)
    await refreshNotes($)
    return true
  } catch (error) {
    await update($, notice, () => ({ text: messageOf(error), isError: true }))
    return false
  }
}

async function submitNote($: EngineInterface, text: string): Promise<void> {
  const clean = text.trim()
  const id = await read($, editing)
  const current = await read($, model)
  const pending = current?.pending ?? []
  const edited = current?.notes.find(note => note.id === id)
  if (clean === '' && pending.length === 0 && (edited === undefined || edited.images.length === 0)) return
  const saved = await changeNotes($, notes =>
    id === null ? appendNote(notes, clean, Date.now(), pending) : attachImages(notes, id, clean, pending),
  )
  if (!saved) return
  if (current?.repo != null) await $.store.delete(pendingKey(current.repo))
  await update($, editing, () => null)
  await update($, draft, () => '')
  await refreshNotes($)
}

/** Keeps the clipboard's picture for the note being written; the note saves on Enter or `Save note`. */
async function pasteImage($: EngineInterface): Promise<void> {
  const repo = await currentRepo($)
  if (repo === null) return
  await update($, notice, () => ({ text: 'Reading the clipboard…', isError: false }))
  try {
    const image = await saveClipboardImage($, repo.imagesDir, Date.now())
    if (image === null) {
      await update($, notice, () => ({ text: 'No image on the clipboard', isError: true }))
      return
    }
    await $.store.set(pendingKey(repo), [...(await readPending($, repo)), image])
    await update($, notice, () => null)
    await refreshNotes($)
  } catch (error) {
    await update($, notice, () => ({ text: messageOf(error), isError: true }))
  }
}

async function removePending($: EngineInterface, image: NoteImage): Promise<void> {
  const repo = await currentRepo($)
  if (repo === null) return
  const left = (await readPending($, repo)).filter(one => one.file !== image.file)
  await $.store.set(pendingKey(repo), left)
  await removeImageFiles($, [`${repo.imagesDir}/${image.file}`])
  await refreshNotes($)
}

async function openImage($: EngineInterface, image: NoteImage): Promise<void> {
  const repo = await currentRepo($)
  if (repo === null) return
  try {
    await openImageFile($, `${repo.imagesDir}/${image.file}`)
  } catch (error) {
    await update($, notice, () => ({ text: messageOf(error), isError: true }))
  }
}

async function pressRemoveImage($: EngineInterface, note: Note, image: NoteImage): Promise<void> {
  if (await confirm($, imageArmKey(image))) await changeNotes($, notes => removeImage(notes, note.id, image.file))
}

/** Leaves the draft for the person to send; a note is marked once the prompt took it. */
async function addToPrompt($: EngineInterface, notes: readonly Note[]): Promise<void> {
  const imagesDir = (await read($, model))?.repo?.imagesDir ?? ''
  const filled = await $.prompt.fill({ text: promptText(notes, imagesDir), mode: 'append' })
  if (!filled.isFilled) {
    await update($, notice, () => ({ text: 'The prompt box did not take the notes', isError: true }))
    return
  }
  const ids = notes.map(note => note.id)
  await changeNotes($, current => markAdded(current, ids, Date.now()))
}

/** The first press arms; true on the press that confirms. */
async function confirm($: EngineInterface, key: string): Promise<boolean> {
  if ((await read($, armed)) === key) return true
  await update($, armed, () => key)
  return false
}

async function pressDelete($: EngineInterface, note: Note): Promise<void> {
  if (!(await confirm($, note.id))) return
  await changeNotes($, notes => removeNote(notes, note.id))
  if ((await read($, editing)) === note.id) {
    await update($, editing, () => null)
    await update($, draft, () => '')
  }
}

async function pressClearAdded($: EngineInterface): Promise<void> {
  if (await confirm($, CLEAR_ADDED)) await changeNotes($, removeAdded)
}

async function startEdit($: EngineInterface, note: Note): Promise<void> {
  await update($, armed, () => null)
  await update($, editing, () => note.id)
  await update($, draft, () => note.text)
}

async function cancelEdit($: EngineInterface): Promise<void> {
  await update($, editing, () => null)
  await update($, draft, () => '')
}

async function showRepos($: EngineInterface): Promise<void> {
  const found = await listRepoChoices($)
  await update($, choices, () => found)
}

async function pickRepo($: EngineInterface, choice: RepoChoice): Promise<void> {
  await update($, pickedRepo, () => choice.path)
  await update($, choices, () => null)
  await update($, editing, () => null)
  await update($, draft, () => '')
  await $.store.set(`${NOTES_STORE_PREFIX}${await $.session.root()}`, choice.path)
  await refreshNotes($)
}

const handlersFor = ($: EngineInterface): NotesHandlers => {
  const quietly = (work: Promise<unknown>): void => void work.catch(() => undefined)
  return {
    submit: text => quietly(submitNote($, text)),
    draftChanged: text => quietly(update($, draft, () => text)),
    cancelEdit: () => quietly(cancelEdit($)),
    addToPrompt: notes => quietly(addToPrompt($, notes)),
    edit: note => quietly(startEdit($, note)),
    remove: note => quietly(pressDelete($, note)),
    clearAdded: () => quietly(pressClearAdded($)),
    pasteImage: () => quietly(pasteImage($)),
    saveNote: () => quietly(read($, draft).then(text => submitNote($, text))),
    removePending: image => quietly(removePending($, image)),
    openImage: image => quietly(openImage($, image)),
    removeImage: (note, image) => quietly(pressRemoveImage($, note, image)),
    showRepos: () => quietly(showRepos($)),
    pickRepo: choice => quietly(pickRepo($, choice)),
  }
}

export const registerNotesPane = (on: Parameters<Register>[0]): void => {
  on('command.run', { command: COMMAND }, async $ => {
    try {
      await openNotesPane($)
      return { text: 'Notes pane opened.' }
    } catch (error) {
      return { text: `Could not open the Notes pane: ${messageOf(error)}` }
    }
  })

  on('ui.press', { plugin: 'project-status', element: 'notes' }, async ($, e, next) => {
    await openNotesPane($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Button, Text } = table
    const elements = {
      Box,
      Button,
      Text,
      Input: 'Input' in table ? table.Input : null,
      Image: 'Image' in table ? table.Image : null,
    }
    const current = await read($, model)
    const picking = await read($, choices)
    const handlers = handlersFor($)

    if (picking !== null || current?.repo == null) {
      return repoPicker(elements, picking ?? [], handlers)
    }
    return notesView(
      elements,
      {
        model: current,
        draft: await read($, draft),
        editing: await read($, editing),
        armed: await read($, armed),
        notice: await read($, notice),
        columns: e.props.bodyColumns,
      },
      handlers,
    )
  })
}
