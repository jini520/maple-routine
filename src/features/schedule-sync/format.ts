import type { ScheduleSyncError } from './schedule-sync'

export function formatScheduleSyncError(error: ScheduleSyncError): string {
  switch (error.kind) {
    case 'invalidApiKey':
      return 'API 키가 유효하지 않습니다'
    case 'rateLimited':
      return '잠시 후 다시 시도해주세요'
    case 'network':
      return '네트워크 오류가 발생했습니다'
  }
}

export function formatSyncedAt(syncedAt: string | null): string {
  if (syncedAt === null) {
    return '동기화 기록 없음'
  }

  const diffMinutes = Math.floor((Date.now() - new Date(syncedAt).getTime()) / (60 * 1000))

  if (diffMinutes < 1) {
    return '방금 전'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`
  }
  return `${Math.floor(diffMinutes / 60)}시간 전`
}
