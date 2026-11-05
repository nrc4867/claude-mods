import type { Note, NoteImage } from '../../types'

const isImage = (value: unknown): value is NoteImage => {
  const image = value as NoteImage | null
  return (
    typeof image === 'object' &&
    image !== null &&
    typeof image.file === 'string' &&
    typeof image.width === 'number' &&
    typeof image.height === 'number'
  )
}

const isNote = (value: unknown): value is Note => {
  const note = value as Note | null
  return (
    typeof note === 'object' &&
    note !== null &&
    typeof note.id === 'string' &&
    typeof note.text === 'string' &&
    typeof note.at === 'number' &&
    (note.addedAt === null || typeof note.addedAt === 'number') &&
    (note.images === undefined || (Array.isArray(note.images) && note.images.every(isImage)))
  )
}

/** Reads the notes file's text; null when it is not a notes file, so it is never overwritten. */
export const parseNotes = (text: string): Note[] | null => {
  try {
    const parsed = JSON.parse(text) as { notes?: unknown } | null
    const notes = parsed?.notes
    if (!Array.isArray(notes) || !notes.every(isNote)) return null
    return notes.map(note => ({ ...note, images: note.images ?? [] }))
  } catch {
    return null
  }
}

export const serializeNotes = (notes: readonly Note[]): string =>
  `${JSON.stringify({ notes }, null, 2)}\n`

/** A new note, after the ones already held. */
export const appendNote = (
  notes: readonly Note[],
  text: string,
  at: number,
  images: readonly NoteImage[] = [],
): Note[] => [...notes, { id: `${at}-${notes.length}`, text, images: [...images], at, addedAt: null }]

/** A note whose text changed has not been added to a prompt in this form. */
export const editNote = (notes: readonly Note[], id: string, text: string): Note[] =>
  notes.map(note => (note.id === id ? { ...note, text, addedAt: null } : note))

/** The note with its new text and more pictures. */
export const attachImages = (
  notes: readonly Note[],
  id: string,
  text: string,
  images: readonly NoteImage[],
): Note[] =>
  notes.map(note =>
    note.id === id ? { ...note, text, images: [...note.images, ...images], addedAt: null } : note,
  )

/** The pictures held under the store's key; anything else there counts as none. */
export const parsePending = (value: unknown): NoteImage[] =>
  Array.isArray(value) ? value.filter(isImage) : []

/** Drops the picture; a note left with no text and no picture goes too. */
export const removeImage = (notes: readonly Note[], id: string, file: string): Note[] =>
  notes.flatMap(note => {
    if (note.id !== id) return [note]
    const images = note.images.filter(image => image.file !== file)
    return images.length === 0 && note.text === '' ? [] : [{ ...note, images }]
  })

/** The pictures `before` held that `after` no longer does. */
export const droppedImages = (before: readonly Note[], after: readonly Note[]): string[] => {
  const kept = new Set(after.flatMap(note => note.images.map(image => image.file)))
  return before.flatMap(note => note.images.map(image => image.file)).filter(file => !kept.has(file))
}

export const removeNote = (notes: readonly Note[], id: string): Note[] =>
  notes.filter(note => note.id !== id)

export const removeAdded = (notes: readonly Note[]): Note[] =>
  notes.filter(note => note.addedAt === null)

export const markAdded = (notes: readonly Note[], ids: readonly string[], at: number): Note[] =>
  notes.map(note => (ids.includes(note.id) ? { ...note, addedAt: at } : note))

export const waitingNotes = (notes: readonly Note[]): Note[] =>
  notes.filter(note => note.addedAt === null)

/** The note's text, then the path of each picture for the model to open. */
const noteBody = (note: Note, imagesDir: string): string =>
  [...(note.text === '' ? [] : [note.text]), ...note.images.map(image => `${imagesDir}/${image.file}`)].join('\n')

/** One note goes in as written; several as a list, a note's later lines indented under it. */
export const promptText = (notes: readonly Note[], imagesDir: string): string => {
  const [only] = notes
  if (only !== undefined && notes.length === 1) return `${noteBody(only, imagesDir)}\n`
  return notes.map(note => `- ${noteBody(note, imagesDir).replace(/\n/g, '\n  ')}\n`).join('')
}

/** The status bar's item; bare when nothing waits. */
export const notesLabel = (count: number, bare: string): string =>
  count === 0 ? bare : `${count} ${count === 1 ? 'note' : 'notes'}`
