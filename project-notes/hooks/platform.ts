import type { EngineInterface } from 'claude-code'
import { PLATFORM_CHECK_TIMEOUT_MS } from './constants'

export type HostPlatform = 'windows' | 'mac' | 'other'

const WINDOWS_OS = 'Windows_NT'
const MAC_KERNEL = 'Darwin'

/** The machine the session runs on; a hooks module has no `process.platform` to ask. */
export async function hostPlatform($: EngineInterface): Promise<HostPlatform> {
  const os = await $.env.get('OS').catch(() => undefined)
  if (os === WINDOWS_OS) return 'windows'
  const kernel = await $.process.run(['uname', '-s'], { timeoutMs: PLATFORM_CHECK_TIMEOUT_MS }).catch(() => null)
  return kernel?.stdout.trim() === MAC_KERNEL ? 'mac' : 'other'
}
