import type { Elements as SurfaceElements } from 'claude-code'
import type { Note, NoteImage, Notice, NotesModel, RepoChoice } from '../../types'
import { NOTES_FIELD_HINT, NOTES_SAVE_HINT, NOTES_UPDATE_HINT } from '../constants'
import { elapsed } from '../formatUtils'
import { imageCells } from './notesImages'
import { waitingNotes } from './notesRules'

type TerminalElements = SurfaceElements['terminal']

/** A surface without text fields, as on mobile, draws no `Input`: the notes still show. */
type Elements = Pick<TerminalElements, 'Box' | 'Button' | 'Text'> & {
  Input: TerminalElements['Input'] | null
  /** Only the terminal draws pictures; elsewhere a note names them. */
  Image: TerminalElements['Image'] | null
}

export type NotesHandlers = {
  submit: (text: string) => void
  draftChanged: (text: string) => void
  cancelEdit: () => void
  addToPrompt: (notes: readonly Note[]) => void
  edit: (note: Note) => void
  remove: (note: Note) => void
  clearAdded: () => void
  pasteImage: () => void
  saveNote: () => void
  removePending: (image: NoteImage) => void
  openImage: (image: NoteImage) => void
  removeImage: (note: Note, image: NoteImage) => void
  showRepos: () => void
  pickRepo: (choice: RepoChoice) => void
}

export type NotesViewModel = {
  model: NotesModel
  draft: string
  editing: string | null
  armed: string | null
  notice: Notice | null
  /** The pane's width, which a picture stays within. */
  columns: number
}

/** The armed key of the `Clear added` action; notes are armed by their id. */
export const CLEAR_ADDED = 'clear-added'

/** The armed key of a picture's `Remove image`. */
export const imageArmKey = (image: NoteImage): string => `image:${image.file}`

const age = (at: number, now: number): string => {
  const ago = elapsed(at, now)
  return ago === 'now' ? 'just now' : `${ago} ago`
}

export const repoPicker = (
  { Box, Button, Text }: Elements,
  choices: readonly RepoChoice[],
  handlers: NotesHandlers,
) => (
  <Box flexDirection="column">
    {choices.length === 0 && <Text dimColor>No repos here.</Text>}
    {choices.map(choice => (
      <Button
        key={`pick:${choice.path}`}
        plain
        label={choice.name}
        onPress={() => handlers.pickRepo(choice)}
      />
    ))}
  </Box>
)

/** A picture with its size, `Open image` and the removing button the caller gives it. */
const pictureRow = (
  { Box, Button, Image, Text }: Elements,
  image: NoteImage,
  view: NotesViewModel,
  handlers: NotesHandlers,
  removeButton: ReturnType<Elements['Button']>,
) => (
  <Box key={`picture:${image.file}`} flexDirection="column">
    {Image !== null && (
      <Image
        key={`image:${image.file}`}
        source={{ file: `${view.model.repo?.imagesDir}/${image.file}`, format: 'png' }}
        alt={image.file}
        {...imageCells(image, view.columns)}
      />
    )}
    <Box flexDirection="row" gap={1}>
      <Text dimColor>
        {image.width}×{image.height}
      </Text>
      <Button key={`open:${image.file}`} label="Open image" onPress={() => handlers.openImage(image)} />
      {removeButton}
    </Box>
  </Box>
)

const imageRow = (
  elements: Elements,
  note: Note,
  image: NoteImage,
  view: NotesViewModel,
  handlers: NotesHandlers,
) =>
  pictureRow(
    elements,
    image,
    view,
    handlers,
    <elements.Button
      key={`remove-image:${image.file}`}
      label={view.armed === imageArmKey(image) ? 'Confirm remove' : 'Remove image'}
      onPress={() => handlers.removeImage(note, image)}
    />,
  )

const pendingRow = (elements: Elements, image: NoteImage, view: NotesViewModel, handlers: NotesHandlers) =>
  pictureRow(
    elements,
    image,
    view,
    handlers,
    <elements.Button
      key={`remove-pending:${image.file}`}
      label="Remove image"
      onPress={() => handlers.removePending(image)}
    />,
  )

const noteRow = (
  elements: Elements,
  note: Note,
  view: NotesViewModel,
  handlers: NotesHandlers,
) => {
  const { Box, Button, Text } = elements
  const isAdded = note.addedAt !== null
  return (
    <Box key={`note:${note.id}`} flexDirection="column" marginTop={1}>
      {note.text !== '' && <Text dimColor={isAdded}>{note.text}</Text>}
      {note.images.map(image => imageRow(elements, note, image, view, handlers))}
      <Box flexDirection="row" gap={1}>
        <Text dimColor>
          {age(note.at, view.model.at)}
          {isAdded ? ' · added' : ''}
        </Text>
        <Button key={`prompt:${note.id}`} label="To prompt" onPress={() => handlers.addToPrompt([note])} />
        {elements.Input !== null && (
          <Button key={`edit:${note.id}`} label="Edit" onPress={() => handlers.edit(note)} />
        )}
        <Button
          key={`delete:${note.id}`}
          label={view.armed === note.id ? 'Confirm delete' : 'Delete'}
          onPress={() => handlers.remove(note)}
        />
      </Box>
    </Box>
  )
}

/** The repo's notes, newest first, under the field that adds them. */
export const notesView = (elements: Elements, view: NotesViewModel, handlers: NotesHandlers) => {
  const { Box, Button, Input, Text } = elements
  const { model, notice } = view
  const waiting = waitingNotes(model.notes)
  const hasAdded = waiting.length < model.notes.length

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text bold>{model.repo?.name}</Text>
        <Button key="repos" label="Repos" onPress={handlers.showRepos} />
      </Box>
      {notice !== null && <Text color={notice.isError ? 'error' : undefined}>{notice.text}</Text>}
      {model.isUnreadable ? (
        <Text color="error">{model.repo?.file}</Text>
      ) : (
        <Box flexDirection="column">
          {Input !== null && (
            <Input
              key="note-input"
              autoFocus
              placeholder="A note"
              submitLabel={NOTES_FIELD_HINT}
              value={view.draft}
              onInput={handlers.draftChanged}
              onSubmit={handlers.submit}
            />
          )}
          {Input !== null && (
            <Box flexDirection="row" gap={1}>
              <Button key="paste-image" label="Paste image" onPress={handlers.pasteImage} />
              {model.pending.length > 0 && <Button key="save-note" label="Save note" onPress={handlers.saveNote} />}
              <Text dimColor>{view.editing === null ? NOTES_SAVE_HINT : NOTES_UPDATE_HINT}</Text>
              {view.editing !== null && <Button key="cancel-edit" label="Cancel edit" onPress={handlers.cancelEdit} />}
            </Box>
          )}
          {model.pending.map(image => pendingRow(elements, image, view, handlers))}
          {[...model.notes].reverse().map(note => noteRow(elements, note, view, handlers))}
          {(waiting.length > 1 || hasAdded) && (
            <Box flexDirection="row" gap={1} marginTop={1}>
              {waiting.length > 1 && (
                <Button key="prompt-all" label="All to prompt" onPress={() => handlers.addToPrompt(waiting)} />
              )}
              {hasAdded && (
                <Button
                  key={CLEAR_ADDED}
                  label={view.armed === CLEAR_ADDED ? 'Confirm clear' : 'Clear added'}
                  onPress={handlers.clearAdded}
                />
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
