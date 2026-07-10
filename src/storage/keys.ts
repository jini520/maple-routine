export const STORAGE_KEYS = {
  apiKey: 'apiKey',
  selectedAccountId: 'selectedAccountId',
} as const

export function schedulerCacheKey(ocid: string): string {
  return `schedulerCache:${ocid}`
}

export function trackedCharactersKey(kind: 'content' | 'boss'): string {
  return `trackedCharacters:${kind}`
}
