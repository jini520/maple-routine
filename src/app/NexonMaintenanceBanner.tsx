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
import { WrenchIcon } from '../components/atoms'
import { InfoStrip } from '../components/molecules/InfoStrip/InfoStrip'
import { FaqSheet } from '../components/organisms/FaqSheet/FaqSheet'
import { useFaqSheet } from '../features/faq/use-faq-sheet'
import { useNexonMaintenanceStore } from '../features/nexon-maintenance/store'

const TITLE = {
  game: '메이플스토리 API 점검 중입니다.',
  api: '넥슨 Open API 점검 중입니다.',
} as const

export function NexonMaintenanceBanner(props: { testID: string }): React.JSX.Element | null {
  const scope = useNexonMaintenanceStore((state) => state.scope)
  const dismiss = useNexonMaintenanceStore((state) => state.dismiss)
  const [faqOpen, setFaqOpen] = useState(false)
  const faq = useFaqSheet('nexon-maintenance')

  if (scope === null) return null

  return (
    <>
      <InfoStrip
        testID={props.testID}
        tone="settlement"
        icon={WrenchIcon}
        title={TITLE[scope]}
        detail="점검이 끝날 때까지 마지막으로 불러온 정보를 보여 줍니다."
        infoLabel="점검이 무엇인지 보기"
        onPressInfo={() => setFaqOpen(true)}
        infoDisabled={faq === null}
        closeLabel="점검 안내 닫기"
        onClose={dismiss}
      />

      {faqOpen && faq !== null && (
        <FaqSheet title={faq.title} items={faq.items} onClose={() => setFaqOpen(false)} />
      )}
    </>
  )
}
