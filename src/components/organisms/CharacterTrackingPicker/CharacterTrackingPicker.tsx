// "캐릭터 관리" 모달 — 그리드(`CharacterTrackingGrid`)를 감싸는 오버레이·카드·CTA 를 소유한다.
// 그리드 자체는 온보딩 캐릭터 선택 단계와 공유한다([[ADR-035]]).
//
// ⚠️ **이 모달 껍데기는 RN 제품 코드에서 더 이상 열리지 않는다**([[ADR-144]] 결정 1, 2026-08-17) —
// 설정의 캐릭터 관리가 `SettingsCharactersScreen` 하위 페이지로 옮겨갔다. 지금 남은 이유는
// `CharacterTrackingGrid`·`roster-body` 를 **온보딩 캐릭터 선택 단계가 아직 쓰기 때문**이다.
// 그 단계가 새 본문(`CharacterManageBody`)으로 옮겨가면 이 디렉터리 전체가 고아가 된다 — 지우는
// 것은 그때 함께 한다(둘을 따로 지우면 중간에 온보딩이 그릴 것을 잃는다).
//
// ── RN 으로 옮기며 갈린 것 다섯 ─────────────────────────────────────────────────────
//
// ① **오버레이 = `react-native` 의 `Modal`.** 웹의 `fixed inset-0` 은 뷰포트 기준이라 어디에 마운트
//    하든 화면 전체를 덮었지만, RN 의 `absolute inset-0` 은 **부모 상자**에 갇힌다 — 탭 화면 안에서
//    열면 탭바를 못 덮는다. `Modal` 은 별도 네이티브 윈도우라 그 성질(전체 화면·부모 레이아웃 무관·
//    뒤 화면 터치 차단)을 그대로 준다. [[ADR-094]] 결정 1 이 말한 *"오버레이가 취약 구조를
//    소유한다"* 도 유지된다 — 호출부는 여전히 조건부 마운트만 한다.
// ② **`useBodyScrollLock` 이 사라진다.** 그 훅이 하던 일(뒤 문서 스크롤 잠금)을 네이티브 윈도우가
//    구조적으로 한다. 대체가 아니라 **필요 자체가 없어진 것**이라 짝을 만들지 않는다.
// ③ **안드로이드 뒤로가기 → 닫기**([[ADR-120]] 결정 18 후반, 2단계가 organisms 몫으로 남긴 자리).
//    `onRequestClose` 가 그 자리다 — 스택을 pop 하는 대신 이 오버레이만 닫는다.
// ④ **`--sa-*` → `useSafeAreaInsets()`.** 웹은 셸이 CSS 변수로 깔아 준 값을 `calc()` 로 읽었다.
//    RN 에서는 값이 훅으로 오고, 그래서 [[ADR-107]] 결정 2 의 `min(385px, calc(100dvh - …))` 도
//    클래스가 아니라 **JS 계산**이 된다(아래 `bodyMinHeight`).
// ⑤ `panel-on-scrim` → **`border-panel-border`**([[ADR-122]]). RN 에는 `:root[data-mode]` 선택자가
//    없어 그 규칙이 계산하던 결과를 토큰 하나로 미리 만들어 뒀다(`src/theme/theme-vars.ts`).
//    모드 분기는 거기서 `definition.mode` 로 딱 한 번 일어난다 — **테마 이름으로 가르지 않는다**.
import { useState } from 'react'
import { Modal, ScrollView, View } from 'react-native'
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context'

import { formatRosterError, formatStaleRosterError } from '../../../features/schedule-sync/format'
import type { ScheduleSyncError } from '../../../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../../../types'

import { Button, Card, MapleSweepSpinner, Text } from '../../atoms'
import { ErrorState } from '../../molecules/ErrorState/ErrorState'
import { StaleBanner } from '../../molecules/ErrorState/StaleBanner'
import { CharacterTrackingGrid } from './CharacterTrackingGrid'
import { ROSTER_BODY_MIN_H_PX } from './roster-body'

/**
 * 본문 자리 최소 높이가 양보하기 시작하는 지점 — 카드 크롬 194px(패딩 48 · 테두리 2 · 헤더 72 ·
 * 간격 32 · 버튼 40) + 오버레이 상하 여백 32px 을 올린 값(웹의 `15rem`).
 *
 * 이 상수가 다소 어긋나도 안전하다 — 클램프는 385px 가 애초에 들어가지 않는 기기에서만 발동하고,
 * 그 위에서는 `Math.min` 이 항상 385px 를 고른다([[ADR-107]] 결정 2).
 */
const PICKER_CHROME_PX = 240

/** 오버레이가 안전영역 **위에 더** 비우는 여백 — 인셋이 0인 기기에서도 화면에 붙지 않게 한다. */
const OVERLAY_GUTTER_PX = 16

// [[ADR-043]] 결정 1: 그리드의 토글이 ocid 를 배열 끝에 append 하므로 같은 집합이어도 배열 순서가
// 달라진다 — 저장 버튼 활성 여부는 반드시 멤버십(집합)으로만 판정한다.
function isSameOcidSet(a: string[], b: string[]): boolean {
  const left = new Set(a)
  const right = new Set(b)
  if (left.size !== right.size) return false
  return [...left].every((ocid) => right.has(ocid))
}

