/**
 * 메이플 ID 드롭다운. 캐릭터 관리 화면 아래 층의 머리에 서는 오버레이.
 *
 * 값 규칙은 `summarizeAccount` 가 갖는다. 대표 캐릭터와 월드별 개수를 거기서 정하고 이 컴포넌트는
 * 받은 것을 그리기만 한다. 저장소도 네트워크도 모른다.
 *
 * 지키는 것 넷.
 *
 * ① **스크림이 없다.** 뒤를 덮으면 바로 아래 후보 목록까지 어두워진다. 층은 그림자와 테두리가
 *    말하고, 바깥 탭으로 닫는 성질만 남긴다.
 * ② 트리거와 목록 행이 **같은 컴포넌트**다. 모양이 갈리면 지금 고른 것과 고를 수 있는 것이 다른
 *    종류로 보인다.
 * ③ 오버레이가 `react-native` 의 `Modal` 이다. RN 의 `absolute` 는 부모 상자에 갇혀 이 화면
 *    안에서는 아래 층을 못 덮는다.
 * ④ 좌표를 **잰 뒤에** 그린다. 측정(`measureInWindow`)과 목록 높이(`onLayout`)가 둘 다 올 때까지
 *    `opacity-0` 이다. jest 는 레이아웃을 안 계산해 그 콜백이 안 오므로 테스트가 보는 목록은 늘
 *    투명하다. 회전하면 잰 좌표가 거짓이 되어 닫는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { AccountSummaryView } from '../../../features/character-manage/derivations'
import { worldEmblemUrl } from '../../../lib/assets/asset-lookup'

import { FACE_AVATAR_SIZE } from '../../../lib/face-crop'
import { CharacterAvatar } from '../../molecules/CharacterAvatar/CharacterAvatar'
import { ChevronDownIcon, Text } from '../../atoms'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { placeDropdown } from './place-dropdown'

// 얼굴 크롭 표는 `lib/face-crop` 하나뿐이다. 이 파일이 들고 있던 36px 표가 그 자리로 옮겨갔고,
// 캐릭터 카드(`CharacterRow`)도 같은 것을 쓴다(사용자 지정 2026-08-17).

/** 목록이 화면 가장자리에 붙지 않게 남기는 여백. */
const EDGE_GAP_PX = 12

/** 트리거와 목록 행이 공유하는 안쪽 여백. 둘이 어긋나면 한 덩어리 가 깨진다. */
const ROW_PADDING = 'px-3 py-2.5'

interface AccountRowProps {
  summary: AccountSummaryView
  /** 캐시에 있을 때만 오는 초상 주소. 없으면 대표 이름의 첫 글자를 그린다. */
  portraitUrl: string | null
  /** 오른쪽 슬롯: 트리거만 `▾` 를 갖는다. */
  trailing?: React.ReactNode
}

function AccountRow(props: AccountRowProps): React.JSX.Element {
  const { accountId, representative, worldCounts } = props.summary
  const emblem = worldEmblemUrl(representative.world)

  return (
    <View className="flex-row items-center gap-2.5">
      {/* 초상화 규칙은 `CharacterRow` 와 같다(사용자 지정 2026-08-17). 두 자리가 갈리면 같은 얼굴이
          화면마다 다르게 없어진다. */}
      <CharacterAvatar
        imageTestID={`account-select-face-${accountId}`}
        imageUrl={props.portraitUrl}
        name={representative.name}
        size={FACE_AVATAR_SIZE}
        className="shrink-0"
        fallback={
          <View
            testID={`account-select-face-fallback-${accountId}`}
            className="h-full w-full items-center justify-center bg-primary"
          >
            <Text className="text-sm font-bold text-on-primary">?</Text>
          </View>
        }
      />

      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-1">
          {emblem !== null && (
            <View testID={`account-select-emblem-${accountId}`} className="shrink-0">
              <Image
                accessibilityLabel={representative.world}
                source={emblem}
                // 폭은 그림이 정한다. 안 적으면 엠블럼의 고유 폭이 남아 줄 왼쪽이 벌어진다
                //
                style={naturalAspectStyle(emblem, { height: 17 })}
                resizeMode="contain"
              />
            </View>
          )}
          <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-text">
            {`${representative.world} Lv.${representative.level} ${representative.name}`}
          </Text>
        </View>

        <Text numberOfLines={1} className="text-xs text-text-muted">
          {worldCounts.map((entry) => `${entry.world} ${entry.count}개`).join(', ')}
        </Text>
      </View>

      {props.trailing}
    </View>
  )
}

