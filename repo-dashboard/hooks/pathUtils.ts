const normalize = (path: string): string => path.replace(/\\/g, '/').replace(/\/+$/, '')

export const joinPath = (dir: string, name: string): string => `${normalize(dir)}/${name}`

export const parentOf = (path: string): string => {
  const n = normalize(path)
  const cut = n.lastIndexOf('/')
  return cut <= 0 ? n : n.slice(0, cut)
}

export const basename = (path: string): string => normalize(path).split('/').pop() ?? path

export const samePath = (a: string, b: string): boolean =>
  normalize(a).toLowerCase() === normalize(b).toLowerCase()
