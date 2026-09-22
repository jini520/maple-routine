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
 * 머리는 **일러스트가 오른쪽에서 흘러들고 글자는 전부 왼쪽**이다. 그림이 글자 뒤로 안 가서
 * 베일로 눌러 읽히게 할 일이 없고, 그래서 이름을 크게 쓸 자리가 난다. 난이도도 머리에 서서
 * 본문은 분배 하나만 든다.
 *
 * 분배는 `균등`·`비율` 세그먼트로 가른다. 지금 어느 쪽인지가 늘 보여야 해서 스위치가 아니다.
 *
 * **언제 저장할지는 호출부가 정한다.** 비율은 끌기 한 번에 값이 여러 번 바뀌어서, 바뀔 때마다
 * 쓰면 한 몸짓이 저장 아홉 번이 된다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { getBossPortraitModalCrop, getBossPortraitUrl } from '../../../lib/assets/asset-lookup'
import type { BossDifficulty } from '../../../types'

import { StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'

import { Badge, Button, Text, XIcon } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { useThemeAppearance } from '../../../theme/context'
import { DifficultySegment } from '../../molecules/DifficultySegment/DifficultySegment'
import { FadedIllustration } from '../../molecules/FadedIllustration/FadedIllustration'
import { PartySizeStepper } from '../../molecules/PartySizeStepper/PartySizeStepper'
import { Segment } from '../../molecules/Segment/Segment'
import { ShareField } from '../../molecules/ShareField/ShareField'
import { FeeRow } from '../FeeRow/FeeRow'
import { Modal } from '../Modal/Modal'
import type { MvpGradeKey } from '../../../lib/mvp/grades'

/** 모달이 다루는 비율 칸 다섯. 저장 칸과 같은 모양이라 옮겨 담을 것이 없다. */
export interface PartyModalShares {
  crystalMyShare: number | null
  crystalSharesTotal: number | null
  dropMyShare: number | null
  dropSharesTotal: number | null
  splitFeePercent: number | null
  /** 송금 수수료가 등급을 따라가나. 적용하면 요율은 그 등급 요율로 나간다 */
  splitFeeAuto?: boolean
}

/**
 * 고를 수 있는 송금 수수료. `0%` 는 **경매장을 안 거치는 약속**이다(그때는 차액을 그대로 보낸다).
 *
 * 글자가 곧 값이다. `Segment` 가 문자열만 받아서 읽을 때 `%` 를 뗀다.
 */
const FEE_OPTIONS = ['0%', '3%', '5%'] as const


/**
 * 비율로 갈아탈 때 놓이는 값. **`2 : 1`(66.7%)** 이다.
 *
 * 반반(`1 : 2`)으로 두면 2인 균등과 한 메소도 안 다른 값이라, 비율을 켜 놓고 아무것도 안 고른
 * 상태가 켜기 전과 같아진다. 고르개를 세워 놓고 뜻이 없는 자리다.
 */
const SEED_SHARES = { myShare: 2, sharesTotal: 3 }

/** 분배를 가르는 두 조각. 글자가 곧 상태다. */
const SPLIT_OPTIONS = ['기본', '비율'] as const

/**
 * 그림이 서는 띠의 폭.
 *
 * **흐림이 어디서 시작할 수 있는지를 이 수가 정한다.** 그림은 띠 왼쪽 끝에서 판 표면색과 같아져야
 * 하므로, 띠가 좁으면 흐림이 그만큼 오른쪽에서 시작한다. 170 에서는 판 한가운데를 못 벗어났다.
 *
 * 크롭 표(`boss-portrait-modal-crops.json`)의 `N% auto` 가 이 폭 기준이다. 여기를 바꾸면 그림
 * 크기가 같은 비율로 따라 변하므로 표도 함께 봐야 한다.
 */
const ART_WIDTH = 240

/** 베일 셋의 id. SVG `url(#…)` 참조라 한 문서 안에서 겹치면 안 된다. */
const VEIL_H = 'party-art-veil-h'
const VEIL_V = 'party-art-veil-v'
const VEIL_CORNER = 'party-art-veil-corner'

/** 띠 위에서의 그림 밝기. 글자가 그림 위에 안 앉아 카드 기본(0.65)보다 살려 둔다. */
const ART_OPACITY = 0.8

/** 비율을 끄면 칸을 전부 비운다. 균등으로 되돌리는 길이 이것 하나다. */
const NO_SHARES: PartyModalShares = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  dropMyShare: null,
  dropSharesTotal: null,
  splitFeePercent: null,
}

