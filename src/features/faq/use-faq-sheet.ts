/**
 * 화면이 여는 FAQ 묶음. 서버에서 문구가 바뀌어 `faqs` 칸이 덮이면 다시 그린다.
 *
 * @example
 * const faq = useFaqSheet('boss-manage')
 * <FaqButton sheet={faq} />
 */
import { useMemo } from 'react'

import { faqSheetOf, type FaqSheetKey } from '../../lib/faq/faqs'
import type { FaqSheetContent } from '../../types/faq'
import { useGameTable } from '../game-data/sync'

/** 묶음이 없거나 문항이 하나도 없으면 `null`. 입구는 그때 그리지 않는다. */
export function useFaqSheet(key: FaqSheetKey): FaqSheetContent | null {
  const table = useGameTable('faqs')
  return useMemo(() => faqSheetOf(table, key), [table, key])
}
