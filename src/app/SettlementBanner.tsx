/**
 * 넥슨이 결산 중일 때 today · 가계부 · 통계의 머리글 바로 아래에 서는 띠 한 줄. 결산 중이 아니면 아무것도
 * 안 그린다. 세 화면이 같은 스토어를 보고 닫기도 같은 열쇠(이번 결산의 시작 시각)라, 한 화면에서 닫으면 셋 다
 * 그 결산 동안 안 선다. 둘째 줄만 화면이 준다. 그 화면에서 실제로 빠지는 것을 말하기 위해서다.
 *
 * **카드가 아니다.** 모서리도 그림자도 테두리도 없다. today 에서 바로 아래 `NoticeBanner` 가 카드라, 둘이
 * 붙어 서도 무엇이 무엇인지 갈린다. 안쪽 좌우 16 은 그 배너와 같은 값이라 격자까지 왼쪽 선이
 * 한 줄로 맞는다.
 *
 * **색이 테마를 안 따라간다.** 라이트/다크 두 벌 상수다(`theme-vars.ts` 의
 * `resolveSettlementColors`). 테마 토큰을 쓰면 이 줄의 정체가 테마 수만큼 갈리고, 실제로 먼저 쓰던
 * `info-tint` 는 어두운 테마에서 바탕과 거의 안 갈렸다.
 *
 * **문장 둘을 각자 한 줄에 두고 위아래를 준다.** 첫 줄이 무슨 일이 일어나는 중인가이고 둘째 줄이
 * 그래서 어떻게 되는가다. 같은 무게로 두면 둘 다 안 읽힌다. 한 문단으로 흘리지 않는 것은 폭에 따라
 * 접히는 자리가 달라져 문장 가운데가 끊기기 때문이다.
 *
 * **누르는 자리가 둘이다.** `X` 는 이번 결산 동안 줄을 닫고, 그 밖의 자리는 FAQ 시트를 연다.
 * 재조회로 두지 않는 것은 결산 중에는 같은 값이 다시 와서 앱이 고장 난 것으로 읽히기 때문이다.
 *
 * @see docs/features/today.md 결산 안내 줄
 */
import { useState } from 'react'
import { ClockIcon } from '../components/atoms'
import { InfoStrip } from '../components/molecules/InfoStrip/InfoStrip'
import { FaqSheet } from '../components/organisms/FaqSheet/FaqSheet'
import { SETTLEMENT_BANNER_TITLE } from '../features/settlement/banner-text'
import { useFaqSheet } from '../features/faq/use-faq-sheet'
import { useSettlementBanner } from '../features/settlement/query'

export function SettlementBanner(props: {
  testID: string
  /** 둘째 줄. 그 화면에서 결산 중에 무엇이 빠지는지를 말한다(`features/settlement/banner-text`). */
  detail: string
}): React.JSX.Element | null {
  const { visible, dismiss } = useSettlementBanner()
  const [faqOpen, setFaqOpen] = useState(false)
  const faq = useFaqSheet('settlement')

  if (!visible) return null

  return (
    <>
      <InfoStrip
        testID={props.testID}
        tone="settlement"
        // 시계인 이유는 결산이 오류가 아니라 시간이 지나면 끝나는 상태이기 때문이다. 경고 삼각형은 실제보다 세게 말하고,
        // 새로고침은 탭하면 재조회한다는 뜻이 된다.
        icon={ClockIcon}
        title={SETTLEMENT_BANNER_TITLE}
        detail={props.detail}
        infoLabel="결산이 무엇인지 보기"
        onPressInfo={() => setFaqOpen(true)}
        infoDisabled={faq === null}
        closeLabel="결산 안내 닫기"
        // 실패는 삼킨다. 저장이 안 되면 다음에 켤 때 한 번 더 서고, 그것은 거짓이 아니라 이미 읽은 안내를 다시 보는 일이다.
        onClose={() => void dismiss().catch(() => undefined)}
      />

      {faqOpen && faq !== null && (
        <FaqSheet title={faq.title} items={faq.items} onClose={() => setFaqOpen(false)} />
      )}
    </>
  )
}
