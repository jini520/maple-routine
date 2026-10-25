/**
 * today 빠른 이동의 화면 목록과 구성을 바꾸는 순수 함수.
 *
 * 화면마다 어느 라우트로 가는지와 아이콘은 여기 없다. 그것은 내비게이션과 그림을 아는 `app/today` 몫이다.
 */
import type { QuickLinkId, QuickLinkRows, QuickLinksConfig } from '../../types/quick-links'

/** 한 줄의 칸 수 */
export const QUICK_LINKS_PER_ROW = 5

export interface QuickLinkName {
  /** 편집 시트 · 접근성 이름에 쓰는 전체 이름 */
  name: string
  /** 위젯 칸 아래 이름. 칸 폭이 60px 안팎이라 9px 로 한 줄에 들어가는 길이 */
  short: string
}

export const QUICK_LINK_NAMES: Readonly<Record<QuickLinkId, QuickLinkName>> = {
  appointments: { name: '파티 스케줄', short: '파티 스케줄' },
  content: { name: '컨텐츠', short: '컨텐츠' },
  boss: { name: '보스', short: '보스' },
  profit: { name: '보스 수입', short: '보스 수입' },
  cashbook: { name: '가계부', short: '가계부' },
  stats: { name: '통계', short: '통계' },
  utility: { name: '유틸리티', short: '유틸리티' },
  'boss-manage': { name: '보스 관리', short: '보스 관리' },
  characters: { name: '캐릭터 관리', short: '캐릭터 관리' },
  'item-split': { name: '판매 분배금 계산기', short: '분배금 계산' },
  'boss-profit-calculator': { name: '주간 보스 수입 계산기', short: '보스 계산기' },
  'mvp-grade': { name: 'MVP 등급', short: 'MVP 등급' },
  notices: { name: '공지 목록', short: '공지' },
  'notice-alerts': { name: '알림 설정', short: '알림 설정' },
  'app-settings': { name: '설정', short: '설정' },
}

export interface QuickLinkGroup {
  label: string
  ids: readonly QuickLinkId[]
}

/** 편집 시트 본문의 카드 차례 */
export const QUICK_LINK_GROUPS: readonly QuickLinkGroup[] = [
  { label: '탭', ids: ['appointments', 'content', 'boss', 'profit', 'cashbook', 'stats', 'utility'] },
  { label: '관리', ids: ['boss-manage', 'characters'] },
  { label: '유틸리티 도구', ids: ['item-split', 'boss-profit-calculator'] },
  { label: '더보기', ids: ['mvp-grade', 'notices', 'notice-alerts', 'app-settings'] },
]

export const DEFAULT_QUICK_LINKS: QuickLinksConfig = {
  rows: 1,
  ids: ['profit', 'stats', 'boss-manage', 'item-split', 'app-settings'],
}

export function capacityOf(rows: QuickLinkRows): number {
  return rows * QUICK_LINKS_PER_ROW
}

function isQuickLinkId(value: unknown): value is QuickLinkId {
  return typeof value === 'string' && Object.hasOwn(QUICK_LINK_NAMES, value)
}

/**
 * 저장된 값을 위젯이 그릴 수 있는 구성으로 읽는 함수. 그릴 것이 없으면 `null` 이고 스토어가 기본 구성으로 바꾼다.
 *
 * 모르는 id 는 버린다. 목록에서 화면을 뺀 버전으로 올라온 사용자의 칸이 갈 곳 없이 남지 않게.
 */
export function parseQuickLinks(raw: unknown): QuickLinksConfig | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { rows, ids } = raw as { rows?: unknown; ids?: unknown }
  if ((rows !== 1 && rows !== 2) || !Array.isArray(ids)) return null

  const kept = [...new Set(ids.filter(isQuickLinkId))].slice(0, capacityOf(rows))
  return kept.length === 0 ? null : { rows, ids: kept }
}

/** 줄 수를 바꾸는 함수. 줄이면 트레이 차례로 넘치는 칸을 뺀다 */
export function withRows(config: QuickLinksConfig, rows: QuickLinkRows): QuickLinksConfig {
  return { rows, ids: config.ids.slice(0, capacityOf(rows)) }
}

/** 본문 타일을 누른 결과. 칸이 다 찼는데 새 화면을 누르면 받은 구성을 그대로 돌려준다 */
export function toggleQuickLink(config: QuickLinksConfig, id: QuickLinkId): QuickLinksConfig {
  if (config.ids.includes(id)) return { ...config, ids: config.ids.filter((one) => one !== id) }
  if (config.ids.length >= capacityOf(config.rows)) return config
  return { ...config, ids: [...config.ids, id] }
}
