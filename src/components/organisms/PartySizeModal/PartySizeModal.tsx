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

import { getBossPortraitCrop, getBossPortraitUrl } from '../../../lib/assets/asset-lookup'
import type { BossDifficulty } from '../../../types'
import type { ImageCrop } from '../../../lib/image-crop'

import { StyleSheet } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { Badge, Button, Text, XIcon } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { useThemeAppearance } from '../../../theme/context'
import { DifficultySegment } from '../../molecules/DifficultySegment/DifficultySegment'
import { FadedIllustration } from '../../molecules/FadedIllustration/FadedIllustration'
import { PartySizeStepper } from '../../molecules/PartySizeStepper/PartySizeStepper'
import { Segment } from '../../molecules/Segment/Segment'
import { ShareField } from '../../molecules/ShareField/ShareField'
import { Modal } from '../Modal/Modal'

/** 모달이 다루는 비율 칸 다섯. 저장 칸과 같은 모양이라 옮겨 담을 것이 없다. */
export interface PartyModalShares {
  crystalMyShare: number | null
  crystalSharesTotal: number | null
  dropMyShare: number | null
  dropSharesTotal: number | null
  splitFeePercent: number | null
}

/**
 * 고를 수 있는 송금 수수료. `0%` 는 **경매장을 안 거치는 약속**이다(그때는 차액을 그대로 보낸다).
 *
 * 글자가 곧 값이다. `Segment` 가 문자열만 받아서 읽을 때 `%` 를 뗀다.
 */
const FEE_OPTIONS = ['0%', '3%', '5%'] as const


/** 비율로 갈아탈 때 놓이는 값. 반반이라 아무것도 약속하지 않은 상태에서 시작한다. */
const SEED_SHARES = { myShare: 1, sharesTotal: 2 }

/** 분배를 가르는 두 조각. 글자가 곧 상태다. */
const SPLIT_OPTIONS = ['균등', '비율'] as const

/**
 * 그림이 서는 띠의 폭.
 *
 * **흐림이 어디서 시작할 수 있는지를 이 수가 정한다.** 그림은 띠 왼쪽 끝에서 판 표면색과 같아져야
 * 하므로, 띠가 좁으면 흐림이 그만큼 오른쪽에서 시작한다. 170 에서는 판 한가운데를 못 벗어났다.
 */
const ART_WIDTH = 240

/** 보스 카드에서 그림이 그려지는 폭. 390 기기의 카드 폭이다. */
const CARD_IMAGE_WIDTH = 358

/**
 * 카드 크롭 표를 이 띠로 옮기는 배수.
 *
 * **표의 `N% auto` 는 그것이 앉은 상자의 폭 기준이다.** 358px 보스 카드에서 358px 로 그려지던
 * 그림이 좁은 띠에서는 그만큼 작아진다. 표를 그대로 넣었더니 보스가 절반 크기로 섰다. 두 자리에서
 * 같은 크기로 보이려면 이 배수를 얹어야 하고, **띠 폭을 바꾸면 배수가 따라와야 한다**.
 *
 * 세로 자리(`position`)는 안 건드린다. 그쪽은 비율이라 상자 크기와 무관하다.
 */
const CARD_WIDTH_RATIO = CARD_IMAGE_WIDTH / ART_WIDTH

/** 카드 표 한 줄을 띠 크기로. 읽을 수 없는 줄은 그대로 보내 `cover` 로 떨어지게 둔다. */
export function stripCrop(crop: ImageCrop): ImageCrop {
  const width = Number.parseFloat(crop.size)
  if (!Number.isFinite(width)) return crop
  return { size: `${Math.round(width * CARD_WIDTH_RATIO)}% auto`, position: crop.position }
}

/** 타원 베일의 id. SVG `url(#…)` 참조라 한 문서 안에서 겹치면 안 된다. */
const VEIL_ID = 'party-art-veil'

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
    <View className="flex-1 rounded-[12px] bg-surface-2 px-3 pb-3 pt-[11px]">
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

  // 그림이 판 위에 바로 앉는다. 덧칠할 색이 `mediaSurface` 가 아니라 판의 `surface` 다.
  const { definition } = useThemeAppearance()
  const surface = definition.surface

  const portraitUrl = getBossPortraitUrl(props.portraitSlug)
  // **보스 카드와 같은 표다**(`boss-portrait-crops.json`). 보스마다 사람이 맞춰 둔 값이라 한 보스에
  // 맞춘 고정값보다 낫고, 두 자리가 같은 그림을 같은 구도로 말한다. 띠가 카드보다 좁아 배수만 얹는다.
  const crop = stripCrop(getBossPortraitCrop(props.portraitSlug))

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

              {/* **타원 하나로 덮는다.** 가로와 세로를 직선 둘로 나눠 덮으면 둘이 만나는 왼쪽
                  아래 모서리에 꺾인 자국이 남는다(사용자 지적).

                  중심이 얼굴 쪽(오른쪽 위)이고 거기서 사방으로 퍼진다. `rx` 가 `cx` 보다 작아
                  **띠 왼쪽 끝에서 다 덮인다** - 덜 덮이면 띠가 끝나는 자리에 세로 이음선이
                  남는다. 위·오른쪽은 반지름 안이라 그림이 모서리까지 나간다.

                  글자 자리(판 왼쪽 155)에는 그림이 옅게 깔린다. 흐림을 판 한가운데보다 왼쪽에서
                  시작하게 하려면 피할 수 없고, 거기 남는 농도는 20% 아래다. */}
              <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient id={VEIL_ID} cx="72%" cy="24%" rx="66%" ry="62%">
                    <Stop offset="0" stopColor={surface} stopOpacity={0} />
                    {/* 여기까지가 선명한 자리. 이 수를 올리면 흐림이 왼쪽에서 시작한다. */}
                    <Stop offset="0.33" stopColor={surface} stopOpacity={0} />
                    <Stop offset="1" stopColor={surface} stopOpacity={1} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${VEIL_ID})`} />
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
              <Text className="text-13 font-bold text-text">분배</Text>
              <Segment
                options={SPLIT_OPTIONS}
                selected={usesShares ? '비율' : '균등'}
                size="md"
                fixed
                onSelect={(option) =>
                  setShares(
                    option === '균등'
                      ? NO_SHARES
                      : {
                          crystalMyShare: SEED_SHARES.myShare,
                          crystalSharesTotal: SEED_SHARES.sharesTotal,
                          dropMyShare: SEED_SHARES.myShare,
                          dropSharesTotal: SEED_SHARES.sharesTotal,
                          splitFeePercent: 3,
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

                <View className="flex-row items-center justify-between gap-2.5">
                  <Text className="text-11 font-semibold tracking-[.04em] text-text-muted">송금 수수료</Text>
                  <Segment
                    options={FEE_OPTIONS}
                    selected={`${splitFeePercent}%`}
                    size="sm"
                    fixed
                    onSelect={(option) =>
                      setShares({ ...draft.shares, splitFeePercent: Number.parseInt(option, 10) })
                    }
                  />
                </View>
              </>
            ) : (
              /* 상한은 (보스 · 난이도)마다 다르다. 스테퍼는 그 수를 못 말하므로 배지가 옆에서
                 말한다. */
              <View className="flex-row items-center justify-between gap-2.5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-11 font-semibold tracking-[.04em] text-text-muted">파티 인원</Text>
                  <Badge variant="primary" style={TABULAR_NUMS}>
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
              onPress={() => props.onApply(draft)}
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
