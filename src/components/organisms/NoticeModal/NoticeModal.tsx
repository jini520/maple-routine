/**
 * 배지를 이고 서는 모달의 골격. 영역 여섯의 자리와 값을 갖는다.
 *
 * ```
 * [배지]        h-14 w-14 · 아이콘 h-7 w-7 · strokeWidth 1.75
 *   ↕ 12
 * 제목          text-base font-semibold · 가운데
 *   ↕ 8        여기부터 셋이 한 덩어리다. 내용은 제목에 딸린 것이라 붙어 있어야 한다
 * 내용          자유 영역. 버전 배지 줄 · 단계 표
 *   ↕ 8
 * 설명          text-xs text-text-muted · 가운데
 *   ↕ 20
 * [옵션]        머리 밖의 자유 블록. 콜아웃 · 펼침판
 *   ↕ 20
 * [주 버튼]     전폭. **되돌릴 수 없는 확인에서는 이 자리가 `취소` 다**
 *   ↕ 4        부 버튼일 때. 링크는 12
 * [부 버튼 또는 링크]   `danger` 는 크기가 같고 글자색만 error
 * ```
 *
 * 호출부는 무엇을 넣을지만 정하고 자리와 간격은 못 바꾼다. 골격이 문장으로만 있고 코드에 없던
 * 동안 값이 이미 갈렸다. 아이콘 굵기 1.7 대 1.75 · 설명 `text-xs` 대 `text-sm` · 묶는 폭 8 대 20.
 *
 * **닫을 수 있는가는 이 파일이 안 본다.** `onClose` 가 정한다. 뒤 화면이 이미 제 기능을 못 하는
 * 모달은 no-op 을 넘겨 못 닫는 채로 남는다.
 *
 * **배지도 버튼도 없는 상태는 이 틀이 아니다.** 진행률·대기 화면(`UpdatePromptModal` 의
 * `downloading`·`applying`)이 그렇다. `action` 이 필수라 애초에 안 들어온다. 버튼이 둘인 확인
 * 대화상자(`DisconnectConfirm`·`CacheClearConfirm`)도 아니다. 아이콘 배지가 없고 제목이 왼쪽
 * 정렬이라, 덮으면 `tone` 이 정렬까지 정하게 된다.
 *
 * @example
 * <NoticeModal
 *   icon={StoreIcon}
 *   tone="third"
 *   title="스토어 업데이트가 필요해요"
 *   content={<VersionBadge version={availableVersion} />}
 *   description="이 업데이트는 앱 스토어에서 업데이트해야 받을 수 있어요."
 *   option={<InfoNote>최소 앱 버전 1.2.0 이상 필요</InfoNote>}
 *   action={{ label: '스토어로 이동', onPress: openStore }}
 *   secondaryAction={{ label: '나중에', onPress: dismiss }}
 *   onClose={dismiss}
 *   testId="update-prompt-overlay"
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

/** 배지 색. 아이콘 색이 상속되지 않아 배경과 글자색을 갈라 둔다(`Svg` 의 `color` 로 내려간다). */
const TONE = {
  primary: { bg: 'bg-primary-tint', ink: 'text-primary-ink' },
  secondary: { bg: 'bg-secondary-tint', ink: 'text-secondary-ink' },
  third: { bg: 'bg-third-tint', ink: 'text-third-ink' },
  error: { bg: 'bg-error-tint', ink: 'text-error-ink' },
} as const

/**
 * 배지 모양. **색과 따로 받는다.**
 *
 * 모양을 가르는 것은 톤이 아니라 바로 아래 무엇이 오는가다. 네모는 아래 `content` 가 표일 때
 * 모서리를 맞추려는 것이고, 그 외에는 원이다.
 */
const SHAPE = {
  circle: 'rounded-full',
  square: 'rounded-[16px]',
} as const

/** 버튼 하나. `busy` 는 라벨을 가리고 스피너를 겹쳐 그린다. 못 누르게 하는 것은 `disabled` 다. */
interface NoticeAction {
  label: string
  onPress: () => void
  busy?: boolean
  disabled?: boolean
}

