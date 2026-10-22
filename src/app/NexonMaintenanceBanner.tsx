/**
 * 넥슨이 점검 중일 때 넥슨 데이터를 읽는 화면의 머리글 바로 아래에 서는 띠 한 줄. 점검이 아니면 아무것도 안 그린다.
 *
 * **점검은 이 띠로만 알린다.** 실패가 난 자리마다 문구를 두면 자리마다 모양이 달라 화면이 깨진다. 그래서 결산 줄
 * (`SettlementBanner`)과 같은 자리 · 같은 모양 · 같은 색이다. 둘이 함께 서면 결산 줄 아래에 선다.
 *
 * **누르는 자리가 둘이다.** `X` 는 닫고, 그 밖의 자리는 FAQ 시트를 연다. 다시 시도는 두지 않는다. 점검은 기다리는
 * 것 말고는 할 일이 없다. 닫으면 이번 점검 동안 모든 화면에서 내려간다(`features/nexon-maintenance/store`).
 *
 * @see docs/foundation/error-resilience.md 실패마다 하는 일
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text, WrenchIcon, XIcon } from '../components/atoms'
import { FaqSheet } from '../components/organisms/FaqSheet/FaqSheet'
import { MAINTENANCE_FAQ, MAINTENANCE_FAQ_TITLE } from '../features/nexon-maintenance/faq'
import { useNexonMaintenanceStore } from '../features/nexon-maintenance/store'

/** 16px 아이콘을 권장 타깃 44px 로 되돌린다. */
const CLOSE_HIT_SLOP = 14

const TITLE = {
  game: '메이플스토리 API 점검 중입니다.',
  api: '넥슨 Open API 점검 중입니다.',
} as const

export function NexonMaintenanceBanner(props: { testID: string }): React.JSX.Element | null {
  const scope = useNexonMaintenanceStore((state) => state.scope)
  const dismiss = useNexonMaintenanceStore((state) => state.dismiss)
  const [faqOpen, setFaqOpen] = useState(false)

  if (scope === null) return null

  return (
    <>
      <View testID={props.testID} className="flex-row items-center gap-2.5 bg-settlement-tint px-4 py-2.5">
        <WrenchIcon className="h-3.5 w-3.5 shrink-0 text-settlement-mark" strokeWidth={2} aria-hidden />

        <Pressable
          role="button"
          aria-label="점검이 무엇인지 보기"
          onPress={() => setFaqOpen(true)}
          className="shrink grow active:opacity-60"
        >
          <Text className="text-xs font-semibold text-settlement-ink">{TITLE[scope]}</Text>
          <Text className="text-11 text-settlement-ink-muted">
            점검이 끝날 때까지 마지막으로 불러온 정보를 보여 줍니다.
          </Text>
        </Pressable>

        <Pressable
          role="button"
          aria-label="점검 안내 닫기"
          hitSlop={CLOSE_HIT_SLOP}
          onPress={dismiss}
          className="shrink-0 active:opacity-60"
        >
          <XIcon className="h-4 w-4 text-settlement-ink-muted" strokeWidth={2} aria-hidden />
        </Pressable>
      </View>

      {faqOpen && (
        <FaqSheet title={MAINTENANCE_FAQ_TITLE} items={MAINTENANCE_FAQ} onClose={() => setFaqOpen(false)} />
      )}
    </>
  )
}
