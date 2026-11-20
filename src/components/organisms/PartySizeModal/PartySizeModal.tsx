/**
 * 보스 카드를 탭하면 열리는 파티 인원·난이도 모달.
 *
 * 표시 전용이다. 모드(자동·수동)를 모르고 난이도 선택이 무엇을 뜻하는지도 모른다. 수동
 * 모드에서는 멤버십 교체이고 자동 모드에서는 어느 난이도의 파티 인원을 편집할지 전환인데, 그
 * 차이는 호출부가 핸들러로 정한다. 여기에 모드 분기를 두면 나중에 두 모드를 통합할 때 지워야
 * 할 코드가 된다.
 *
 * 파티 인원은 (보스 + 난이도)에 붙어 있어 난이도를 바꾸면 값과 상한이 함께 갈아탄다
 * (스우: 하드 6인 / 익스트림 2인). 옆의 `최대 n명` 배지가 그 사실을 말한다.
 *
 * 머리는 원형 초상화 · 이름 · 난이도뿐이다. 일러스트 띠를 두었더니 머리가 높아져 모달이 컸다.
 *
 * 분배는 `기본`·`비율`·`제외` 세그먼트로 가른다. 지금 어느 쪽인지가 늘 보여야 해서 스위치가 아니다.
 * `제외` 는 고르기 전 분배를 지우지 않고 숨긴다. 숨긴 분배를 드롭 가격 카드가 처음 값으로 쓴다.
 *
 * **언제 저장할지는 호출부가 정한다.** 인원 · 비율 · 수수료는 고치는 동안 여러 번 바뀌어서, 바뀔 때마다
 * 쓰면 저장과 토스트가 여러 번 일어난다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { vars } from 'nativewind'

import type { BossDifficulty } from '../../../types'

import { Badge, Button, Text, TextInput, XIcon } from '../../atoms'
import { DIFFICULTY_NAME } from '../../../constants/domain/boss-difficulty'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import {
  acceptSharePercentText,
  crystalPayoutMeso,
  sharePercentText,
  sharesFromPercentText,
} from '../../../lib/boss/party-shares'
import { useThemeAppearance } from '../../../theme/context'
import { buildSheetScopeVariables } from '../../../theme/theme-vars'
import { BossPortrait } from '../../molecules/BossPortrait/BossPortrait'
import { DifficultyExpander } from '../../molecules/DifficultyExpander/DifficultyExpander'
import { Stepper } from '../../molecules/Stepper/Stepper'
import { Segment } from '../../molecules/Segment/Segment'
import { FeeRow } from '../FeeRow/FeeRow'
import { Modal } from '../Modal/Modal'
import type { MvpGradeKey } from '../../../lib/mvp/grades'

/** 모달이 다루는 비율 칸 다섯. 저장 칸과 같은 모양이라 옮겨 담을 것이 없다. */
export interface PartyModalShares {
  crystalMyShare: number | null
  crystalSharesTotal: number | null
  splitFeePercent: number | null
  /** 송금 수수료가 등급을 따라가나. 적용하면 요율은 그 등급 요율로 나간다 */
  splitFeeAuto?: boolean
  /** 분배 방식 `제외`. 위 칸들은 숨겨 둔 분배다 */
  crystalExcluded?: boolean
}

/**
 * 고를 수 있는 송금 수수료. `0%` 는 **경매장을 안 거치는 약속**이다(그때는 차액을 그대로 보낸다).
 *
 * 글자가 곧 값이다. `Segment` 가 문자열만 받아서 읽을 때 `%` 를 뗀다.
 */
const FEE_OPTIONS = ['0%', '3%', '5%'] as const

/**
 * 비율로 갈아탈 때 놓이는 값. **`2 / 3`(66.667%)** 이다.
 *
 * 반반으로 두면 2인 균등과 한 메소도 안 다른 값이라, 비율을 켜 놓고 아무것도 안 고른
 * 상태가 켜기 전과 같아진다. 저장 칸에도 2 · 3 그대로 들어가 정확한 2/3 으로 센다.
 */
const SEED_SHARES = { myShare: 2, sharesTotal: 3 }

/** 분배를 가르는 세 조각. 글자가 곧 상태다. */
const SPLIT_OPTIONS = ['기본', '비율', '제외'] as const

/** 비율을 끄면 칸을 전부 비운다. 균등으로 되돌리는 길이 이것 하나다. */
const NO_SHARES: PartyModalShares = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
}