export interface NoticeModalProps {
  icon: NoticeIcon
  tone: keyof typeof TONE
  /** 기본 `circle`. 아래 `content` 가 표라서 모서리를 맞춰야 할 때만 `square`. */
  badgeShape?: keyof typeof SHAPE
  title: string
  /** 제목에 **딸린** 부가. 버전 배지 줄 · 단계 표. 제목과 8 만 떨어진다. */
  content?: ReactNode
  description?: string
  /** 머리 묶음 **밖**, 버튼 **위**의 자유 블록. 콜아웃 · 펼침판. */
  option?: ReactNode
  /**
   * 전폭 주 버튼. 이 틀에는 반드시 하나 있다.
   *
   * **되돌릴 수 없는 확인에서는 이 자리가 `취소` 다.** 안전한 기본값이 무르는 쪽이고 채운 알약이
   * 그것을 가리켜야 한다. 파괴 동작은 아래 `secondaryAction` 에 `danger` 로 내린다.
   */
  action: NoticeAction
  /**
   * 주 버튼 아래 두 번째 버튼. `나중에` · `취소` · 파괴 동작 자리.
   *
   * `danger` 는 **크기를 안 바꾸고 글자색만** `error` 로 만든다(사용자 지정). 되돌릴 수 없는
   * 동작이 주 버튼보다 커 보이면 안 되고, 위험하다는 신호는 색 하나로 충분하다. 테두리를 두르면
   * 그것대로 눈길을 끌어 취소와 비중이 붙는다.
   */
  secondaryAction?: NoticeAction & { danger?: boolean }
  /** 주 버튼 아래 인라인 링크. 앱 밖으로 나가는 도움말이 여기 선다. */
  link?: { label: string; onPress: () => void }
  onClose: () => void
  /**
   * 오버레이의 testID. 안쪽 조각들이 여기서 파생한다(`-badge` · `-body` · `-content` ·
   * `-description` · `-option` · `-link`). `Modal` 이 창 자체에 `-modal` 을 붙인다.
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
      {/* 부 버튼이 있으면 아래 패딩을 줄인다. 그 버튼이 주 버튼보다 작아(`py-1.5`) 아래 여백이
          상대적으로 커 보인다. */}
      <Modal.Card maxWidth="max-w-xs" tight={props.secondaryAction !== undefined}>
        <View className="gap-5">
          <View className="items-center gap-3">
            <View
              testID={`${testId}-badge`}
              className={`h-14 w-14 items-center justify-center ${
                SHAPE[props.badgeShape ?? 'circle']
              } ${tone.bg}`}
            >
              <Icon className={`h-7 w-7 ${tone.ink}`} strokeWidth={1.75} aria-hidden />
            </View>

            {/* 제목·내용·설명이 한 덩어리다. 내용은 제목에 딸린 값이라(버전·단계) 떼어 놓으면
                따로 선 사실이 되어 무엇에 대한 값인지가 사라진다.

                `w-full` 은 표가 전폭으로 서게 한다. 바깥이 `items-center` 라 안 주면 표가 글자
                폭으로 오그라든다. */}
            <View testID={`${testId}-body`} className="w-full gap-2">
              <Text
                testID={props.titleTestId}
                className="text-center text-base font-semibold leading-snug text-text"
              >
                {props.title}
              </Text>
              {props.content !== undefined && (
                <View testID={`${testId}-content`}>{props.content}</View>
              )}
              {props.description !== undefined && (
                <Text
                  testID={`${testId}-description`}
                  className="text-center text-xs text-text-muted"
                >
                  {props.description}
                </Text>
              )}
            </View>
          </View>

          {props.option !== undefined && <View testID={`${testId}-option`}>{props.option}</View>}

          {/* 링크는 알약에서 더 떨어뜨린다(12). 작은 글자 둘이 붙으면 한 문단으로 뭉쳐 누를 수
              있는 것으로 안 보인다. 고스트 버튼은 알약과 한 벌이라 4 다. */}
          <View className={`items-center ${props.link !== undefined ? 'gap-3' : 'gap-1'}`}>
            <Button
              variant="primary"
              onPress={props.action.onPress}
              busy={props.action.busy}
              disabled={props.action.disabled}
              className={`w-full items-center${props.action.disabled === true ? ' opacity-50' : ''}`}
              textClassName="text-sm"
            >
              {props.action.label}
            </Button>
            {/* 파괴 동작의 색은 `textClassName` 이 아니라 **변형**으로 준다. 클래스 순서로는 변형의
                색을 못 덮는다. 같은 특이도라 생성된 CSS 순서가 이기는데, 크기(`text-xs`)는 덮이고
                색(`text-error-ink`)은 안 덮여 실측으로 갈렸다. 변형이면 대기 스피너 색도 함께 온다. */}
            {props.secondaryAction !== undefined && (
              <Button
                variant={props.secondaryAction.danger === true ? 'dangerText' : 'text'}
                onPress={props.secondaryAction.onPress}
                busy={props.secondaryAction.busy}
                disabled={props.secondaryAction.disabled}
                className={`w-full items-center px-4 py-1.5${
                  props.secondaryAction.disabled === true ? ' opacity-50' : ''
                }`}
                textClassName="text-xs"
              >
                {props.secondaryAction.label}
              </Button>
            )}
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
