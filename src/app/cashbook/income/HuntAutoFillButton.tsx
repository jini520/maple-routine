/**
 * 마지막에 적은 사냥 자리를 되살리는 누르개. 심볼 줄의 왼쪽에 선다.
 *
 * **꺼져 있어도 눌린다.** `disabled` 로 두면 눌러도 아무 일이 없어, 처음 쓰는 사람은 이 버튼이
 * 무엇인지도 왜 꺼졌는지도 못 듣는다. 그래서 꺼진 모양만 입히고 누르면 안내를 띄운다.
 *
 * 안내 상자는 RN `Modal` 이다. 이 줄은 바텀시트 안이라 `absolute` 로는 시트 밖으로 못 나간다
 * (`SelectField` 의 목록이 같은 이유로 `Modal` 을 쓴다).
 */
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { useAnchoredPopover } from '../../../hooks/useAnchoredPopover'
import { anchorPopover } from '../../../lib/popover-anchor'

/** 꺼진 이유. 무엇을 하는 버튼인지와 언제 켜지는지를 한 자리에서 말한다. */
export const AUTO_FILL_HINT =
  '마지막에 입력된 사냥터 정보로 자동 입력됩니다. 최소 1회 선택 입력 시 활성화 됩니다.'

/**
 * 상자 폭. 안내 문구가 **`됩니다.` 를 안 끊는** 최소값에서 조금 넘겨 잡았다.
 *
 * 232 에서는 `입력됩니` 다음에 줄이 바뀌어 `다.` 두 글자만 다음 줄로 넘어갔다(사용자 지적).
 * 안쪽 폭이 여백 24 를 뺀 값이라 글자가 들어갈 자리는 이 수보다 그만큼 좁다.
 */
const TIP_WIDTH = 252
const TIP_EDGE_GAP = 12
const TIP_CARET_SIZE = 8
/** 누르개 밑변과 상자 윗변 사이. 꼬리의 절반이 삐져나와 닿아 보이는 최소값이다. */
const TIP_GAP = 8

export function HuntAutoFillButton(props: {
  /** 되살릴 것이 있나. 없으면 꺼진 모양이고 누르면 안내가 뜬다. */
  enabled: boolean
  onFill: () => void
}): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions()
  // 구조 분해가 필수다. `popover.ref` 로 읽으면 린트가 렌더 중 ref 접근으로 본다.
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()

  const geometry = anchorPopover({
    containerWidth: windowWidth,
    anchorCenterX: anchor === null ? 0 : anchor.left + anchor.width / 2,
    popoverWidth: TIP_WIDTH,
    edgeGap: TIP_EDGE_GAP,
    caretSize: TIP_CARET_SIZE,
  })

  return (
    <>
      <Pressable
        ref={ref}
        testID="income-sheet-autofill"
        role="button"
        aria-label="사냥터 자동 입력"
        // 누르기는 열어 두고 꺼졌다는 사실만 읽어 준다. 낭독기에도 그 사실이 들려야 한다.
        aria-disabled={!props.enabled}
        onPress={props.enabled ? props.onFill : toggle}
        className={`shrink-0 rounded-full border px-2 py-0.5 active:opacity-60 ${
          props.enabled ? 'border-primary bg-primary-tint' : 'border-border bg-surface-2'
        }`}
      >
        <Text
          className={`text-11 font-semibold ${
            props.enabled ? 'text-primary-ink' : 'text-text-disabled'
          }`}
        >
          사냥터 자동 입력
        </Text>
      </Pressable>

      {isOpen && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={close}
        >
          {/* 바깥 탭으로 닫는다. **스크림이 없다**. */}
          <Pressable aria-label="안내 닫기" onPress={close} className="flex-1" />
          <View
            testID="income-sheet-autofill-tip"
            role="dialog"
            aria-label="사냥터 자동 입력 안내"
            style={{
              left: geometry.left,
              top: anchor === null ? 0 : anchor.top + anchor.height + TIP_GAP,
              width: TIP_WIDTH,
            }}
            // 자리를 아직 못 쟀으면 그리되 안 보인다. 0,0 에 한 프레임 뜨는 것을 막는다.
            className={`absolute rounded-[12px] border border-border bg-surface p-3 shadow-lg${
              anchor === null ? ' opacity-0' : ''
            }`}
          >
            {/* 꼬리: 45도 돌린 정사각형의 위·왼쪽 테두리만 남겨 상자 배경과 이어 붙인다. */}
            <View
              aria-hidden
              style={{
                left: geometry.caretLeft,
                width: TIP_CARET_SIZE,
                height: TIP_CARET_SIZE,
                top: -4,
              }}
              className="absolute rotate-45 border-l border-t border-border bg-surface"
            />
            {/*
              **낱말 가운데를 안 끊는다.** 한글은 어디서나 끊을 수 있어 기본값이 `최소` 를
              `최`/`소` 로 가른다. 두 플랫폼이 프롭 이름부터 달라 둘 다 준다.
            */}
            <Text
              className="text-11 leading-4 text-text-muted"
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="balanced"
            >
              {AUTO_FILL_HINT}
            </Text>
          </View>
        </Modal>
      )}
    </>
  )
}
