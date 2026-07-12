export const STORAGE_KEYS = {
  apiKey: 'apiKey',
  selectedAccountId: 'selectedAccountId',
} as const

export function schedulerCacheKey(ocid: string): string {
  return `schedulerCache:${ocid}`
}

export function characterBasicCacheKey(ocid: string): string {
  return `characterBasicCache:${ocid}`
}

export function characterBasicCacheIndexKey(): string {
  return 'characterBasicCache:index'
}

export function trackedCharactersKey(kind: 'content' | 'boss'): string {
  return `trackedCharacters:${kind}`
}

export function lastSelectedCharacterKey(kind: 'content' | 'boss'): string {
  return `lastSelectedCharacter:${kind}`
}
