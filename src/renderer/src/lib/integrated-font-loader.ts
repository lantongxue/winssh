import {
  formatIntegratedTerminalFontStack,
  formatIntegratedUiFontStack,
  getIntegratedFont,
  type IntegratedFontId
} from '@shared/integrated-fonts'
import sourceSans3LatinUrl from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url'
import sourceSans3LatinExtUrl from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-ext-wght-normal.woff2?url'
import interLatinUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import openSansLatinUrl from '@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2?url'
import openSansLatinExtUrl from '@fontsource-variable/open-sans/files/open-sans-latin-ext-wght-normal.woff2?url'
import sourceSansProLatinRegularUrl from '@fontsource/source-sans-pro/files/source-sans-pro-latin-400-normal.woff2?url'
import sourceSansProLatinBoldUrl from '@fontsource/source-sans-pro/files/source-sans-pro-latin-700-normal.woff2?url'
import sourceSansProLatinExtRegularUrl from '@fontsource/source-sans-pro/files/source-sans-pro-latin-ext-400-normal.woff2?url'
import sourceSansProLatinExtBoldUrl from '@fontsource/source-sans-pro/files/source-sans-pro-latin-ext-700-normal.woff2?url'
import jetBrainsMonoLatinUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'
import firaCodeLatinUrl from '@fontsource-variable/fira-code/files/fira-code-latin-wght-normal.woff2?url'
import firaCodeLatinExtUrl from '@fontsource-variable/fira-code/files/fira-code-latin-ext-wght-normal.woff2?url'
import robotoMonoLatinUrl from '@fontsource-variable/roboto-mono/files/roboto-mono-latin-wght-normal.woff2?url'
import robotoMonoLatinExtUrl from '@fontsource-variable/roboto-mono/files/roboto-mono-latin-ext-wght-normal.woff2?url'
import sourceCodeProLatinUrl from '@fontsource-variable/source-code-pro/files/source-code-pro-latin-wght-normal.woff2?url'
import sourceCodeProLatinExtUrl from '@fontsource-variable/source-code-pro/files/source-code-pro-latin-ext-wght-normal.woff2?url'
import cascadiaMonoLatinRegularUrl from '@fontsource/cascadia-mono/files/cascadia-mono-latin-400-normal.woff2?url'
import cascadiaMonoLatinBoldUrl from '@fontsource/cascadia-mono/files/cascadia-mono-latin-700-normal.woff2?url'
import cascadiaCodeLatinUrl from '@fontsource-variable/cascadia-code/files/cascadia-code-latin-wght-normal.woff2?url'
import cascadiaCodeLatinExtUrl from '@fontsource-variable/cascadia-code/files/cascadia-code-latin-ext-wght-normal.woff2?url'
import ibmPlexMonoLatinRegularUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url'
import ibmPlexMonoLatinBoldUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2?url'
import ubuntuMonoLatinRegularUrl from '@fontsource/ubuntu-mono/files/ubuntu-mono-latin-400-normal.woff2?url'
import ubuntuMonoLatinBoldUrl from '@fontsource/ubuntu-mono/files/ubuntu-mono-latin-700-normal.woff2?url'
import ubuntuMonoLatinExtRegularUrl from '@fontsource/ubuntu-mono/files/ubuntu-mono-latin-ext-400-normal.woff2?url'
import ubuntuMonoLatinExtBoldUrl from '@fontsource/ubuntu-mono/files/ubuntu-mono-latin-ext-700-normal.woff2?url'
import ubuntuSansMonoLatinUrl from '@fontsource-variable/ubuntu-sans-mono/files/ubuntu-sans-mono-latin-wght-normal.woff2?url'
import ubuntuSansMonoLatinExtUrl from '@fontsource-variable/ubuntu-sans-mono/files/ubuntu-sans-mono-latin-ext-wght-normal.woff2?url'
import ptMonoLatinUrl from '@fontsource/pt-mono/files/pt-mono-latin-400-normal.woff2?url'
import ptMonoLatinExtUrl from '@fontsource/pt-mono/files/pt-mono-latin-ext-400-normal.woff2?url'
import vt323LatinUrl from '@fontsource/vt323/files/vt323-latin-400-normal.woff2?url'

