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
import { Pressable, View } from 'react-native'

import { CheckCircle2Icon, Text, XIcon } from '../../components/atoms'
import { FaqSheet } from '../../components/organisms/FaqSheet/FaqSheet'
import {
  MANUAL_COMPLETION_FAQ,
  MANUAL_COMPLETION_FAQ_TITLE,
} from '../../features/manual-completion/faq'
import { useManualCompletionStore } from '../../features/manual-completion/store'

/** 16px 아이콘을 권장 타깃 44px 로 되돌린다. 결산 줄의 닫기와 같은 값이다. */
const CLOSE_HIT_SLOP = 14

export function ManualCompletionBanner(): React.JSX.Element | null {
  const visible = useManualCompletionStore((state) => state.visible)
  const dismiss = useManualCompletionStore((state) => state.dismiss)
  const [faqOpen, setFaqOpen] = useState(false)

  if (!visible) return null

  return (
    <>
      <View
        testID="today-manual-completion-banner"
        className="flex-row items-center gap-2.5 bg-primary-tint px-4 py-2.5"
      >
        {/* 체크 동그라미인 이유는 이 줄이 말하는 것이 **할 수 있는 일**이기 때문이다. 경고
            삼각형은 고장으로 읽히고 시계는 기다리라는 뜻이 된다. */}
        <CheckCircle2Icon className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden />

        <Pressable
          role="button"
          aria-label="직접 완료가 무엇인지 보기"
          onPress={() => setFaqOpen(true)}
          className="shrink grow active:opacity-60"
        >
          {/* 문장 둘을 각자 한 줄에 둔다. 한 문단으로 흘리면 폭에 따라 접히는 자리가 달라져
              문장 가운데가 끊긴다. 첫 줄이 무슨 일이 있나이고 둘째 줄이 그래서 뭘 할 수 있나다. */}
          <Text className="text-xs font-semibold text-primary-ink">
            직접 완료할 수 있는 보스가 있어요.
          </Text>
          <Text className="text-11 text-text-muted">
            넥슨이 완료를 주지 않는 보스를 직접 기록할 수 있습니다.
          </Text>
        </Pressable>

        <Pressable
          role="button"
          aria-label="직접 완료 안내 닫기"
          hitSlop={CLOSE_HIT_SLOP}
          onPress={() => {
            // 실패는 삼킨다. 저장이 안 되면 다음에 켤 때 한 번 더 서고, 그것은 거짓이 아니라
            // 이미 읽은 안내를 다시 보는 일이다.
            void dismiss().catch(() => undefined)
          }}
          className="shrink-0 active:opacity-60"
        >
          <XIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
        </Pressable>
      </View>

      {faqOpen && (
        <FaqSheet
          title={MANUAL_COMPLETION_FAQ_TITLE}
          items={MANUAL_COMPLETION_FAQ}
          onClose={() => setFaqOpen(false)}
        />
      )}
    </>
  )
}