/** 칸에 적을 % 글자. 비율이 없으면 비율로 갈아탈 때 놓일 값이다. */
function percentTextOf(shares: PartyModalShares): string {
  return sharePercentText(
    shares.crystalMyShare ?? SEED_SHARES.myShare,
    shares.crystalSharesTotal ?? SEED_SHARES.sharesTotal,
  )
}

export function PartySizeModal(props: {
  bossName: string
  portraitAssetId: string | null
  difficulties: BossDifficulty[]
  /** 지금 고른 난이도. 바뀌면 인원과 비율이 그 난이도의 저장값으로 갈아탄다. */
  difficulty: BossDifficulty
  partySize: number
  maxPartySize: number
  /** 이 난이도에 저장돼 있는 비율. `null` 칸은 균등이다. */
  shares: PartyModalShares
  /**
   * `받는 금액` 을 셀 결정석 가격. 어느 가격인지는 연 곳이 정한다(기록의 가격 · 그 기간의 가격 표).
   * 모르면 `null` 이고 그 줄을 안 그린다. 0 메소로 적으면 받는 돈이 없는 것처럼 읽힌다.
   */
  crystalPriceMeso?: number | null
  /**
   * 송금 수수료 `자동` 의 명패와 요율. 설정 자리는 이번 주 등급, 보스 수익 행은 그 기록 날짜의 등급을 넘긴다.
   * 모르면 `null` 이라 값 자리가 빈다.
   */
  autoFee?: { grade: MvpGradeKey; percent: number } | null
  /**
   * 난이도를 골랐다. **저장하지 않는다.** 호출부는 자기 모달 상태만 옮겨 인원·상한·비율
   * 프롭을 그 난이도 것으로 바꿔 주고, 쓰는 일은 `onApply` 에서 한다.
   *
   * 안 주면 고르개 대신 난이도 배지만 선다. 행이 난이도를 정하는 곳에서 연 모달이다.
   */
  onSelectDifficulty?: (difficulty: BossDifficulty) => void
  /** 적용을 눌렀다. 이때 처음 값이 밖으로 나간다. 모달은 자기가 닫히는지 모른다. */
  onApply: (next: { partySize: number; shares: PartyModalShares }) => void
  /** 닫았다(X · 바깥 탭 · 뒤로가기). **고친 값은 버린다.** */
  onClose: () => void
}): React.JSX.Element {
  /** 고치는 중인 값. 적용을 누를 때까지 밖으로 안 나간다. */
  const [draft, setDraft] = useState({ partySize: props.partySize, shares: props.shares })
  /**
   * % 칸의 글자. 비율과 따로 든다. `33.` 처럼 치는 중인 글자는 비율로 못 옮기지만 칸에는 남아야 한다.
   * 비율은 글자가 받을 수 있는 값이 될 때마다 따라간다.
   */
  const [percentText, setPercentText] = useState(() => percentTextOf(props.shares))
  /** % 를 치는 중인가. 키보드가 가운데의 모달을 덮지 않게 그동안 모달을 위로 올린다. */
  const [typing, setTyping] = useState(false)
  /**
   * 초안을 어느 난이도에서 떴나.
   *
   * 난이도를 바꾸면 값이 통째로 갈아탄다(스우 하드 6인 · 익스트림 2인). 그 난이도의 저장값으로
   * 다시 뜨고 안 적용한 편집은 버린다. 적용은 한 난이도에만 걸리므로 옛 난이도의 편집은 갈 곳이
   * 없다.
   */
  const [seededAt, setSeededAt] = useState(props.difficulty)
  if (seededAt !== props.difficulty) {
    setSeededAt(props.difficulty)
    setDraft({ partySize: props.partySize, shares: props.shares })
    setPercentText(percentTextOf(props.shares))
  }

  function setShares(next: PartyModalShares): void {
    setDraft((prev) => ({ ...prev, shares: next }))
  }

  const usesShares = draft.shares.crystalSharesTotal !== null
  const excluded = draft.shares.crystalExcluded === true
  const splitFeePercent = draft.shares.splitFeePercent ?? 3
  const splitFeeAuto = draft.shares.splitFeeAuto === true
  const autoFee = props.autoFee ?? null
  /** 금액을 셀 송금 수수료. 자동이면 그 등급 요율이고, 적용도 이 값을 내보낸다. */
  const effectiveFeePercent = splitFeeAuto ? (autoFee?.percent ?? draft.shares.splitFeePercent) : draft.shares.splitFeePercent
  const priceMeso = props.crystalPriceMeso ?? null
  const payoutMeso =
    priceMeso === null || excluded
      ? null
      : crystalPayoutMeso(priceMeso, draft.partySize, {
          myShare: draft.shares.crystalMyShare,
          sharesTotal: draft.shares.crystalSharesTotal,
          splitFeePercent: effectiveFeePercent,
        })

  // 판이 다른 가운데 모달과 같은 표면이다. 다크에서는 표면을 한 칸 올린 값이다.
  const { definition } = useThemeAppearance()
  const panelScope = buildSheetScopeVariables(definition)

  function changePercent(next: string): void {
    const text = acceptSharePercentText(percentText, next)
    setPercentText(text)
    const parsed = sharesFromPercentText(text)
    if (parsed === null) return
    setShares({ ...draft.shares, crystalMyShare: parsed.myShare, crystalSharesTotal: parsed.sharesTotal })
  }

  return (
    // 가운데에 둔다. % 를 치는 동안만 위로 올린다. 가운데에 두면 키보드가 받는 금액과 적용을 덮는다.
    <Modal onClose={props.onClose} align={typing ? 'top' : 'center'} testId="party-size-modal">
      {/* 폭 320. `max-w-xs` 는 못박은 값이라 360 기기에서도 폭이 같다. */}
      <Modal.Panel maxWidth="max-w-xs">
        {/* 변수는 바깥 층에서 다시 선언하고 색은 안쪽 층이 칠한다. 같은 층이면 옛 값으로 풀린다. */}
        <View style={vars(panelScope)}>
          <View testID="party-size-panel" className="overflow-hidden rounded-[14px] bg-surface">
            <View className="flex-row items-start gap-3 pl-4 pr-1.5 pt-4">
              <BossPortrait portraitAssetId={props.portraitAssetId} label={props.bossName} size={40} />
              {/*
                이름 아래에 난이도를 둔다. 이름 옆에 두면 난이도가 넷인 보스(감시자 칼로스 등)의 고르개가
                펼칠 때 판 폭을 넘어 잘린다.
              */}
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-base font-bold tracking-[-.02em] text-text">{props.bossName}</Text>
                {props.onSelectDifficulty === undefined ? (
                  <View className="self-start">
                    <Badge variant={props.difficulty}>{DIFFICULTY_NAME[props.difficulty]}</Badge>
                  </View>
                ) : (
                  <DifficultyExpander
                    label={props.bossName}
                    difficulties={props.difficulties}
                    value={props.difficulty}
                    onChange={props.onSelectDifficulty}
                  />
                )}
              </View>
              {/* 다른 모달의 닫기와 같은 상자·같은 아이콘이다(`InputCard`: 44 · `h-5`). */}
              <Pressable
                testID="party-size-modal-close"
                role="button"
                onPress={props.onClose}
                aria-label="닫기"
                className="-mt-2.5 h-11 w-11 items-center justify-center"
              >
                <XIcon className="h-5 w-5 text-text-muted" aria-hidden />
              </Pressable>
            </View>

            {/* 줄은 바탕 카드 없이 판 위에 바로 놓고 간격으로 가른다. 드롭 가격 카드와 같은 짜임이다. */}
            <View className="gap-3.5 p-4">
              <View className="flex-row items-center justify-between gap-2.5">
                <Text className="text-xs font-bold text-text">분배 방식</Text>
                <Segment
                  options={SPLIT_OPTIONS}
                  selected={excluded ? '제외' : usesShares ? '비율' : '기본'}
                  size="md"
                  onSelect={(option) => {
                    if (option === '제외') {
                      setShares({ ...draft.shares, crystalExcluded: true })
                      return
                    }
                    if (option === '기본') {
                      setShares(NO_SHARES)
                      return
                    }
                    // `제외` 로 숨겨 둔 비율이 있으면 그대로 돌아온다.
                    if (usesShares) {
                      setShares({ ...draft.shares, crystalExcluded: false })
                      return
                    }
                    setPercentText(sharePercentText(SEED_SHARES.myShare, SEED_SHARES.sharesTotal))
                    setShares({
                      crystalMyShare: SEED_SHARES.myShare,
                      crystalSharesTotal: SEED_SHARES.sharesTotal,
                      // 비율로 바꿀 때 송금 수수료는 자동으로 시작한다(내 등급 요율).
                      splitFeePercent: null,
                      splitFeeAuto: true,
                    })
                  }}
                />
              </View>

              {excluded ? null : usesShares ? (
                <>
                  <View className="flex-row items-center gap-1">
                    <Text className="flex-1 text-xs tracking-[.04em] text-text-muted">결정석</Text>
                    {/*
                      바탕 없는 숫자다(알약 바탕을 두지 않는다). 누르면 소수점 키로 친다. 칸이 비거나 `33.` 처럼
                      비율로 못 옮기는 글자로 끝나면 마지막으로 받은 비율로 되돌려 적는다.
                    */}
                    <TextInput
                      testID="party-share-percent"
                      aria-label="결정석 내 몫"
                      value={percentText}
                      onChangeText={changePercent}
                      onFocus={() => setTyping(true)}
                      onBlur={() => {
                        setTyping(false)
                        if (sharesFromPercentText(percentText) === null) setPercentText(percentTextOf(draft.shares))
                      }}
                      keyboardType="decimal-pad"
                      className="h-[25px] min-w-[44px] text-right text-lg font-semibold text-text"
                      style={TABULAR_NUMS}
                    />
                    <Text className="text-xs text-text-muted">%</Text>
                  </View>

                  <FeeRow
                    variant="compact"
                    label="수수료"
                    auto={splitFeeAuto}
                    onAutoChange={(auto) =>
                      // 끄는 순간 방금까지 자동이던 요율을 고른 채 선다.
                      setShares({
                        ...draft.shares,
                        splitFeeAuto: auto,
                        splitFeePercent: !auto && autoFee !== null ? autoFee.percent : draft.shares.splitFeePercent,
                      })
                    }
                    autoFee={autoFee}
                    options={FEE_OPTIONS}
                    selected={`${splitFeePercent}%` as (typeof FEE_OPTIONS)[number]}
                    onSelect={(option) =>
                      setShares({ ...draft.shares, splitFeeAuto: false, splitFeePercent: Number.parseInt(option, 10) })
                    }
                  />
                </>
              ) : (
                /* 상한은 (보스 · 난이도)마다 다르다. 스테퍼는 그 수를 못 말하므로 배지가 옆에서
                   말한다. */
                <View className="flex-row items-center justify-between gap-2.5">
                  <View className="flex-row items-center gap-2">
                    {/* 줄 높이를 글꼴 자연 상자(12 × 1.19 ≈ 14)에 붙인다. 기본 17 이면 iOS 에서 글자가 3px
                        내려앉고 옆의 배지만 위로 붙어 보인다. */}
                    <Text className="text-xs leading-[14px] tracking-[.04em] text-text-muted">
                      파티 인원
                    </Text>
                    <Badge variant="primary" size="xs" style={TABULAR_NUMS}>
                      최대 {props.maxPartySize}명
                    </Badge>
                  </View>
                  <Stepper
                    label={`${props.bossName} 파티원 수`}
                    value={draft.partySize}
                    max={props.maxPartySize}
                    onChange={(next) => setDraft((prev) => ({ ...prev, partySize: next }))}
                  />
                </View>
              )}

              {payoutMeso !== null && (
                // 받는 금액 줄 앞은 다른 줄 사이(14)보다 2 넓다. 고르는 줄들과 결과를 가른다.
                <View className="mt-0.5 flex-row items-baseline justify-between px-0.5">
                  <Text className="text-xs text-text-muted">받는 금액</Text>
                  <Text testID="party-payout" className="text-lg font-bold text-text" style={TABULAR_NUMS}>
                    {payoutMeso.toLocaleString()}
                    <Text className="text-xs font-normal text-text-muted"> 메소</Text>
                  </Text>
                </View>
              )}

              {/* 으뜸 동작. 다른 모달(`NoticeModal`)과 같은 `Button` atom · 같은 전폭이다. */}
              <Button
                variant="primary"
                testID="party-size-modal-apply"
                onPress={() =>
                  props.onApply(
                    // 자동이면 요율은 그 등급 요율로 내보낸다. 보스 수익 행이 이 값으로 그 기록을 다시 센다.
                    splitFeeAuto ? { ...draft, shares: { ...draft.shares, splitFeePercent: effectiveFeePercent } } : draft,
                  )
                }
                className="mt-1 w-full items-center"
              >
                적용
              </Button>
            </View>
          </View>
        </View>
      </Modal.Panel>
    </Modal>
  )
}
