import appPackage from '../../../package.json'

export const APP_VERSION: string = appPackage.version
export const REPOSITORY_URL: string = appPackage.homepage

export type Platform = 'windows' | 'macos' | 'linux'

export interface DownloadAsset {
  label: string
  format: string
  url: string
}

export interface PlatformDownload {
  platform: Platform
  assets: DownloadAsset[]
}

const releasesBase = `${REPOSITORY_URL}/releases/latest`

export const DOWNLOADS: PlatformDownload[] = [
  {
    platform: 'windows',
    assets: [
      { label: 'Installer', format: 'NSIS .exe', url: releasesBase },
      { label: 'Portable', format: 'ZIP', url: releasesBase }
    ]
  },
  {
    platform: 'macos',
    assets: [
      { label: 'Disk Image', format: 'DMG', url: releasesBase },
      { label: 'Archive', format: 'ZIP', url: releasesBase }
    ]
  },
  {
    platform: 'linux',
    assets: [
      { label: 'AppImage', format: 'AppImage', url: releasesBase },
      { label: 'Debian Package', format: 'DEB', url: releasesBase }
    ]
  }
]