export interface CharacterTrackingPickerProps {
  entries: CharacterPickerEntry[]
  /**
   * 후보 목록 조회가 진행 중인지([[ADR-053]] 결정 3). 호출부가 `getCharacterPickerRoster` 의
   * Promise 완료 시점으로 판정해 내려준다.
   */
  isLoading: boolean
  trackedOcids: string[]
  /**
   * 조회가 전역 실패(401/429 등)로 끝났는지 + 그 원인([[ADR-062]] 결정 2) — "활성 캐릭터 0명"과
   * 구분하는 것을 넘어 원인별 문구·액션을 그리기 위해 boolean 이 아니라 에러 종류를 받는다.
   */
  loadError: ScheduleSyncError | null
  onSave: (ocids: string[]) => void
  onClose: () => void
  /** 재조회. 호출부가 피커를 여는 경로와 같은 초기화를 재사용한다([[ADR-062]] 트레이드오프). */
  onRetry: () => void
}

// [[ADR-053]] 결정 3: 그리드 자리에 그릴 것을 고른다. 보여줄 항목이 하나라도 있으면 조회 중이어도
// 그리드를 그린다 — 캐시 우선 표시([[ADR-016]])를 스피너로 가리지 않기 위해서다. 항목이 없을 때만
// 조회 중(스피너) / 조회 완료 후 0건(빈 상태) / 조회 실패(에러)를 구분한다.
//
// [[ADR-062]] 결정 4: 항목이 있는 채로 실패했으면 그리드를 지우지 않고 위에 스탈 배너를 얹는다 —
// 캐시 stub 이 네트워크보다 먼저 방출되므로([[ADR-017]] 결정 6) 예열이 끝난 정상 경로에서는 이쪽이
// 기본 분기다. 배너가 없으면 실패의 대다수가 무음이 된다.
//
// [[ADR-114]] 결정 3: 그 배너의 문구도 액션도 원인별로 갈린다(전에는 원인과 무관하게 "목록이 최신이
// 아닙니다" + 다시 시도 하나였다 — 기본 분기인 이 자리가 곧 실패의 대다수가 원인을 잃던 자리다).
// **재시도가 실제로 통하는 실패에만 액션을 준다** — 429는 눌러도 또 429고 characterUnavailable 은
// 언제 눌러도 같은 400이라 배너에 버튼이 없다. 액션을 뺄 수 있는 근거는 자리다: **배너 아래에
// 목록이 그대로 남아 있어 액션이 없어도 막다른 길이 아니다.**
//
// [[ADR-115]] 결정 7: 401은 배너에도 ErrorState 에도 액션이 없다 — 그 401은 곧 키 무효화라 화면이
// 스스로 키 입력으로 이동하므로 **누를 것이 없다**(옛 설정 이동 액션은 목적지가 비어 있었다).
// 그래서 이 화면의 401 표시는 이동 직전 한 프레임이자 안전망이다.
function PickerBody(
  props: CharacterTrackingPickerProps & { onChange: (ocids: string[]) => void },
): React.JSX.Element {
  if (props.entries.length > 0) {
    const stale = props.loadError === null ? null : formatStaleRosterError(props.loadError)
    return (
      <>
        {/* 스탈 배너는 스크롤포트 밖이다 — 목록을 굴려도 "최신이 아님"은 계속 보여야 한다. */}
        {stale !== null && (
          <StaleBanner
            message={stale.message}
            action={
              stale.action === undefined
                ? undefined
                : { label: stale.action.label, onClick: props.onRetry }
            }
          />
        )}
        {/* [[ADR-107]] 결정 3: 스크롤포트를 카드 패딩(p-6) 바깥까지 넓혀 인디케이터를 모달 오른쪽
            끝에 붙이고, 같은 크기 pr-6 으로 콘텐츠 여백을 되돌린다(폭은 그대로다). 웹에서 한
            요소가 하던 두 일(스크롤 상자 · 안쪽 패딩)이 RN 에서는 `ScrollView` 자신과
            `contentContainer` 로 나뉜다 — 패딩을 상자에 주면 인디케이터가 다시 안쪽으로 들어온다. */}
        <ScrollView
          testID="character-tracking-picker-scroll"
          className="-mr-6 flex-1"
          contentContainerClassName="pr-6"
        >
          <CharacterTrackingGrid
            entries={props.entries}
            trackedOcids={props.trackedOcids}
            onChange={props.onChange}
          />
        </ScrollView>
      </>
    )
  }

  if (props.isLoading) {
    return (
      <View
        role="status"
        aria-busy
        aria-label="캐릭터 목록을 불러오는 중"
        className="flex-1 items-center justify-center"
      >
        <MapleSweepSpinner size={32} className="text-primary" />
      </View>
    )
  }

  if (props.loadError !== null) {
    const copy = formatRosterError(props.loadError, 'picker')
    return (
      <ErrorState
        title={copy.title}
        description={copy.description}
        // 영구 실패(조회 불가 캐릭터)와 401에는 액션이 없다 — 눌러도 실패하는 버튼도, 이동이
        // 이미 일어난 자리의 버튼도 주지 않는다([[ADR-062]] 결정 3, [[ADR-067]] 결정 1,
        // [[ADR-115]] 결정 7). 남은 액션은 전부 재시도다.
        action={
          copy.action === undefined ? undefined : { label: copy.action.label, onClick: props.onRetry }
        }
      />
    )
  }

  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="text-center text-sm text-text-muted">표시할 캐릭터가 없어요</Text>
    </View>
  )
}

