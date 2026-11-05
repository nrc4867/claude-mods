export const countLines = (text: string): number =>
  text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

const normalize = (path: string): string => path.replace(/\\/g, '/')

const isAbsolute = (path: string): boolean => /^([a-zA-Z]:)?[\\/]/.test(path)

/** `path` relative to `root` when inside it, else the path as given. */
export const relativeTo = (root: string, path: string): string => {
  const base = normalize(root).replace(/\/+$/, '') + '/'
  const full = normalize(path)
  return full.toLowerCase().startsWith(base.toLowerCase()) ? full.slice(base.length) : full
}

/** `path` made absolute against `root` when it is relative; as given otherwise. */
export const absoluteFrom = (root: string, path: string): string =>
  isAbsolute(path) ? path : `${normalize(root).replace(/\/+$/, '')}/${normalize(path)}`
