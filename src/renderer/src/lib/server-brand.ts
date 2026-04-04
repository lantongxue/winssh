import {
  DEFAULT_SERVER_BRAND_ID,
  type ServerBrandId,
  type ServerIconMimeType
} from '@shared/server-brands'

export function resolveServerBrandId(brandId: ServerBrandId | null | undefined): ServerBrandId {
  return brandId ?? DEFAULT_SERVER_BRAND_ID
}

export function bytesToDataUrl(mimeType: ServerIconMimeType, data: Uint8Array): string {
  let binary = ''

  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }

  return `data:${mimeType};base64,${btoa(binary)}`
}
