import type { AppInfo, ReleaseChannel } from '@shared/types'

export function getReleaseChannel(version: string): ReleaseChannel {
  if (version.includes('-alpha')) {
    return 'alpha'
  }

  if (version.includes('-beta')) {
    return 'beta'
  }

  return 'latest'
}

export function createAppInfo(input: {
  name: string
  platform: string
  version: string
}): AppInfo {
  return {
    name: input.name,
    platform: input.platform,
    releaseChannel: getReleaseChannel(input.version),
    version: input.version
  }
}
