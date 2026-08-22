// 드롭 판매가 입력 키패드([[ADR-124]] 결정 5, 이슈 #185).
//
// **OS 키보드를 부르지 않는다.** 웹에서 그 이유는 *"키보드가 뜨는 순간 WebView 가 줄어 시트가
// 밀리거나 잘린다"* 였다. RN 에는 웹뷰가 없지만 **결론은 그대로 선다** — 메소는 자릿수가 커서
// 시스템 숫자 키패드로는 0을 세게 되고(`keyboardType="numeric"` 이 못 고치는 것이 그것이다),
// `KeyboardAvoidingView` 는 플랫폼마다 동작이 갈리는 데다 `@gorhom/bottom-sheet` 의 동적 높이와
// 겹친다. 앱이 자기 키패드를 그리면 **보정할 것이 애초에 없다.**
//
// 층은 위에서 아래로 금액 → 단위 칩 → 분배 → 키패드 → 동작이고, 강조색(primary)은 저장 버튼
// 하나에만 쓴다. 키는 테두리 없이 누를 때만 `surface-2` 가 든다.
//
// ══ RN 으로 옮기며 갈린 것 다섯 ═══════════════════════════════════════════════════
//
// ① **CSS `grid` 가 없다.** 키패드 `grid-cols-3 gap-0.5` 는 `flex-row flex-wrap` + 자식 `w-1/3` 이고
//    간격은 **자식 패딩 + 부모 음수 마진**이다(`BossDropSheet` 파일 머리 ①과 같은 처방 · 같은 이유 —
//    퍼센트 폭과 `gap` 을 섞으면 마지막 칸이 밀려 2열이 된다).
// ② **하단 안전영역을 여기서 넣지 않는다.** 웹은 `pb-[calc(1.25rem+var(--sa-bottom))]` 이었는데
//    RN 에서는 시트 껍데기(`BottomSheet` 의 `contentContainerStyle`)가 이미 `insets.bottom` 을
//    준다 — 두 번 주면 두 겹이 된다. 남는 것은 상수 몫 `pb-5` 뿐이고, 이는 드릴다운 모드에도
//    같다(웹 주석이 *"드릴다운은 안전영역을 넣지 않는다"* 고 적어 둔 갈래가 **양쪽 다 그렇게** 되어
//    사라진다).
// ③ `active:bg-surface-2` 는 NativeWind 가 낸다(`active:` 는 `Pressable` 의 눌림에 이어져 있다).
//    **`disabled:opacity-40` 은 안 낸다** — 웹 CSS 의사 클래스라 `Pressable disabled` 와 이어져
//    있지 않다(`BossProfitBossRow` ③이 먼저 밟았다). JS 조건으로 쓴다.
// ④ `invisible`(초기화 버튼의 자리 지키기) → **`opacity-0` + `pointerEvents="none"`**. RN 에는
//    `visibility` 가 없어 투명도로 대신하고, 투명한 버튼이 눌리지 않도록 터치를 함께 끈다.
// ⑤ `⌫` 는 글자 그대로 남는다(`aria-label` 도 웹과 같은 `한 자리 지우기`).
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { formatMesoUnits } from '../../lib/drop-price'
import { MESO_QUICK_ADDS } from '../../lib/meso-quick-adds'
import { getItemIconUrl } from '../../lib/item-icons'
import type { BossDifficulty } from '../../types'
import type { RecordedDrop } from '../../types/drops'

import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { Text } from '../../components/atoms/Text/Text'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { ChevronLeftIcon, RotateCcwIcon } from '../../lib/icons'
import { TABULAR_NUMS } from '../../lib/text-styles'

/** 자릿수 상한 — 조 단위를 넘기면 `Number` 정밀도가 아니라 화면이 먼저 깨진다. */
const MAX_MESO = 9_999_999_999_999

/**
 * 금액 바로 아래 붙는 단위 칩. 자릿수 세기를 없애는 것이 이 줄의 전부다.
 *
 * 값은 `lib/meso-quick-adds` 가 든다 — 아이템 분배 계산기도 같은 눈금을 쓰기 때문이다
 * ([[ADR-168]] 결정 9).
 */
const QUICK_ADDS = MESO_QUICK_ADDS

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const

