/**
 * 서버가 직접 완료를 열어 둔 보스가 있을 때 today 에 서는 띠 한 줄. 없으면 아무것도 안 그린다.
 *
 * **결산 안내 줄과 같은 규격이고 색만 다르다.** 자리 · 치수 · 누르는 자리 둘(닫기와 FAQ)이 같다.
 * 색은 테마 토큰(`primary-tint` · `primary-ink`)을 쓴다. 결산 줄의 `settlement-*` 는 앱의 상태를
 * 말하는 전용 색이고, 이 줄은 **기능이 열렸다**는 말이라 기능의 색을 따른다.
 *
 * **기기 기록을 안 본다.** 서버 목록이 비어 있지 않으면 이미 다 잡은 사용자에게도 선다. 판정을 기기
 * 기록으로 좁히면 캐릭터마다 답이 달라 한 줄로 말할 수 없다.
 *
 * @see docs/features/today.md 직접 완료 안내 줄
 */
import { useState } from 'react'
import { CheckCircle2Icon } from '../../components/atoms'
import { InfoStrip } from '../../components/molecules/InfoStrip/InfoStrip'
import { FaqSheet } from '../../components/organisms/FaqSheet/FaqSheet'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { useManualCompletionBanner } from '../../features/manual-completion/query'

export function ManualCompletionBanner(): React.JSX.Element | null {
  const { visible, dismiss } = useManualCompletionBanner()
  const [faqOpen, setFaqOpen] = useState(false)
  const faq = useFaqSheet('manual-completion')

  if (!visible) return null

  return (
    <>
      <InfoStrip
        testID="today-manual-completion-banner"
        tone="primary"
        // 체크 동그라미인 이유는 이 줄이 말하는 것이 할 수 있는 일이기 때문이다. 경고 삼각형은 고장으로 읽히고 시계는
        // 기다리라는 뜻이 된다.
        icon={CheckCircle2Icon}
        title="직접 완료할 수 있는 보스가 있어요."
        detail="넥슨이 완료를 주지 않는 보스를 직접 기록할 수 있습니다."
        infoLabel="직접 완료가 무엇인지 보기"
        onPressInfo={() => setFaqOpen(true)}
        infoDisabled={faq === null}
        closeLabel="직접 완료 안내 닫기"
        // 실패는 삼킨다. 저장이 안 되면 다음에 켤 때 한 번 더 서고, 그것은 거짓이 아니라 이미 읽은 안내를 다시 보는 일이다.
        onClose={() => void dismiss().catch(() => undefined)}
      />

      {faqOpen && faq !== null && (
        <FaqSheet title={faq.title} items={faq.items} onClose={() => setFaqOpen(false)} />
      )}
    </>
  )
}
