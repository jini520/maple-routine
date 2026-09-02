// 메이플 ID 드롭다운 — 캐릭터 관리 화면 «아래 층의 머리»([[ADR-144]] 결정 6).
//
// **이 앱이 여는 목록을 직접 만드는 첫 자리다.** RN 에는 `<select>` 가 없고, [[ADR-142]] 정정 8 이
// «눌러도 안 열리는» `CharacterSelectDropdown` 을 지웠다 — 참고할 옛 디자인이 존재하지 않는다.
//
// ── 무엇을 두지 않기로 했는가 ─────────────────────────────────────────────────────
//
// ① **스크림이 없다**(사용자 지정). 뒤를 어둡게 덮으면 ⓐ 피커 모달·키 안내 모달([[ADR-115]])과
//    같은 무게로 읽히고 ⓑ 바로 아래에 있는 후보 목록(고르는 중에 계속 보여야 하는 것)까지 함께
//    어두워진다. 이 오버레이가 하는 일은 **값 하나를 고르는 것**이다. 층은 그림자와 테두리가 말한다.
//    바깥 탭으로 닫는 성질은 그대로 남는다 — 스크림과 터치 캐처는 같은 요소의 두 성질이고,
//    여기서는 **잡는 일만 남기고 칠하는 일을 뺀다**. 같은 판단을 `ItemRevenuePopover` 가 이미 했다.
// ② **`border-panel-border` 가 아니라 `border-border` 다.** 그 토큰은 [[ADR-122]] 가 «스크림 위
//    패널» 을 위해 만든 것이고(라이트에서 합성된 중간 회색 배경에 테두리를 녹인다), 스크림이 없는
//    이 목록의 뒤는 평범한 페이지 배경이라 그 계산의 전제가 성립하지 않는다.
// ③ **행에 다른 것을 더 얹지 않는다** — «선택 n개» 배지도 «방금 확인함»(TTL) 표시도 없다
//    (결정 6). 이 줄이 답하는 질문은 «이게 어느 메이플 ID 인가» 하나다.
//
// ── 트리거와 목록 행은 **같은 컴포넌트**다 ────────────────────────────────────────
//
//   (얼굴)   [스] 스카니아 Lv.294 낟낟          ▾
//            스카니아 19개, 엘리시움 7개
//
// 고른 것이 트리거에 그대로 남는 것이 `<select>` 의 문법이고, 모양이 갈리면 «지금 고른 것» 과
// «고를 수 있는 것» 이 다른 종류로 보인다. 갈리는 것은 오른쪽 슬롯(트리거만 `▾`)과 선택 틴트뿐이다.
//
// **1줄의 월드는 글자로 적는다** — 캐릭터 카드(`CharacterRow`)는 엠블럼 하나로 줄이지만, 여기서
// 월드는 계정을 가르는 기준이라 성질이 다르다(결정 2).
//
// ── 값 규칙은 여기 없다 ───────────────────────────────────────────────────────────
//
// 대표 캐릭터(최고 레벨)·월드별 개수(많은 순 **둘까지**)는 `summarizeAccount` 가 정한다
// ([[ADR-144]] 머리 «값 규칙의 자리»). 이 컴포넌트는 받은 것을 그리기만 한다 — 저장소도
// 네트워크도 모르고, **얼굴 하나 때문에 `character/basic` 을 부르지 않는다**([[ADR-143]] 결정 5 가
// 산 «안 열어 본 계정의 비용 0» 을 도로 내주는 일이다).
//
// ── RN 사정 셋 ────────────────────────────────────────────────────────────────────
//
// ⓐ **`Modal` 을 쓰는 이유**는 [[ADR-094]] 결정 1·`CharacterTrackingPicker` 와 같다 — RN 의
//    `absolute` 는 **부모 상자**에 갇혀 이 화면 안에서는 아래 층을 못 덮는다. organism `Modal` 이
//    아니라 `react-native` 의 것인 이유는 그쪽이 스크림 + 중앙 정렬을 소유하기 때문이다(①).
// ⓑ **측정은 비동기다**(`measureInWindow`). 좌표를 모르는 채 아무 데나 그리지 않고, 알 때까지
//    `opacity-0` 으로 기다린다 — [[ADR-101]] 이 없앤 «모르는 사실을 그리는 프레임» 과 같은 종류다.
//    목록 높이도 `onLayout` 으로 와야 뒤집을지를 정할 수 있어 **둘 다 온 뒤에** 보인다.
//    **jest 는 레이아웃을 계산하지 않아 그 콜백이 오지 않는다** — 테스트가 보는 목록은 늘
//    `opacity: 0` 이고, 내용·배선 단언은 그대로 성립한다.
// ⓒ **회전하면 잰 좌표가 거짓이 된다** — 닫는다(`ItemRevenuePopover` 와 같은 처방).
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