export interface DropPricePadProps {
  drop: RecordedDrop
  boss: string
  difficulty: BossDifficulty
  characterName: string
  /** 분배 인원 기본값 — 그 행의 파티원 수(사용자 결정). 저장하면 이 값과 무관해진다. */
  defaultShare: number
  maxShare: number
  /** 순차 모드의 진행 표기(`3 / 6`). 단건 편집이면 넘기지 않는다. */
  progress?: { current: number; total: number }
  onSave: (priceMeso: number, share: number) => void
  /** **기록 안함** — "이 아이템은 값을 매길 만하지 않다"는 결정을 저장한다. */
  onExclude: () => void
  /**
   * **스킵** — 아직 안 팔렸으니 미입력으로 두고 다음으로. **아무것도 저장하지 않는다**
   * (사용자 지정 2026-08-10). 순차 모드에서만 준다 — 단건 편집은 닫으면 같은 일이 된다.
   */
  onLater?: () => void
}

/**
 * 키패드 **본문**. 시트 껍데기를 두르지 않는다 — 두 자리에서 쓰이기 때문이다.
 *
 * ① 가격 기록 화면에서는 아래 `DropPricePad` 가 `BottomSheet` 로 감싸 띄우고,
 * ② 드롭 입력 시트 안에서는 **상자 드릴다운(`BoxDrillDown`)과 같은 방식**으로 시트 내용을 갈아
 *    끼운다. 시트를 닫고 새 시트를 여는 대신 드릴다운으로 들어가는 이유는, 가격을 매긴 뒤
 *    **하던 작업(다른 아이템 고르기)을 이어서** 해야 하기 때문이다([[ADR-124]] 결정 6).
 *
 * `onBack` 이 있으면 드릴다운 모드다 — 상단에 뒤로 버튼이 생긴다.
 */