type FontFaceDescriptorInput = {
  family: string
  source: string
  descriptors?: FontFaceDescriptors
}

const loadedFontFaces = new Map<string, Promise<void>>()

const fontFaces: Record<IntegratedFontId, FontFaceDescriptorInput[]> = {
  'winssh-default': [
    {
      family: 'WinSSH UI Default',
      source: sourceSans3LatinUrl,
      descriptors: { style: 'normal', weight: '200 900' }
    },
    {
      family: 'WinSSH UI Default',
      source: sourceSans3LatinExtUrl,
      descriptors: { style: 'normal', weight: '200 900' }
    }
  ],
  inter: [
    {
      family: 'WinSSH UI Inter',
      source: interLatinUrl,
      descriptors: { style: 'normal', weight: '100 900' }
    }
  ],
  'open-sans': [
    {
      family: 'WinSSH UI Open Sans',
      source: openSansLatinUrl,
      descriptors: { style: 'normal', weight: '300 800' }
    },
    {
      family: 'WinSSH UI Open Sans',
      source: openSansLatinExtUrl,
      descriptors: { style: 'normal', weight: '300 800' }
    }
  ],
  'source-sans-pro': [
    {
      family: 'WinSSH UI Source Sans Pro',
      source: sourceSansProLatinRegularUrl,
      descriptors: { style: 'normal', weight: '400' }
    },
    {
      family: 'WinSSH UI Source Sans Pro',
      source: sourceSansProLatinBoldUrl,
      descriptors: { style: 'normal', weight: '700' }
    },
    {
      family: 'WinSSH UI Source Sans Pro',
      source: sourceSansProLatinExtRegularUrl,
      descriptors: { style: 'normal', weight: '400' }
    },
    {
      family: 'WinSSH UI Source Sans Pro',
      source: sourceSansProLatinExtBoldUrl,
      descriptors: { style: 'normal', weight: '700' }
    }
  ],
  'jetbrains-mono': [
    {
      family: 'WinSSH JetBrains Mono',
      source: jetBrainsMonoLatinUrl,
      descriptors: { style: 'normal', weight: '100 800' }
    }
  ],
  'fira-code': [
    {
      family: 'WinSSH Fira Code',
      source: firaCodeLatinUrl,
      descriptors: { style: 'normal', weight: '300 700' }
    },
    {
      family: 'WinSSH Fira Code',
      source: firaCodeLatinExtUrl,
      descriptors: { style: 'normal', weight: '300 700' }
    }
  ],
  'roboto-mono': [
    {
      family: 'WinSSH Roboto Mono',
      source: robotoMonoLatinUrl,
      descriptors: { style: 'normal', weight: '100 700' }
    },
    {
      family: 'WinSSH Roboto Mono',
      source: robotoMonoLatinExtUrl,
      descriptors: { style: 'normal', weight: '100 700' }
    }
  ],
  'source-code-pro': [
    {
      family: 'WinSSH Source Code Pro',
      source: sourceCodeProLatinUrl,
      descriptors: { style: 'normal', weight: '200 900' }
    },
    {
      family: 'WinSSH Source Code Pro',
      source: sourceCodeProLatinExtUrl,
      descriptors: { style: 'normal', weight: '200 900' }
    }
  ],
  'cascadia-mono': [
    {
      family: 'WinSSH Cascadia Mono',
      source: cascadiaMonoLatinRegularUrl,
      descriptors: { style: 'normal', weight: '400' }
    },
    {
      family: 'WinSSH Cascadia Mono',
      source: cascadiaMonoLatinBoldUrl,
      descriptors: { style: 'normal', weight: '700' }
    }
  ],
  'cascadia-code': [
    {
      family: 'WinSSH Cascadia Code',
      source: cascadiaCodeLatinUrl,
      descriptors: { style: 'normal', weight: '200 700' }
    },
    {
      family: 'WinSSH Cascadia Code',
      source: cascadiaCodeLatinExtUrl,
      descriptors: { style: 'normal', weight: '200 700' }
    }
  ],
  'ibm-plex-mono': [
    {
      family: 'WinSSH IBM Plex Mono',
      source: ibmPlexMonoLatinRegularUrl,
      descriptors: { style: 'normal', weight: '400' }
    },
    {
      family: 'WinSSH IBM Plex Mono',
      source: ibmPlexMonoLatinBoldUrl,
      descriptors: { style: 'normal', weight: '700' }
    }
  ],
  'ubuntu-mono': [
    {
      family: 'WinSSH Ubuntu Mono',
      source: ubuntuMonoLatinRegularUrl,
      descriptors: { style: 'normal', weight: '400' }
    },
    {
      family: 'WinSSH Ubuntu Mono',
      source: ubuntuMonoLatinBoldUrl,
      descriptors: { style: 'normal', weight: '700' }
    },
    {
      family: 'WinSSH Ubuntu Mono',
      source: ubuntuMonoLatinExtRegularUrl,
      descriptors: { style: 'normal', weight: '400' }
    },
    {
      family: 'WinSSH Ubuntu Mono',
      source: ubuntuMonoLatinExtBoldUrl,
      descriptors: { style: 'normal', weight: '700' }
    }
  ],
  'ubuntu-sans-mono': [
    {
      family: 'WinSSH Ubuntu Sans Mono',
      source: ubuntuSansMonoLatinUrl,
      descriptors: { style: 'normal', weight: '400 700' }
    },
    {
      family: 'WinSSH Ubuntu Sans Mono',
      source: ubuntuSansMonoLatinExtUrl,
      descriptors: { style: 'normal', weight: '400 700' }
    }
  ],
  'pt-mono': [
    {
      family: 'WinSSH PT Mono',
      source: ptMonoLatinUrl,
      descriptors: { style: 'normal', weight: '400' }
    },
    {
      family: 'WinSSH PT Mono',
      source: ptMonoLatinExtUrl,
      descriptors: { style: 'normal', weight: '400' }
    }
  ],
  vt323: [
    {
      family: 'WinSSH VT323',
      source: vt323LatinUrl,
      descriptors: { style: 'normal', weight: '400' }
    }
  ]
}

