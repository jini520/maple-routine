/**
 * 직접 적은 완료의 표식과 그 설명. 보스 이름 뒤에 느낌표 하나가 붙고, 누르면 팝오버가 말한다.
 *
 * 글자 없이 아이콘 하나인 것은 이름이 길어지면 보스명이 먼저 잘리기 때문이다. 이 줄이 왜 완료인지는
 * 팝오버가 설명하고, 줄 자체는 자동 기록과 똑같이 생긴다 - 세는 방법이 같기 때문이다.
 */
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'

import { AlertCircleIcon, Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { formatDayLabel } from '../../lib/calendar'
import { anchorPopover } from '../../lib/popover-anchor'
import type { BossProfitRow } from '../../features/boss-profit/rows'

/** 아이템 수익 팝오버와 같은 값들. 한 화면에서 팝오버 폭이 갈리면 안 된다. */
const POPOVER_WIDTH = 248
const EDGE_GAP = 12
const CARET_SIZE = 8
const POPOVER_GAP = 8

export function ManualCompletionMark(props: { row: BossProfitRow }): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions()
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()

  const geometry = anchorPopover({
    containerWidth: windowWidth,
    anchorCenterX: anchor === null ? 0 : anchor.left + anchor.width / 2,
    popoverWidth: POPOVER_WIDTH,
    edgeGap: EDGE_GAP,
    caretSize: CARET_SIZE,
  })

  return (
    <>
      <Pressable
        ref={ref}
        role="button"
        aria-label={`${props.row.bossName} 직접 기록 설명`}
        onPress={toggle}
        hitSlop={8}
        className="shrink-0 active:opacity-60"
      >
        <AlertCircleIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
      </Pressable>

      {isOpen && (
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={close}
        >
          <Pressable aria-label="설명 닫기" onPress={close} className="flex-1" />
          <View
            testID="manual-completion-popover"
            role="dialog"
            aria-label="직접 기록 설명"
            style={{
              left: geometry.left,
              top: anchor === null ? 0 : anchor.top + anchor.height + POPOVER_GAP,
              width: POPOVER_WIDTH,
            }}
            className={`absolute rounded-[12px] border border-border bg-surface p-3 shadow-lg${
              anchor === null ? ' opacity-0' : ''
            }`}
          >
            <View
              aria-hidden
              style={{ left: geometry.caretLeft, width: CARET_SIZE, height: CARET_SIZE, top: -4 }}
              className="absolute rotate-45 border-l border-t border-border bg-surface"
            />

            <Text className="text-11 font-bold text-text">직접 완료로 작성된 기록이에요</Text>
            <Text className="mt-1 text-11 leading-4 text-text-muted">
              API 응답과 동기화되지 않은 기록이에요. API에서 완료 기록이 도착하면 이 표시가
              사라져요.
            </Text>
            {props.row.defeatedOn !== null && (
              <Text
                className="mt-2 border-t border-border pt-2 text-10 text-text-disabled"
                style={TABULAR_NUMS}
              >
                {`${formatDayLabel(props.row.defeatedOn)} · ${DIFFICULTY_NAME[props.row.difficulty]} · ${
                  props.row.partySize ?? 1
                }명`}
              </Text>
            )}
          </View>
        </Modal>
      )}
    </>
  )
}
