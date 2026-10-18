/**
 * 넥슨이 결산 중일 때 today 맨 위에 서는 띠 한 줄. 결산 중이 아니면 아무것도 안 그린다.
 *
 * **카드가 아니다.** 모서리도 그림자도 테두리도 없다. 바로 아래 `NoticeBanner` 가 카드라, 둘이
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
import { Pressable, View } from 'react-native'

import { ClockIcon, Text, XIcon } from '../../components/atoms'
import { FaqSheet } from '../../components/organisms/FaqSheet/FaqSheet'
import { SETTLEMENT_FAQ, SETTLEMENT_FAQ_TITLE } from '../../features/settlement/faq'
import { useSettlementStore } from '../../features/settlement/store'

/** 16px 아이콘을 권장 타깃 44px 로 되돌린다. 나란히 선 것이 없어 네 면 다 준다. */
const CLOSE_HIT_SLOP = 14

export function SettlementBanner(): React.JSX.Element | null {
  const visible = useSettlementStore((state) => state.visible)
  const dismiss = useSettlementStore((state) => state.dismiss)
  const [faqOpen, setFaqOpen] = useState(false)

  if (!visible) return null

  return (
    <>
      <View
        testID="today-settlement-banner"
        className="flex-row items-center gap-2.5 bg-settlement-tint px-4 py-2.5"
      >
        {/* 시계인 이유는 결산이 오류가 아니라 시간이 지나면 끝나는 상태이기 때문이다. 경고
            삼각형은 실제보다 세게 말하고, 새로고침은 탭하면 재조회한다는 뜻이 된다.

            글자와 다른 색이라야 표식이 된다. 같은 색이면 글자 덩어리에 붙어 보인다. */}
        <ClockIcon className="h-3.5 w-3.5 shrink-0 text-settlement-mark" strokeWidth={2} aria-hidden />

        <Pressable
          role="button"
          aria-label="결산이 무엇인지 보기"
          onPress={() => setFaqOpen(true)}
          className="shrink grow active:opacity-60"
        >
          <Text className="text-xs font-semibold text-settlement-ink">
            스케줄러 데이터를 결산 중입니다.
          </Text>
          <Text className="text-11 text-settlement-ink-muted">
            일부 데이터가 갱신되지 않을 수 있습니다.
          </Text>
        </Pressable>

        <Pressable
          role="button"
          aria-label="결산 안내 닫기"
          hitSlop={CLOSE_HIT_SLOP}
          onPress={() => {
            // 실패는 삼킨다. 저장이 안 되면 다음에 켤 때 한 번 더 서고, 그것은 거짓이 아니라
            // 이미 읽은 안내를 다시 보는 일이다.
            void dismiss().catch(() => undefined)
          }}
          className="shrink-0 active:opacity-60"
        >
          <XIcon className="h-4 w-4 text-settlement-ink-muted" strokeWidth={2} aria-hidden />
        </Pressable>
      </View>

      {faqOpen && (
        <FaqSheet
          title={SETTLEMENT_FAQ_TITLE}
          items={SETTLEMENT_FAQ}
          onClose={() => setFaqOpen(false)}
        />
      )}
    </>
  )
}