function getFontFaceKey(input: FontFaceDescriptorInput) {
  return JSON.stringify([
    input.family,
    input.source,
    input.descriptors?.style,
    input.descriptors?.weight
  ])
}

function getFontFaceSource(url: string) {
  return `url("${url.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
}

function loadFontFace(input: FontFaceDescriptorInput): Promise<void> {
  if (!canLoadIntegratedFonts()) {
    return Promise.resolve()
  }

  const key = getFontFaceKey(input)
  const existing = loadedFontFaces.get(key)
  if (existing) {
    return existing
  }

  const promise = new FontFace(input.family, getFontFaceSource(input.source), input.descriptors)
    .load()
    .then((fontFace) => {
      document.fonts.add(fontFace)
    })
    .catch((error: unknown) => {
      loadedFontFaces.delete(key)
      throw error
    })

  loadedFontFaces.set(key, promise)
  return promise
}

export function canLoadIntegratedFonts() {
  return (
    typeof FontFace !== 'undefined' && typeof document !== 'undefined' && Boolean(document.fonts)
  )
}

function loadFontFaces(inputs: FontFaceDescriptorInput[]) {
  return Promise.allSettled(inputs.map(loadFontFace)).then(() => undefined)
}

export function getUiFontStack(fontId: IntegratedFontId) {
  return formatIntegratedUiFontStack(fontId)
}

export function getTerminalFontStack(fontId: IntegratedFontId) {
  return formatIntegratedTerminalFontStack(fontId)
}

export function loadUiFontStack(fontId: IntegratedFontId): Promise<string> {
  const font = getIntegratedFont(fontId)
  return loadFontFaces(fontFaces[font.id] ?? []).then(() => getUiFontStack(font.id))
}

export function loadTerminalFontStack(fontId: IntegratedFontId): Promise<string> {
  const font = getIntegratedFont(fontId)
  return loadFontFaces(fontFaces[font.id] ?? []).then(() => getTerminalFontStack(font.id))
}
