export const basename = (path: string): string =>
  path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path

export const compactTokens = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