export function DropPricePadContent(
  props: DropPricePadProps & { onBack?: () => void },
): React.JSX.Element {
  const [meso, setMeso] = useState(props.drop.priceMeso ?? 0)
  const [share, setShare] = useState(props.drop.priceShare ?? props.defaultShare)

  // **대상이 바뀌면 값을 그 아이템의 것으로 되돌린다.** 시트 드릴다운과 순차 모드는 컴포넌트를
  // 언마운트하지 않고 `drop` 만 갈아 끼우므로, 두지 않으면 앞 아이템에 치던 금액과 인원이 그대로
  // 남아 다음 아이템에 얹힌다. 인원은 **그 행의 파티원 수**(`defaultShare`)로 돌아간다.
  //
  // 렌더 중 setState 는 React 가 권하는 "프롭 변화에 상태 맞추기" 패턴이다 — effect 로 하면 옛
  // 값으로 한 프레임 그려진 뒤 덮인다.
  const identity = `${props.drop.boxOrigin ?? ''}|${props.drop.itemName}|${props.drop.ringLevel ?? ''}`
  const [lastIdentity, setLastIdentity] = useState(identity)
  if (lastIdentity !== identity) {
    setLastIdentity(identity)
    setMeso(props.drop.priceMeso ?? 0)
    setShare(props.drop.priceShare ?? props.defaultShare)
  }

  const iconUrl = getItemIconUrl(props.drop.itemName, props.drop.slot)
  const perPerson = share > 1 ? Math.floor(meso / share) : 0

  function pressKey(key: (typeof KEYS)[number]): void {
    if (key === 'del') {
      setMeso((prev) => Math.floor(prev / 10))
      return
    }
    setMeso((prev) => {
      const next = Number(`${prev}${key}`)
      return Number.isFinite(next) && next <= MAX_MESO ? next : prev
    })
  }

  return (
    <View>
      <View className="px-5">
        <View className="flex-row items-center gap-2.5">
          {props.onBack !== undefined && (
            <Pressable role="button" onPress={props.onBack} aria-label="뒤로" className="-ml-2 shrink-0">
              <ChevronLeftIcon className="h-6 w-6 text-text" aria-hidden />
            </Pressable>
          )}
          {iconUrl !== null ? (
            <Image source={iconUrl} resizeMode="contain" className="h-9 w-9 shrink-0" />
          ) : (
            <View className="h-9 w-9 shrink-0 rounded-lg border border-border bg-surface-2" />
          )}
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[15px] font-bold tracking-[-.012em] text-text">
              {props.drop.itemName}
              {props.drop.ringLevel !== undefined && ` ${props.drop.ringLevel}레벨`}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <DifficultyBadge difficulty={props.difficulty} />
              <Text numberOfLines={1} className="shrink text-[11px] text-text-muted">
                {props.boss} · {props.characterName}
              </Text>
            </View>
          </View>
          {props.progress !== undefined && (
            <Text className="shrink-0 text-xs font-bold text-text-muted" style={TABULAR_NUMS}>
              {props.progress.current} / {props.progress.total}
            </Text>
          )}
        </View>

        {/* 금액 — **자릿수 전체가 주 표기다**([[ADR-124]] 결정 5). 억/만으로 접어 보여줬더니 한 자를
            칠 때마다 `3억` → `32억` → `3억 2,000만` 처럼 단위가 갈아엎여 지금 무엇을 치고 있는지
            읽히지 않았다. 원시 표기는 왼쪽으로 자라기만 하므로 흔들림이 없고, 앱의 다른 금액 표기와도
            같다([[ADR-046]]). 억/만 환산은 자릿수를 눈으로 세지 않게 해 주는 값이라 **보조 줄로**
            남긴다 — 작고 아래에 있으면 갈아엎여도 시선을 흔들지 않는다. */}
        {/* 초기화는 **금액 왼쪽**이다(2026-08-10 사용자 요청). 키패드 자리를 뺏지 않고(⌫ 는 한 자씩
            지우는 별개 동작이라 남는다), 고칠 대상인 숫자 바로 옆이라 겨냥이 자명하다. 값이 0이면
            지울 것이 없으므로 **자리만 지킨다** — 없애면 금액이 좌우로 흔들린다. */}
        <View className="mt-5 flex-row items-center justify-end gap-1.5 border-b border-border pb-1.5">
          <Pressable
            role="button"
            onPress={() => setMeso(0)}
            aria-label="가격 초기화"
            // 웹 `invisible` 의 짝(파일 머리 ④) — RN 에 `visibility` 가 없어 투명도로 대신하고
            // 투명한 버튼이 눌리지 않도록 터치를 함께 끈다.
            pointerEvents={meso === 0 ? 'none' : 'auto'}
            className={`mr-auto h-7 flex-row items-center gap-1 rounded-full border border-border px-2.5 active:bg-surface-2${
              meso === 0 ? ' opacity-0' : ''
            }`}
          >
            <RotateCcwIcon className="h-3 w-3 text-text-muted" strokeWidth={2.5} aria-hidden />
            <Text className="text-[11px] font-semibold text-text-muted">초기화</Text>
          </Pressable>
          <Text
            testID="drop-price-amount"
            className={`text-[32px] font-bold leading-none tracking-[-.03em] ${
              meso === 0 ? 'text-text-disabled' : 'text-text'
            }`}
            style={TABULAR_NUMS}
          >
            {meso.toLocaleString()}
          </Text>
          <Text className="text-sm font-semibold text-text-muted">메소</Text>
        </View>
        {/* 항상 자리를 지킨다 — 0에서 사라지면 첫 타건에 아래가 통째로 밀린다. */}
        <Text
          className="mt-1.5 min-h-4 text-right text-[11px] text-text-muted"
          style={TABULAR_NUMS}
        >
          {meso > 0 ? formatMesoUnits(meso) : ''}
        </Text>

        {/* 다섯 개가 390px 한 줄에 들어가도록 여백·글자를 한 단계 줄였다(px-3 → px-2.5,
            xs → 11px). `flex-wrap` 은 안전장치다 — 더 좁은 기기에서는 넘치는 대신 줄을 바꾼다. */}
        <View className="mt-2 flex-row flex-wrap justify-end gap-1.5">
          {QUICK_ADDS.map((quick) => (
            <Pressable
              key={quick.label}
              role="button"
              onPress={() => setMeso((prev) => Math.min(MAX_MESO, prev + quick.value))}
              className="h-7 justify-center rounded-full border border-border px-2.5 active:bg-surface-2"
            >
              <Text className="text-[11px] font-semibold text-text-muted" style={TABULAR_NUMS}>
                {quick.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 분배 인원 — 스테퍼는 파티 인원 모달과 같은 어휘([[ADR-121]] 결정 7)를 축소한 것이다.
            **`PartySizeStepper` 로 접지 않는다**: 그 molecule 이 정한 두 크기(관리 행 24 · 모달 32)
            중 어느 쪽도 아닌 22px 이고 `Users` 표식이 없다 — 보스 행이 셋째 모양인 것과 같은 사정
            (`BossProfitBossRow` ②)이라 넷째 모양을 만들지 않고 웹처럼 자체 마크업으로 둔다. */}
        <View className="mt-4 flex-row items-center justify-between gap-2.5 border-t border-border pt-3.5">
          <Text className="text-xs font-semibold text-text-muted">분배 인원</Text>
          <View className="h-8 flex-row items-center gap-2.5 rounded-full border border-border px-1.5">
            <Pressable
              role="button"
              onPress={() => setShare((prev) => Math.max(1, prev - 1))}
              disabled={share <= 1}
              aria-label="분배 인원 감소"
              className={`h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2${
                share <= 1 ? ' opacity-40' : ''
              }`}
            >
              <Text className="text-text">−</Text>
            </Pressable>
            <Text className="min-w-[30px] text-center text-[13px] font-semibold text-text" style={TABULAR_NUMS}>
              {share}인
            </Text>
            <Pressable
              role="button"
              onPress={() => setShare((prev) => Math.min(props.maxShare, prev + 1))}
              disabled={share >= props.maxShare}
              aria-label="분배 인원 증가"
              className={`h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2${
                share >= props.maxShare ? ' opacity-40' : ''
              }`}
            >
              <Text className="text-text">+</Text>
            </Pressable>
          </View>
        </View>
        {/* 높이를 항상 차지한다 — 1인일 때 사라지면 그 줄만큼 키패드가 위아래로 튄다. */}
        <Text className="mt-1.5 min-h-4 text-right text-[11px] text-text-muted" style={TABULAR_NUMS}>
          {meso > 0 && share > 1 ? `1인당 ${perPerson.toLocaleString()} 메소` : ''}
        </Text>
      </View>

      {/* 3열 — 간격은 자식 패딩 + 부모 음수 마진(파일 머리 ①). 웹 `gap-0.5`(2px)의 짝이라 자식이
          1px 씩 진다. */}
      <View className="-mx-px flex-row flex-wrap px-3 pt-3">
        {KEYS.map((key) => (
          <View key={key} className="w-1/3 p-px">
            <Pressable
              role="button"
              onPress={() => pressKey(key)}
              aria-label={key === 'del' ? '한 자리 지우기' : key}
              className="h-13 w-full items-center justify-center rounded-[15px] active:bg-surface-2"
            >
              <Text
                className={
                  key === 'del' || key === '00'
                    ? 'text-lg font-medium text-text-muted'
                    : 'text-[23px] font-medium tracking-[-.015em] text-text'
                }
                style={TABULAR_NUMS}
              >
                {key === 'del' ? '⌫' : key}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* **기록 안함**은 "값이 없다"가 아니라 "값을 매기지 않기로 했다"는 결정이라 저장과 같은
          층에 선다. **스킵**은 그 옆의 글자 버튼이다 — 아무것도 저장하지 않고 다음으로만 가므로
          테두리를 주면 결정처럼 보인다([[ADR-124]] 결정 6 정정).
          하단 안전영역은 시트 껍데기가 이미 준다(파일 머리 ②). */}
      <View className="flex-row items-center gap-2 px-4 pb-5 pt-1.5">
        <Pressable
          role="button"
          onPress={props.onExclude}
          className="h-[46px] shrink-0 justify-center rounded-full border border-border px-4"
        >
          <Text className="text-sm font-semibold text-text-muted">기록 안함</Text>
        </Pressable>
        {props.onLater !== undefined && (
          <Pressable role="button" onPress={props.onLater} className="h-[46px] shrink-0 justify-center px-2">
            <Text className="text-sm font-semibold text-text-muted">스킵</Text>
          </Pressable>
        )}
        <Pressable
          role="button"
          onPress={() => props.onSave(meso, share)}
          disabled={meso === 0}
          className={`h-[46px] flex-1 items-center justify-center rounded-full bg-primary${
            meso === 0 ? ' opacity-40' : ''
          }`}
        >
          <Text className="text-[15px] font-bold text-on-primary">
            {props.progress !== undefined ? '다음' : '저장'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

/** 가격 기록 화면에서 띄우는 단독 시트. 드롭 입력 시트 안에서는 위 본문을 드릴다운으로 쓴다. */
export function DropPricePad(props: DropPricePadProps & { onClose: () => void }): React.JSX.Element {
  return (
    <BottomSheet onClose={props.onClose} testId="drop-price-pad">
      <DropPricePadContent {...props} />
    </BottomSheet>
  )
}
