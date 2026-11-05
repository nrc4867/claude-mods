import { expect, test } from 'claude-code/testing'
import { repoName } from '../hooks/notes/notesFile'
import { clipboardScript, imageCells, parseImageSize, psQuote } from '../hooks/notes/notesImages'
import { droppedImages, parseNotes, promptText, removeImage } from '../hooks/notes/notesRules'

const PLUGIN = 'project-status'
const GIT_DIR = 'C:/ws/app/.git'
const FILE = `${GIT_DIR}/claude-project-notes.json`

const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'project-status-notes',
  surface: 'terminal',
  props: {
    title: 'Notes',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const norm = (path: string | undefined): string => (path ?? '').replace(/\\/g, '/')

type Disk = {
  files: Map<string, string>
  filled: string[]
  store: Map<string, unknown>
  shell: string[]
  clipboardExit: number
}

/** A repo at `C:/ws/app` and a plain folder at `C:/ws`, with an in-memory disk. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubEngine = (on: any, cwd = 'C:/ws/app'): Disk => {
  const disk: Disk = { files: new Map(), filled: [], store: new Map(), shell: [], clipboardExit: 0 }
  on('session.root', () => ({ value: cwd }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.usage', () => ({ value: { context: { tokens: 1, window: 100, percent: 1 } } }))
  on('process.run', (_: unknown, e: any) => {
    if (e.argv[0] === 'powershell.exe') {
      disk.shell.push(e.argv.at(-1))
      const isPaste = e.argv.at(-1).includes('Clipboard')
      return { value: { exitCode: isPaste ? disk.clipboardExit : 0, stdout: isPaste ? '800x400\n' : '', stderr: '' } }
    }
    const inRepo = norm(e.init?.cwd).includes('/ws/app')
    const isCommonDir = e.argv.includes('--git-common-dir')
    return {
      value: {
        exitCode: inRepo && isCommonDir ? 0 : 128,
        stdout: inRepo && isCommonDir ? `${GIT_DIR}\n` : '',
        stderr: '',
      },
    }
  })
  on('fs.exists', (_: unknown, e: any) => {
    const path = norm(e.path)
    return { value: disk.files.has(path) || path.endsWith('/ws/app/.git') }
  })
  on('fs.read', (_: unknown, e: any) => ({ value: disk.files.get(norm(e.path)) ?? '' }))
  on('fs.write', (_: unknown, e: any) => {
    disk.files.set(norm(e.path), e.text)
    return { value: undefined }
  })
  on('fs.list', () => ({
    value: [
      { name: 'app', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
      { name: 'plain', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
    ],
  }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('prompt.fill', (_: unknown, e: any) => {
    disk.filled.push(e.text)
    return { isFilled: true }
  })
  on('store.get', (_: unknown, e: any) => ({ value: disk.store.get(e.key) }))
  on('store.set', (_: unknown, e: any) => {
    disk.store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: unknown, e: any) => {
    disk.store.delete(e.key)
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'notes' } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  return disk
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openPane = async ($: any, cwd = 'C:/ws/app') => {
  await $.session.start({ cwd, surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'notes' })
  return $.ui.mount(PANE)
}

const stored = (disk: Disk) => parseNotes(disk.files.get(FILE) ?? '') ?? []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addNote = async ($: any, text: string): Promise<void> => {
  await $.ui.input({ plugin: PLUGIN, key: 'note-input', text, kind: 'change' })
  await $.ui.input({ plugin: PLUGIN, key: 'note-input', text })
}

test('repo names and prompt text read as a person would write them', () => {
  expect(repoName('C:/ws/app/.git')).toBe('app')
  expect(repoName('C:/ws/app.git')).toBe('app')
  const note = (text: string) => ({ id: text, text, images: [], at: 0, addedAt: null })
  expect(promptText([note('one')], '/i')).toBe('one\n')
  expect(promptText([note('one\nmore'), note('two')], '/i')).toBe('- one\n  more\n- two\n')
})

test('a saved note lands in the shared git folder and sends nothing', async ($, on) => {
  const disk = stubEngine(on)
  const ui = await openPane($)
  await addNote($, '  check the flaky test  ')

  expect(stored(disk).map(n => n.text)).toEqual(['check the flaky test'])
  expect(disk.filled).toEqual([])
  expect((await ui.find({ type: 'Text', text: /check the flaky/ }))?.text).toBe('check the flaky test')
  await ui.unmount()
})

test('a saved note stays for the next session', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(
    FILE,
    JSON.stringify({ notes: [{ id: 'a', text: 'kept from before', at: 1, addedAt: null }] }),
  )
  const ui = await openPane($)
  expect((await ui.find({ type: 'Text', text: /kept from before/ }))?.text).toBe('kept from before')
  await ui.unmount()
})

test('To prompt leaves the note in the prompt unsent and marks it added', async ($, on) => {
  const disk = stubEngine(on)
  const ui = await openPane($)
  await addNote($, 'first')
  const [note] = stored(disk)

  await ui.press({ key: `prompt:${note?.id}` })
  expect(disk.filled).toEqual(['first\n'])
  expect(stored(disk)[0]?.addedAt).not.toBe(null)
  await ui.unmount()
})

test('All to prompt takes only the notes not yet added', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(
    FILE,
    JSON.stringify({
      notes: [
        { id: 'a', text: 'used', at: 1, addedAt: 2 },
        { id: 'b', text: 'two', at: 1, addedAt: null },
        { id: 'c', text: 'three', at: 1, addedAt: null },
      ],
    }),
  )
  const ui = await openPane($)
  await ui.press({ key: 'prompt-all' })
  expect(disk.filled).toEqual(['- two\n- three\n'])
  await ui.unmount()
})

test('delete takes a second press', async ($, on) => {
  const disk = stubEngine(on)
  const ui = await openPane($)
  await addNote($, 'gone soon')
  const id = stored(disk)[0]?.id

  await ui.press({ key: `delete:${id}` })
  expect(stored(disk).length).toBe(1)
  expect((await ui.find({ key: `delete:${id}` }))?.text).toBe('Confirm delete')
  await ui.press({ key: `delete:${id}` })
  expect(stored(disk).length).toBe(0)
  await ui.unmount()
})

test('editing replaces the note and clears its added mark', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(FILE, JSON.stringify({ notes: [{ id: 'a', text: 'old', at: 1, addedAt: 2 }] }))
  const ui = await openPane($)
  await ui.press({ key: 'edit:a' })
  await $.ui.input({ plugin: PLUGIN, key: 'note-input', text: 'new' })

  expect(stored(disk)).toEqual([{ id: 'a', text: 'new', images: [], at: 1, addedAt: null }])
  await ui.unmount()
})

test('a notes file it cannot read is shown, never overwritten', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(FILE, 'my own text, not json')
  const ui = await openPane($)

  expect(await ui.find({ key: 'note-input' })).toBe(undefined)
  expect(disk.files.get(FILE)).toBe('my own text, not json')
  await ui.unmount()
})

test('from a folder of repos the pane offers them and remembers the pick', async ($, on) => {
  const disk = stubEngine(on, 'C:/ws')
  const ui = await openPane($, 'C:/ws')

  expect((await ui.find({ key: 'pick:C:/ws/app' }))?.text).toBe('app')
  expect(await ui.find({ key: 'pick:C:/ws/plain' })).toBe(undefined)
  await ui.press({ key: 'pick:C:/ws/app' })
  await addNote($, 'in the picked repo')

  expect(stored(disk).map(n => n.text)).toEqual(['in the picked repo'])
  expect(disk.store.get('notes-repo:C:/ws')).toBe('C:/ws/app')
  await ui.unmount()
})

test('the status bar counts the notes waiting', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(FILE, JSON.stringify({ notes: [{ id: 'a', text: 'one', at: 1, addedAt: null }] }))
  on('ui.render', { component: 'PromptHint' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.hint}</Text>
  })
  await $.session.start({ cwd: 'C:/ws/app', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    component: 'PromptHint',
    requestId: 'hint',
    surface: 'terminal',
    props: { isDraft: false, isWorking: false, hint: '?' },
  })
  expect((await ui.find({ key: 'notes' }))?.text).toBe('1 note')
  await ui.unmount()
})

const IMAGE = { file: '5.png', width: 800, height: 400 }

test('picture helpers keep proportions, quote paths and find what was dropped', () => {
  expect(parseImageSize('800x400\r\n')).toEqual({ width: 800, height: 400 })
  expect(parseImageSize('')).toBe(null)
  expect(imageCells(IMAGE, 60)).toEqual({ columns: 48, rows: 12 })
  expect(imageCells(IMAGE, 20)).toEqual({ columns: 20, rows: 5 })
  expect(imageCells({ file: 't', width: 100, height: 1000 }, 60)).toEqual({ columns: 3, rows: 16 })
  expect(psQuote("C:/it's")).toBe("'C:/it''s'")
  expect(clipboardScript('C:/d', 'C:/d/f.png')).not.toContain('"')

  const note = { id: 'a', text: '', images: [IMAGE], at: 0, addedAt: null }
  expect(removeImage([note], 'a', '5.png')).toEqual([])
  expect(removeImage([{ ...note, text: 'kept' }], 'a', '5.png')[0]?.images).toEqual([])
  expect(droppedImages([note], [])).toEqual(['5.png'])
  expect(droppedImages([note], [note])).toEqual([])
})

test('an older notes file without pictures still reads', () => {
  expect(parseNotes(JSON.stringify({ notes: [{ id: 'a', text: 't', at: 1, addedAt: null }] }))?.[0]?.images).toEqual([])
})

const PENDING_KEY = `notes-pending:${GIT_DIR}/claude-project-notes-images`

test('several pictures wait for the note, which saves them with its text on Enter', async ($, on) => {
  const disk = stubEngine(on)
  const ui = await openPane($)
  await $.ui.input({ plugin: PLUGIN, key: 'note-input', text: 'this button is wrong', kind: 'change' })
  await ui.press({ key: 'paste-image' })
  await ui.press({ key: 'paste-image' })

  expect(stored(disk)).toEqual([])
  const pending = disk.store.get(PENDING_KEY) as { file: string }[]
  expect(pending.length).toBe(2)
  expect(await ui.find({ key: `open:${pending[0]?.file}` })).not.toBe(undefined)
  expect(disk.shell[0]).toContain(`${GIT_DIR}/claude-project-notes-images/${pending[0]?.file}`)

  await $.ui.input({ plugin: PLUGIN, key: 'note-input', text: 'this button is wrong' })
  const [note] = stored(disk)
  expect(note?.text).toBe('this button is wrong')
  expect(note?.images.length).toBe(2)
  expect(disk.store.has(PENDING_KEY)).toBe(false)
  await ui.unmount()
})

test('Save note saves pictures with no text, and a waiting picture can be removed', async ($, on) => {
  const disk = stubEngine(on)
  const ui = await openPane($)
  expect(await ui.find({ key: 'save-note' })).toBe(undefined)
  await ui.press({ key: 'paste-image' })
  const first = (disk.store.get(PENDING_KEY) as { file: string }[])[0]?.file
  await ui.press({ key: `remove-pending:${first}` })
  expect(disk.store.get(PENDING_KEY)).toEqual([])
  expect(disk.shell.at(-1)).toContain(`/${first}`)

  await ui.press({ key: 'paste-image' })
  await ui.press({ key: 'save-note' })
  expect(stored(disk)[0]?.text).toBe('')
  expect(stored(disk)[0]?.images.length).toBe(1)
  await ui.unmount()
})

test('waiting pictures are still there in the next session', async ($, on) => {
  const disk = stubEngine(on)
  disk.store.set(PENDING_KEY, [IMAGE])
  const ui = await openPane($)
  expect(await ui.find({ key: 'remove-pending:5.png' })).not.toBe(undefined)
  await ui.unmount()
})

test('pictures pasted while editing join that note', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(FILE, JSON.stringify({ notes: [{ id: 'a', text: 'old', images: [IMAGE], at: 1, addedAt: 2 }] }))
  const ui = await openPane($)
  await ui.press({ key: 'edit:a' })
  await ui.press({ key: 'paste-image' })
  expect(stored(disk)[0]?.images.length).toBe(1)
  await $.ui.input({ plugin: PLUGIN, key: 'note-input', text: 'old' })
  expect(stored(disk)[0]?.images.length).toBe(2)
  expect(stored(disk)[0]?.addedAt).toBe(null)
  await ui.unmount()
})

test('with no picture on the clipboard the draft stays and nothing is saved', async ($, on) => {
  const disk = stubEngine(on)
  disk.clipboardExit = 3
  const ui = await openPane($)
  await $.ui.input({ plugin: PLUGIN, key: 'note-input', text: 'still typing', kind: 'change' })
  await ui.press({ key: 'paste-image' })

  expect(stored(disk)).toEqual([])
  expect((await ui.find({ type: 'Text', text: /No image/ }))?.text).toBe('No image on the clipboard')
  expect(disk.shell.length).toBe(1)
  await ui.unmount()
})

test('To prompt adds the picture as a path, unsent', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(FILE, JSON.stringify({ notes: [{ id: 'a', text: 'look', images: [IMAGE], at: 1, addedAt: null }] }))
  const ui = await openPane($)
  await ui.press({ key: 'prompt:a' })
  expect(disk.filled).toEqual([`look\n${GIT_DIR}/claude-project-notes-images/5.png\n`])
  await ui.unmount()
})

test('deleting a note also deletes its picture; another note keeps its own', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(
    FILE,
    JSON.stringify({
      notes: [
        { id: 'a', text: 'one', images: [IMAGE], at: 1, addedAt: null },
        { id: 'b', text: 'two', images: [{ ...IMAGE, file: '6.png' }], at: 1, addedAt: null },
      ],
    }),
  )
  const ui = await openPane($)
  await ui.press({ key: 'delete:a' })
  expect(disk.shell).toEqual([])
  await ui.press({ key: 'delete:a' })

  expect(disk.shell.length).toBe(1)
  expect(disk.shell[0]).toContain('/5.png')
  expect(disk.shell[0]).not.toContain('/6.png')
  await ui.unmount()
})

test('Open image opens the file, and removing the last picture of an empty note removes it', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(FILE, JSON.stringify({ notes: [{ id: 'a', text: '', images: [IMAGE], at: 1, addedAt: null }] }))
  const ui = await openPane($)
  await ui.press({ key: 'open:5.png' })
  expect(disk.shell[0]).toContain('Invoke-Item')
  await ui.press({ key: 'remove-image:5.png' })
  expect(stored(disk).length).toBe(1)
  await ui.press({ key: 'remove-image:5.png' })
  expect(stored(disk)).toEqual([])
  await ui.unmount()
})

test('the save hint sits beside Paste image and follows an edit', async ($, on) => {
  const disk = stubEngine(on)
  disk.files.set(FILE, JSON.stringify({ notes: [{ id: 'a', text: 'old', at: 1, addedAt: null }] }))
  const ui = await openPane($)
  expect((await ui.find({ type: 'Text', text: /save/ }))?.text).toBe('⏎ save')
  await ui.press({ key: 'edit:a' })
  expect((await ui.find({ type: 'Text', text: /update/ }))?.text).toBe('⏎ update')
  await ui.unmount()
})