export function CharacterTrackingPicker(props: CharacterTrackingPickerProps): React.JSX.Element {
  const [selectedOcids, setSelectedOcids] = useState<string[]>(props.trackedOcids)
  const insets = useSafeAreaInsets()
  // `100dvh` 의 짝은 `useWindowDimensions()` 가 아니라 **안전영역 프레임**이다 — 인셋과 같은
  // 프로바이더에서 나와 둘이 같은 순간을 가리키고(창 크기가 바뀌는 회전·분할화면에서 어긋나지
  // 않는다), 테스트에서도 인셋과 함께 한 값으로 준다.
  const frame = useSafeAreaFrame()

  const isUnchanged = isSameOcidSet(selectedOcids, props.trackedOcids)
  // [[ADR-086]] 결정 7: 목록을 통째로 비울 수 없다 — 0명은 화면을 빈 상태로 만들 뿐 어떤 사용자
  // 의도도 표현하지 않는다. 온보딩 캐릭터 단계와 같은 규칙이다.
  const isEmptySelection = selectedOcids.length === 0
  const isSaveDisabled = isUnchanged || isEmptySelection

  // [[ADR-107]] 결정 2: **`min-height` 는 `max-height` 를 이기므로** 3줄 고정(385px)을 그대로 두면
  // 결정 1 의 카드 상한이 짧은 기기에서 통째로 무효가 된다. 모달에서만 클램프한다(온보딩은 페이지라
  // 상한 자체가 없어 `ROSTER_BODY_MIN_H_PX` 를 그대로 쓴다).
  const bodyMinHeight = Math.max(
    0,
    Math.min(ROSTER_BODY_MIN_H_PX, frame.height - insets.top - insets.bottom - PICKER_CHROME_PX),
  )

  return (
    <Modal
      testID="character-tracking-picker-modal"
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <View
        testID="character-tracking-picker-overlay"
        // [[ADR-107]] 결정 1: 카드 높이의 상한은 화면이 아니라 **안전영역을 뺀 화면**이다. 오버레이가
        // 인셋 + 16px 을 비우고, 카드가 `max-h-full` 로 그 안에 갇힌다 — `vh`(RN 에서는 창 높이)로
        // 묶으면 시스템 바가 계산에서 빠져 인셋이 큰 기기일수록 더 침범한다.
        className="flex-1 items-center justify-center bg-scrim px-4"
        style={{
          paddingTop: insets.top + OVERLAY_GUTTER_PX,
          paddingBottom: insets.bottom + OVERLAY_GUTTER_PX,
        }}
      >
        {/* 자체 오버레이라 `Modal.Card` 를 안 쓴다 — 스크림 위 테두리 톤다운은 직접 붙인다
            ([[ADR-122]]: 라이트에서만 테두리를 배경색에 녹이고, 다크에서는 경계가 그것뿐이라
            그대로 둔다. 그 판정은 토큰 안에서 끝나 있다). */}
        <Card className="max-h-full w-full max-w-sm border-panel-border p-6">
          <View className="mb-4 shrink-0 gap-1">
            <Text className="text-lg font-semibold text-text">캐릭터 관리</Text>
            <Text className="text-sm text-text-muted">
              체크한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 1개는 선택해주세요.
            </Text>
          </View>

          {/* 상태가 바뀌어도 이 자리의 높이가 고정돼 아래 닫기·저장 버튼이 움직이지 않는다.
              남는 높이를 받고 모자라면 줄어드는 것도 이 자리뿐이다(헤더·푸터는 shrink-0). */}
          <View testID="character-tracking-picker-body" className="shrink" style={{ minHeight: bodyMinHeight }}>
            <PickerBody {...props} onChange={setSelectedOcids} />
          </View>

          <View className="mt-4 shrink-0 flex-row justify-end gap-2">
            <Button variant="text" onPress={props.onClose}>
              닫기
            </Button>
            <Button
              variant="primary"
              onPress={() => props.onSave(selectedOcids)}
              disabled={isSaveDisabled}
              // 웹의 `disabled:opacity-50` 은 CSS 의사 클래스라 RN 의 `disabled` 프롭과 이어지지
              // 않는다 — 그대로 두면 비활성 버튼이 멀쩡한 색으로 보인다(molecules 와 같은 처방).
              className={isSaveDisabled ? 'opacity-50' : undefined}
              textClassName="text-sm"
            >
              저장
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  )
}