import { faceCropStyle } from '../../../lib/face-crop'
import { ChevronDownIcon, Text } from '../../atoms'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { placeDropdown } from './place-dropdown'

// 얼굴 크롭 표는 `lib/face-crop` 하나뿐이다 — 이 파일이 들고 있던 36px 표가 그 자리로 옮겨갔고,
// 캐릭터 카드(`CharacterRow`)도 같은 것을 쓴다(사용자 지정 2026-08-17).

/** 목록이 화면 가장자리에 붙지 않게 남기는 여백. */
const EDGE_GAP_PX = 12

/** 트리거와 목록 행이 공유하는 안쪽 여백 — 둘이 어긋나면 «한 덩어리» 가 깨진다. */
const ROW_PADDING = 'px-3 py-2.5'

interface AccountRowProps {
  summary: AccountSummaryView
  /** 캐시에 있을 때만 온다 — 없으면 대표 이름의 첫 글자를 그린다. */
  portraitUrl: string | null
  /** 오른쪽 슬롯: 트리거만 `▾` 를 갖는다. */
  trailing?: React.ReactNode
}

function AccountRow(props: AccountRowProps): React.JSX.Element {
  const { accountId, representative, worldCounts } = props.summary
  const emblem = worldEmblemUrl(representative.world)

  return (
    <View className="flex-row items-center gap-2.5">
      {/* 초상화 규칙은 `CharacterRow` 와 같다(사용자 지정 2026-08-17) — 상자에 배경색 없음, 못 가져온
          자리는 **주황 원 + `?`**. 두 자리가 갈리면 같은 얼굴이 화면마다 다르게 없어진다. */}
      <View className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
        {props.portraitUrl !== null ? (
          <Image
            testID={`account-select-face-${accountId}`}
            accessibilityLabel={representative.name}
            source={{ uri: props.portraitUrl }}
            style={{ position: 'absolute', ...faceCropStyle() }}
          />
        ) : (
          <View
            testID={`account-select-face-fallback-${accountId}`}
            className="h-full w-full items-center justify-center bg-primary"
          >
            <Text className="text-sm font-bold text-on-primary">?</Text>
          </View>
        )}
      </View>

      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-1">
          {emblem !== null && (
            <View testID={`account-select-emblem-${accountId}`} className="shrink-0">
              <Image
                accessibilityLabel={representative.world}
                source={emblem}
                // 폭은 그림이 정한다 — 안 적으면 엠블럼의 고유 폭이 남아 줄 왼쪽이 벌어진다
                // ([[ADR-135]]).
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
  /** step 3 의 파생값. 값 규칙(대표 · 월드 둘까지)은 이미 여기 담겨 온다. */
  accounts: AccountSummaryView[]
  selectedAccountId: string
  /** 그 계정의 대표 캐릭터 얼굴 — **캐시에 있을 때만**. 없으면 이니셜. */
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

  // 고른 계정이 목록에 없을 수 있다(계정 목록이 갱신되는 순간). 렌더 중에 던지지 않는다 —
  // 그것이 [[ADR-127]] 이 고친 사고다.
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

  // 좌표와 높이가 둘 다 와야 «뒤집을지» 가 정해진다 — 그전에 그리면 한 프레임이 엉뚱한 자리에
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
          {/* **색이 없다** — 잡기만 한다(파일 머리 ①). */}
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
              {/* 자연 높이를 재는 자리 — `ScrollView` 안이라 바깥 `maxHeight` 에 눌리지 않는다. */}
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