export interface AccountSelectProps {
/** 파생값. 값 규칙(대표 · 월드 둘까지)은 이미 여기 담겨 온다. */
  accounts: AccountSummaryView[]
  selectedAccountId: string
  /** 그 계정의 대표 캐릭터 얼굴. **캐시에 있을 때만**. 없으면 이니셜. */
  portraitByAccountId: Record<string, string | null>
  onSelect: (accountId: string) => void
}

export function AccountSelect(props: AccountSelectProps): React.JSX.Element {
  const triggerRef = useRef<View | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  const close = useCallback((): void => {
    setIsOpen(false)
    setAnchor(null)
    setContentHeight(null)
  }, [])

  function open(): void {
    setIsOpen(true)
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ left: x, top: y, width, height })
    })
  }

  // 회전하면 잰 좌표가 거짓이 된다(파일 머리 ⓒ).
  useEffect(() => {
    if (!isOpen) return
    const subscription = Dimensions.addEventListener('change', close)
    return () => subscription.remove()
  }, [isOpen, close])

  // 고른 계정이 목록에 없을 수 있다(계정 목록이 갱신되는 순간). 렌더 중에 던지지 않는다.
  // 그것이 이 고친 사고다.
  const selected = props.accounts.find((account) => account.accountId === props.selectedAccountId)
  if (selected === undefined) return <></>

  const placement =
    anchor === null
      ? null
      : placeDropdown({
          anchorTop: anchor.top,
          anchorHeight: anchor.height,
          contentHeight: contentHeight ?? 0,
          windowHeight,
          safeTop: insets.top,
          safeBottom: insets.bottom,
          edgeGap: EDGE_GAP_PX,
        })

  // 좌표와 높이가 둘 다 와야 **뒤집을지** 가 정해진다. 그전에 그리면 한 프레임이 엉뚱한 자리에
  // 뜬다(파일 머리 ⓑ).
  const isPlaced = placement !== null && contentHeight !== null

  return (
    <>
      <Pressable
        ref={triggerRef}
        testID="account-select-trigger"
        role="button"
        aria-expanded={isOpen}
        onPress={open}
        className={`rounded-[14px] border border-border bg-surface ${ROW_PADDING}`}
      >
        <AccountRow
          summary={selected}
          portraitUrl={props.portraitByAccountId[selected.accountId] ?? null}
          trailing={<ChevronDownIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />}
        />
      </Pressable>

      {isOpen && (
        <Modal
          testID="account-select-modal"
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={close}
        >
          {/* **색이 없다**. 잡기만 한다(파일 머리 ①). */}
          <Pressable
            testID="account-select-backdrop"
            accessibilityLabel="메이플 ID 목록 닫기"
            onPress={close}
            className="flex-1"
          />

          <View
            testID="account-select-list"
            role="menu"
            aria-label="메이플 ID"
            style={{
              left: anchor?.left ?? 0,
              top: placement?.top ?? 0,
              width: anchor?.width,
              maxHeight: placement?.maxHeight,
            }}
            className={`absolute overflow-hidden rounded-[14px] border border-border bg-surface shadow-lg${
              isPlaced ? '' : ' opacity-0'
            }`}
          >
            <ScrollView>
              {/* 자연 높이를 재는 자리. `ScrollView` 안이라 바깥 `maxHeight` 에 눌리지 않는다. */}
              <View onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}>
                {props.accounts.map((account) => {
                  const isSelected = account.accountId === props.selectedAccountId
                  return (
                    <Pressable
                      key={account.accountId}
                      testID={`account-select-option-${account.accountId}`}
                      role="button"
                      aria-selected={isSelected}
                      onPress={() => {
                        close()
                        props.onSelect(account.accountId)
                      }}
                      className={`${ROW_PADDING}${isSelected ? ' bg-primary-tint' : ''}`}
                    >
                      <AccountRow
                        summary={account}
                        portraitUrl={props.portraitByAccountId[account.accountId] ?? null}
                      />
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  )
}
