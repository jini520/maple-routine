/**
 * 저장된 API 키가 429 를 받았을 때 띄우는 다시 시도 모달. 키를 지우지 않는다.
 *
 * 서비스 단계 키도 같은 키를 여러 기기나 다른 도구에서 함께 쓰면 잠깐 한도에 닿는다. 한 번의 429 로 키를 지우면 사용자가 멀쩡한
 * 키를 다시 넣어야 해서, 다시 부를지 다른 키를 넣을지 사용자가 고르게 한다.
 *
 * 다른 모달에 이미 있는 부품만 쓴다. 칸 둘은 `ApiKeyWarningModal` 의 칸이고, 칸 아래 오른쪽 링크는 `ApiKeyForm` 입력칸 위의 링크다.
 * 발급 링크를 맨 아래 버튼 줄에 두지 않는 것은 맨 아래에 이 모달에서 고를 동작 둘만 두기 위해서다.
 *
 * 닫을 수 없다. 오버레이와 안드로이드 뒤로가기로 닫히지 않고, 두 버튼 가운데 하나를 고른다.
 */
import { Pressable, View } from 'react-native'

import { ExternalLinkIcon, GaugeIcon, KeyRoundIcon, Text } from '../../components/atoms'
import { INSET_ROW_CLASS } from '../../components/molecules/InsetRow/InsetRow'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { keepWords } from '../../lib/keep-words'
import { openInAppBrowser } from '../../native/browser'
import { GUIDE_URL } from './api-key-links'

export function RateLimitNoticeModal(props: {
  /** 같은 키로 연달아 받은 429 의 차례(1부터) */
  attempt: number
  /** `다른 키 입력` 을 둘지. 저장된 키가 아니라 어느 계정인지 모르면 다시 시도만 둔다 */
  canEnterOtherKey: boolean
  onRetry: () => void
  onEnterOtherKey: () => void
}): React.JSX.Element {
  const retry = { label: '다시 시도', onPress: props.onRetry }
  const otherKey = { label: '다른 키 입력', onPress: props.onEnterOtherKey }
  // 첫 429 는 잠깐 몰린 것일 수 있어 다시 부르기가 앞이다. 다시 불러도 429 면 하루 한도에 걸린 개발 단계 키일 가능성이 크다.
  const otherKeyFirst = props.canEnterOtherKey && props.attempt >= 2

  return (
    <NoticeModal
      icon={GaugeIcon}
      tone="error"
      title="호출 한도를 초과했습니다"
      content={
        <View className="gap-1.5">
          <View className={`flex-row items-center gap-2.5 ${INSET_ROW_CLASS}`}>
            <KeyRoundIcon className="h-[18px] w-[18px] text-error-ink" strokeWidth={1.75} aria-hidden />
            <Text className="flex-1 text-sm text-text">{keepWords('서비스 단계 키인지 확인해주세요')}</Text>
          </View>
          <View className={INSET_ROW_CLASS}>
            <Text className="text-sm text-text-muted">
              {keepWords('개발 단계 키라면 넥슨 오픈 API에서 ‘서비스 단계’ 키를 새로 발급받아 입력해주세요.')}
            </Text>
          </View>
          <Pressable
            role="link"
            onPress={() => openInAppBrowser(GUIDE_URL)}
            className="flex-row items-center gap-1 self-end px-0.5 py-0.5"
          >
            <Text className="text-xs font-semibold text-primary-ink">API 키 발급 방법 보기</Text>
            <ExternalLinkIcon className="h-3 w-3 text-primary-ink" aria-hidden />
          </Pressable>
        </View>
      }
      action={otherKeyFirst ? otherKey : retry}
      secondaryAction={!props.canEnterOtherKey ? undefined : otherKeyFirst ? retry : otherKey}
      onClose={() => {}}
      testId="rate-limit-notice"
    />
  )
}
