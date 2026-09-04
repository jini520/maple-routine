/**
 * 막고 알리는 모달의 골격. 배지 · 제목 · 내용 · 설명 · 주 버튼 · 링크의 자리와 값을 갖는다.
 *
 * 호출부는 무엇을 넣을지만 정한다. 골격이 문장으로만 있고 코드에 없던 동안 값이 이미 갈렸다
 * (아이콘 굵기 1.7 대 1.75 · 설명 `text-xs` 대 `text-sm`). 두 모달이 한 앱에서 온 것으로 읽히려면
 * 그 값이 한곳에 있어야 한다. 모은 값은 굵기 1.75 · 설명 `text-xs` 다.
 *
 * **닫을 수 있는가는 이 파일이 안 본다.** `onClose` 가 정한다. 뒤 화면이 이미 제 기능을 못 하는
 * 모달은 no-op 을 넘겨 못 닫는 채로 남고, 뒤에 폼이 서 있는 모달은 확인과 같은 핸들러를 넘긴다.
 *
 * 버튼이 둘인 확인 대화상자는 이 틀이 아니다. 아이콘 배지가 없고 제목이 왼쪽 정렬이며 취소가
 * 있어서, 덮으면 `action` 이 배열이 되고 `tone` 이 정렬까지 정하게 된다. 그쪽은 `Modal.Card` 를
 * 직접 쓴다.
 *
 * @example
 * <NoticeModal
 *   icon={KeyRoundIcon}
 *   tone="primary"
 *   title="이 키로는 연결할 수 없습니다"
 *   content={<단계표 />}
 *   description="…"
 *   action={{ label: '다시 입력하기', onPress: acknowledge }}
 *   link={{ label: '발급 방법 자세히 보기', onPress: () => void Linking.openURL(GUIDE_URL) }}
 *   onClose={acknowledge}
 *   testId="development-stage-key-overlay"
 * />
 */
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { Button, ExternalLinkIcon, Text } from '../../atoms'
import { Modal } from '../Modal/Modal'

/** 배지에 드는 아이콘. lucide 와 커스텀 아이콘이 함께 통하는 프롭만 받는다. */
type NoticeIcon = React.ComponentType<{
  className?: string
  strokeWidth?: number
  'aria-hidden'?: boolean
}>

/**
 * 배지의 색과 모양. **하나가 둘을 함께 정한다.**
 *
 * 따로 받으면 붉은 네모 같은 조합이 만들어진다. 원과 네모를 가른 근거가 색과 같아서다. `error` 는
 * 실패한 곳이고 `primary` 는 종류가 다른 것을 넣은 곳이다. 네모인 쪽은 아래 `content` 가 표일 때
 * 모서리가 맞는다.
 */
const TONE = {
  primary: { badge: 'rounded-[16px] bg-primary-tint', ink: 'text-primary-ink' },
  error: { badge: 'rounded-full bg-error-tint', ink: 'text-error-ink' },
} as const

export interface NoticeModalProps {
  icon: NoticeIcon
  tone: keyof typeof TONE
  title: string
  /** 제목과 설명 사이의 자유 영역. 개발 단계 키 모달의 두 줄 표가 이 자리다. */
  content?: ReactNode
  description?: string
  /** 전폭 주 버튼. 알림 모달에는 반드시 하나 있다. */
  action: { label: string; onPress: () => void }
  /** 주 버튼 아래 인라인 링크. 앱 밖으로 나가는 도움말이 여기 선다. */
  link?: { label: string; onPress: () => void }
  onClose: () => void
  /**
   * 오버레이의 testID. 안쪽 조각들이 여기서 파생한다(`-badge` · `-content` · `-description` ·
   * `-link`). `Modal` 이 창 자체에 `-modal` 을 붙인다.
   */
  testId: string
  /** 제목에 다는 별도 손잡이. 화면 테스트가 이것으로 모달이 떴는지 본다. */
  titleTestId?: string
}

export function NoticeModal(props: NoticeModalProps): React.JSX.Element {
  const { icon: Icon, testId } = props
  const tone = TONE[props.tone]

  return (
    // 입력이 없어 키보드를 안 띄우므로 중앙 정렬이다.
    <Modal onClose={props.onClose} testId={testId} align="center">
      <Modal.Card maxWidth="max-w-xs">
        <View className="gap-5">
          {/* 배지와 제목은 한 묶음이다. 둘 사이가 `gap-5` 로 벌어지면 머리가 두 덩어리로 읽힌다. */}
          <View className="items-center gap-3">
            <View
              testID={`${testId}-badge`}
              className={`h-14 w-14 items-center justify-center ${tone.badge}`}
            >
              <Icon
                className={`h-7 w-7 ${tone.ink}`}
                strokeWidth={1.75}
                aria-hidden
              />
            </View>
            <Text
              testID={props.titleTestId}
              className="text-center text-base font-semibold leading-snug text-text"
            >
              {props.title}
            </Text>
          </View>

          {props.content !== undefined && <View testID={`${testId}-content`}>{props.content}</View>}

          {props.description !== undefined && (
            <Text testID={`${testId}-description`} className="text-center text-xs text-text-muted">
              {props.description}
            </Text>
          )}

          {/* 링크는 알약 아래여야 한다. 설명 바로 밑에 두면 작은 글자 둘이 한 문단으로 뭉쳐
              누를 수 있는 것으로 안 보인다. 버튼이 사이에 서서 그 둘을 갈라 준다. */}
          <View className="items-center gap-3">
            <Button
              variant="primary"
              onPress={props.action.onPress}
              className="w-full items-center"
              textClassName="text-sm"
            >
              {props.action.label}
            </Button>
            {props.link !== undefined && (
              <Pressable
                testID={`${testId}-link`}
                role="link"
                onPress={props.link.onPress}
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs text-primary-ink">{props.link.label}</Text>
                <ExternalLinkIcon className="h-3 w-3 text-primary-ink" aria-hidden />
              </Pressable>
            )}
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}