/** 비율 고르개 한 장. 좁은 자리라 합이 트랙 아래 가운데에 선다. */
function ShareCard(props: {
  label: string
  value: { myShare: number; sharesTotal: number }
  onChange: (next: { myShare: number; sharesTotal: number }) => void
}): React.JSX.Element {
  return (
    // 칠이 `surface-2` 가 아니라 `bg` 다. 라이트에서 판(L .985)과 `surface-2`(L .90)의 단차가
    // 커 카드가 탁해 보였다(사용자 지적). `bg`(L .95)는 단차가 절반이고 채도도 낮다. 다크에서는
    // 판(L .20)보다 어두워져 파인 자리가 된다.
    <View className="flex-1 rounded-[12px] bg-bg px-3 pb-3 pt-[11px]">
      <ShareField label={props.label} value={props.value} layout="stacked" onChange={props.onChange} />
    </View>
  )
}

export function PartySizeModal(props: {
  bossName: string
  /** 히어로의 키커. '주간 보스' / '월간 보스'. */
  cycleLabel: string
  portraitSlug: string | null
  difficulties: BossDifficulty[]
  /** 지금 고른 난이도. 바뀌면 인원과 비율이 그 난이도의 저장값으로 갈아탄다. */
  difficulty: BossDifficulty
  partySize: number
  maxPartySize: number
  /** 이 난이도에 저장돼 있는 비율. `null` 칸은 균등이다. */
  shares: PartyModalShares
  /**
   * 송금 수수료 `자동` 의 명패와 요율. 설정 자리는 이번 주 등급, 보스 수익 행은 그 기록 날짜의 등급을 넘긴다.
   * 모르면 `null` 이라 값 자리가 빈다.
   */
  autoFee?: { grade: MvpGradeKey; percent: number } | null
  /**
   * 난이도를 골랐다. **저장하지 않는다.** 호출부는 자기 모달 상태만 옮겨 인원·상한·비율
   * 프롭을 그 난이도 것으로 바꿔 주고, 쓰는 일은 `onApply` 에서 한다.
   */
  onSelectDifficulty: (difficulty: BossDifficulty) => void
  /** 적용을 눌렀다. 이때 처음 값이 밖으로 나간다. 모달은 자기가 닫히는지 모른다. */
  onApply: (next: { partySize: number; shares: PartyModalShares }) => void
  /** 닫았다(X · 바깥 탭 · 뒤로가기). **고친 값은 버린다.** */
  onClose: () => void
}): React.JSX.Element {
  /** 고치는 중인 값. 적용을 누를 때까지 밖으로 안 나간다. */
  const [draft, setDraft] = useState({ partySize: props.partySize, shares: props.shares })
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
  }

  function setShares(next: PartyModalShares): void {
    setDraft((prev) => ({ ...prev, shares: next }))
  }

  const usesShares = draft.shares.crystalSharesTotal !== null
  const crystal = {
    myShare: draft.shares.crystalMyShare ?? SEED_SHARES.myShare,
    sharesTotal: draft.shares.crystalSharesTotal ?? SEED_SHARES.sharesTotal,
  }
  const drop = {
    myShare: draft.shares.dropMyShare ?? SEED_SHARES.myShare,
    sharesTotal: draft.shares.dropSharesTotal ?? SEED_SHARES.sharesTotal,
  }
  const splitFeePercent = draft.shares.splitFeePercent ?? 3
  const splitFeeAuto = draft.shares.splitFeeAuto === true
  const autoFee = props.autoFee ?? null

  // 그림이 판 위에 바로 앉는다. 덧칠할 색이 `mediaSurface` 가 아니라 판의 `surface` 다.
  const { definition } = useThemeAppearance()
  const surface = definition.surface

  const portraitUrl = getBossPortraitUrl(props.portraitSlug)
  // **띠 전용 표다**(`boss-portrait-modal-crops.json`). 카드 표와 갈라 둔 것은 띠가 카드보다 좁고
  // 높아 같은 값이 다른 구도를 내기 때문이고, 한 표를 같이 쓰면 여기를 맞출 때마다 카드가 움직인다.
  const crop = getBossPortraitModalCrop(props.portraitSlug)

  return (
    // align="center": 이 모달은 키보드를 띄우지 않는다(`Modal` 기본은 'top').
    // Modal.Panel: 일러스트가 모서리까지 가야 해서 카드 껍데기(p-6)를 쓰지 않고 직접 두른다.
    <Modal onClose={props.onClose} align="center" testId="party-size-modal">
      {/* 폭 320. 일러스트 띠와 카드 둘이 나란히 서려면 288 로는 트랙이 안 남는다.
          `max-w-xs` 는 못박은 값이라 360 기기에서도 폭이 같다. */}
      <Modal.Panel maxWidth="max-w-xs">
        {/* 스크림 위 테두리 톤다운을 이 View 가 직접 쓴다. RN 에는 `.panel-on-scrim-parent > *`
            짝이 없다. */}
        <View className="overflow-hidden rounded-[14px] border border-panel-border bg-surface">
          <View className="relative h-[104px] overflow-hidden">
            {/* 그림이 오른쪽 띠에만 선다. 감싸는 View 가 크기를 가진 절대 상자라 안쪽의
                `absolute inset-0` 이 그 띠를 기준으로 풀린다.

                **`overflow-hidden` 이 필수다.** 크롭은 이미지를 상자보다 크게 그려 창을 옮기는
                방식이라, 안 자르면 남는 부분이 띠 밖으로 흘러 글자를 덮는다. 베일은 띠 안만
                덮으므로 그 부분은 생그림 사각형으로 남는다(실기기에서 드러났다). */}
            <View
              testID="party-modal-art"
              pointerEvents="none"
              className="absolute inset-y-0 right-0 overflow-hidden"
              style={{ width: ART_WIDTH }}
            >
              <FadedIllustration source={portraitUrl} crop={crop} veil={false} opacity={ART_OPACITY} />

              {/* 베일 셋을 겹친다. **가로와 세로는 직선**이고, 둘이 만나는 왼쪽 아래
                  모서리만 둥글게 깎는다.

                  타원 하나로 덮어 봤더니 위·오른쪽까지 휘어 어색했다(사용자 지적). 직선 둘만
                  겹치면 이번엔 그 모서리가 각지게 접힌다. 셋째가 그 자리만 메운다.

                  겹치는 순서는 상관없다. 알파가 `1-(1-가로)(1-세로)(1-모서리)` 로 쌓여서 어느
                  하나가 다 덮으면 그 자리는 판 표면색이다.

                  **왼쪽 끝과 아래 끝은 완전히 덮여야 한다.** 덜 덮이면 띠가 끝나는 자리에
                  이음선이 남는다. 글자 자리(판 왼쪽 155)에 옅게 깔리는 것은 감수한 것이다. */}
              <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Defs>
                  {/* 가로. 왼쪽 5% 부터 완전히 덮고 58% 에서 걷힌다. */}
                  <LinearGradient id={VEIL_H} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0.05" stopColor={surface} stopOpacity={1} />
                    <Stop offset="0.58" stopColor={surface} stopOpacity={0} />
                  </LinearGradient>
                  {/* 세로. 머리와 본문 사이에 선이 없어 그림이 본문으로 그대로 이어진다. */}
                  <LinearGradient id={VEIL_V} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.55" stopColor={surface} stopOpacity={0} />
                    <Stop offset="1" stopColor={surface} stopOpacity={1} />
                  </LinearGradient>
                  {/* 모서리. 왼쪽 아래 귀퉁이에서만 퍼져 각진 접힘을 깎는다. */}
                  <RadialGradient id={VEIL_CORNER} cx="0%" cy="100%" rx="34%" ry="30%">
                    <Stop offset="0" stopColor={surface} stopOpacity={1} />
                    <Stop offset="1" stopColor={surface} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${VEIL_H})`} />
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${VEIL_V})`} />
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${VEIL_CORNER})`} />
              </Svg>
            </View>

            {/* 다른 모달의 닫기와 같은 상자·같은 아이콘이다(`InputCard`: 44 · `h-5`). 칠한 원을
                안 두르는 것도 그쪽과 같다. 그림이 이 자리까지 안 올라와 눌러 줄 일이 없다. */}
            <Pressable
              testID="party-size-modal-close"
              role="button"
              onPress={props.onClose}
              aria-label="닫기"
              className="absolute right-1.5 top-1.5 h-11 w-11 items-center justify-center"
            >
              <XIcon className="h-5 w-5 text-text-muted" aria-hidden />
            </Pressable>

            {/* 글자는 전부 왼쪽이다. 그림 위에 안 앉으므로 그림자를 안 쓴다. */}
            <View className="absolute left-4 top-4 gap-1.5">
              <Text className="text-10 font-bold tracking-[.16em] text-text-muted">{props.cycleLabel}</Text>
              <Text className="text-22 font-bold tracking-[-.02em] text-text">{props.bossName}</Text>
              <DifficultySegment
                difficulties={props.difficulties}
                selected={props.difficulty}
                onSelect={props.onSelectDifficulty}
              />
            </View>
          </View>

          <View className="gap-3.5 p-4">
            <View className="flex-row items-center justify-between gap-2.5">
              <Text className="text-13 font-bold text-text">분배 방식</Text>
              <Segment
                options={SPLIT_OPTIONS}
                selected={usesShares ? '비율' : '기본'}
                size="md"
                fixed
                onSelect={(option) =>
                  setShares(
                    option === '기본'
                      ? NO_SHARES
                      : {
                          crystalMyShare: SEED_SHARES.myShare,
                          crystalSharesTotal: SEED_SHARES.sharesTotal,
                          dropMyShare: SEED_SHARES.myShare,
                          dropSharesTotal: SEED_SHARES.sharesTotal,
                          // 비율로 바꿀 때 송금 수수료는 자동으로 시작한다(내 등급 요율).
                          splitFeePercent: null,
                          splitFeeAuto: true,
                        },
                  )
                }
              />
            </View>

            {usesShares ? (
              <>
                {/* 카드 둘이 좌우로 선다. 위아래로 쌓으면 같은 고르개가 두 번 포개져 판이
                    그만큼 길어진다. */}
                <View className="flex-row gap-2.5">
                  <ShareCard
                    label="결정석"
                    value={crystal}
                    onChange={(next) =>
                      setShares({
                        ...draft.shares,
                        crystalMyShare: next.myShare,
                        crystalSharesTotal: next.sharesTotal,
                      })
                    }
                  />
                  <ShareCard
                    label="아이템"
                    value={drop}
                    onChange={(next) =>
                      setShares({
                        ...draft.shares,
                        dropMyShare: next.myShare,
                        dropSharesTotal: next.sharesTotal,
                      })
                    }
                  />
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
                  {/* 줄 높이를 글꼴 자연 상자(11 × 1.19 ≈ 13)에 붙인다. `text-11` 의 기본 16 은
                      iOS 에서 남는 여유가 전부 글자 **위**로 가서(기준선이 `줄높이 − descent`)
                      글자가 3px 내려앉고, 옆의 배지만 위로 붙어 보인다. */}
                  <Text className="text-11 font-semibold leading-[14px] tracking-[.04em] text-text-muted">
                    파티 인원
                  </Text>
                  <Badge variant="primary" size="mini" style={TABULAR_NUMS}>
                    최대 {props.maxPartySize}명
                  </Badge>
                </View>
                <PartySizeStepper
                  size="compact"
                  label={props.bossName}
                  value={draft.partySize}
                  max={props.maxPartySize}
                  onChange={(next) => setDraft((prev) => ({ ...prev, partySize: next }))}
                />
              </View>
            )}

            {/* 으뜸 동작. 다른 모달(`NoticeModal`)과 같은 `Button` atom · 같은 전폭이다.
                위 여백이 고치는 자리와 끝내는 자리를 가른다. */}
            <Button
              variant="primary"
              testID="party-size-modal-apply"
              onPress={() =>
                props.onApply(
                  // 자동이면 요율은 그 등급 요율로 내보낸다. 보스 수익 행이 이 값으로 그 기록을 다시 센다.
                  splitFeeAuto
                    ? { ...draft, shares: { ...draft.shares, splitFeePercent: autoFee?.percent ?? draft.shares.splitFeePercent } }
                    : draft,
                )
              }
              className="mt-1 w-full items-center"
            >
              적용
            </Button>
          </View>
        </View>
      </Modal.Panel>
    </Modal>
  )
}
