// 캐릭터 아바타와 **처치 진행 링**([[ADR-094]] 결정 7로 화면에서 분리).
//
// 아바타 이미지를 얼굴 기준으로 크롭하고(원본이 전신이라 그대로 쓰면 얼굴이 작다), 그 둘레에
// 주간/월간 처치 수를 링으로 그린다. 자기 상자 안에서 끝나 화면의 sticky·스태킹과 무관하다.
//
// ── RN 으로 옮기며 갈린 것 넷 ─────────────────────────────────────────────────────
//
// ① **크롭 값은 한 자리도 안 바뀐다.** 웹의 `<img className="absolute max-w-none" style={…}>` 는
//    `<Image>` + **같은 절대 좌표**가 된다(`CharacterTrackingGrid` 가 먼저 밟은 자리). `max-w-none`
//    은 RN 에 짝이 없다 — 애초에 `max-width` 기본값이 없어 없앨 것이 없다.
// ② **얼굴은 원격 URI 라 `{ uri }` 로 감싼다** — 넥슨이 주는 주소다([[ADR-129]] 가 번들에 넣은
//    에셋은 반대로 감싸면 안 뜬다. 같은 파일에 두 형태가 공존하는 함정을 그 컴포넌트가 적어 뒀다).
// ③ **링의 두 색이 `className` 이 아니라 `stroke` 프롭으로 온다.** `react-native-svg` 의 `Circle`
//    은 `cssInterop` 에 등록돼 있지 않고(등록하면 `currentColor` 한 색만 통한다), 이 링은 **한
//    `<Svg>` 안에서 두 색**(찬 칸 `primary` · 빈 칸 `border`)을 써야 하므로 테마에서 직접 읽는다.
// ④ **접근성 이름이 `<Svg>` 가 아니라 그것을 감싸는 `View` 로 올라간다** — `BossPortrait` 와 같은
//    방식이다. 링이 진행률의 유일한 표현이므로(정정 7 — `n/12` 텍스트 보류) 이름은 남아야 하고,
//    `role="img"` + `aria-label` 의 **문구는 웹과 한 글자도 다르지 않다.**
import { Image, Text, View, type ImageStyle } from 'react-native'
import { Circle } from 'react-native-svg'

import type { BossCycle } from '@core/types'

import { Svg } from '../../lib/nativewind-interop'
import { useThemeAppearance } from '../../theme/context'

// components/CharacterTrackingPicker와 동일한 얼굴 크롭 기법(ADR-015)을 이 화면의 32px
// 아바타 슬롯 크기에 맞춰 재사용한다 — 이 프로젝트는 화면마다 UI를 그대로 복제하는 관례를
// 따른다(탭 pill과 동일한 이유, ADR-018).
export const AVATAR_SOURCE_IMAGE_SIZE = 300
// 원본 크롭 박스({ x: 115, y: 120, size: 64 })와 중심(147, 152)은 유지한 채 size만 64→48로
// 줄여 확대율을 높였다(사용자 요청, 2026-07-14 — 원 크기가 아니라 이미지 확대 배율 조정).
export const AVATAR_FACE_CROP_BOX = { x: 123, y: 128, size: 48 }
export const AVATAR_SIZE = 32
// 아바타 테두리를 보스 처치 한도만큼 쪼갠 진행 링([[ADR-054]] 정정 1·3, 사용자 요청) — 처치할
// 때마다 한 칸씩 찬다. 헤더 가로폭을 전혀 쓰지 않아 캐릭터명을 가리지 않는 것이 이 표현을 고른 이유다.
// 링은 초상화 "바깥"에 여백을 두고 두른다(정정 3) — 그래서 아바타 슬롯이 초상화(32px)보다 큰 40px다.
// 슬롯은 칸 수(주간 12 · 월간 1)와 무관하게 항상 40px로 고정한다: 탭마다 크기가 달라지면 탭을 옮길
// 때마다 모든 카드가 튄다(높이는 실측이라 따라오지만, 그 튐 자체가 [[ADR-049]]가 없애려던 것이다).
// 초상화 이미지 크기는 32px 그대로라 얼굴 크롭은 영향받지 않는다.
export const AVATAR_SLOT_SIZE = 40
export const AVATAR_RING_STROKE = 2.5
// 칸 사이 간격(viewBox 단위 호 길이). 12칸이 하나의 원처럼 보이지 않도록 눈에 띄는 최소값.
export const AVATAR_RING_GAP = 2.4

export function avatarFaceCropStyle(): ImageStyle {
  const scale = AVATAR_SIZE / AVATAR_FACE_CROP_BOX.size
  return {
    position: 'absolute',
    width: AVATAR_SOURCE_IMAGE_SIZE * scale,
    height: AVATAR_SOURCE_IMAGE_SIZE * scale,
    left: -AVATAR_FACE_CROP_BOX.x * scale,
    top: -AVATAR_FACE_CROP_BOX.y * scale,
  }
}

export function AvatarClearRing(props: { cleared: number; total: number; cycle: BossCycle }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  // 링 중심 반지름 19 = 바깥 끝 20(슬롯 경계) · 안쪽 끝 18 → 초상화 반지름 16과 2px 여백(정정 3).
  const radius = (AVATAR_SLOT_SIZE - AVATAR_RING_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const segment = circumference / props.total
  // strokeLinecap="round"는 칸 양끝을 stroke 두께의 절반(=1)씩 더 그린다(정정 5) — 그만큼 dash를
  // 미리 줄여야 눈에 보이는 칸 길이와 칸 사이 간격이 butt일 때와 같게 유지된다. 빼지 않으면 갭이
  // 2.4 → 0.4로 뭉개져 12칸이 하나의 원처럼 보인다.
  const dash = Math.max(segment - AVATAR_RING_GAP - AVATAR_RING_STROKE, 0.5)
  // 캡이 시작점 뒤로 0.5 stroke만큼 튀어나오므로 그만큼 밀어야 칸이 원래 자리에 그대로 앉는다.
  const capOffset = AVATAR_RING_STROKE / 2
  // 칸이 하나뿐이면(월간 탭 — 월간 보스가 검은마법사 1종) dash를 걸지 않고 온전한 원으로 그린다
  // ([[ADR-059]] 정정 1, 사용자 요청). 위 간격은 "칸과 칸을 나누기 위한" 장치라, 나눌 상대가 없는
  // 링에서는 나눔이 아니라 결손으로 읽힌다. 값을 0으로 만드는 대신 속성을 통째로 빼는 이유는 dash
  // 양끝의 둥근 캡이 정확히 겹쳐 이음매가 비치는 것을 피하기 위해서다.
  const isSingleSegment = props.total === 1

  return (
    // 레이블은 링이 갖는다(정정 7 — `n/12` 텍스트 보류라 링이 진행률의 유일한 표현이다). 주기는
    // 탭을 따라간다([[ADR-059]] 결정 7) — 두 탭이 같은 컴포넌트를 쓰므로 "주간"으로 고정하면
    // 월간 탭에서 거짓말이 된다.
    <View
      pointerEvents="none"
      role="img"
      aria-label={`${props.cycle === 'weekly' ? '주간' : '월간'} 보스 처치 ${props.cleared} / ${props.total}`}
      className="absolute inset-0"
    >
      {/* rotate-90 + scaleX -1: 12시부터 반시계방향으로 차게 만드는 조합이다([[ADR-059]] 정정 2,
          사용자 요청). SVG circle의 경로는 3시에서 시작해 시계방향으로 도는데, 좌우로 뒤집으면 진행
          방향이 반시계로 바뀌면서 시작점이 9시로 간다 — 거기서 시계방향 90도를 더해 시작점만 12시로
          되돌린다. 칸 배치식(dash·dashoffset)은 그대로 둔다: 부호를 뒤집으면 round 캡 보정
          ([[ADR-054]] 정정 5)까지 함께 다시 유도해야 한다. */}
      <Svg
        width={AVATAR_SLOT_SIZE}
        height={AVATAR_SLOT_SIZE}
        viewBox={`0 0 ${AVATAR_SLOT_SIZE} ${AVATAR_SLOT_SIZE}`}
        style={{ transform: [{ rotate: '90deg' }, { scaleX: -1 }] }}
      >
        {Array.from({ length: props.total }, (_, index) => (
          <Circle
            key={index}
            testID="avatar-ring-segment"
            cx={AVATAR_SLOT_SIZE / 2}
            cy={AVATAR_SLOT_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={AVATAR_RING_STROKE}
            strokeLinecap="round"
            stroke={index < props.cleared ? definition.primary : definition.border}
            strokeDasharray={isSingleSegment ? undefined : `${dash} ${circumference - dash}`}
            strokeDashoffset={isSingleSegment ? undefined : -(index * segment + capOffset)}
          />
        ))}
      </Svg>
    </View>
  )
}

export function CharacterAvatar(props: {
  characterName: string
  imageUrl: string | null
  // 탭이 정한 진행률(주간 = n/12, 월간 = n/월간 보스 종류 수). 두 탭·모든 기간에 항상 그린다([[ADR-059]]).
  clearProgress: { cleared: number; total: number; cycle: BossCycle }
}): React.JSX.Element {
  return (
    // 슬롯(40px) 안에 초상화(32px)를 중앙 배치하고 링은 그 바깥 테두리에 그린다. 링을 이미지 상자
    // "안"에 넣으면 overflow-hidden에 stroke 바깥 절반이 잘리므로 형제로 두고 슬롯에 절대배치한다.
    <View className="relative h-10 w-10 shrink-0 items-center justify-center">
      {/* 크롭(absolute + left/top)의 기준 박스가 32px 초상화로 남아야 한다 — 40px 슬롯이 기준이
          되면 크롭이 4px씩 밀린다([[ADR-015]] 크롭 기법 그대로). */}
      <View className="h-8 w-8 overflow-hidden rounded-full bg-surface-2">
        {props.imageUrl !== null ? (
          <Image
            testID="character-avatar-image"
            accessibilityLabel={props.characterName}
            source={{ uri: props.imageUrl }}
            style={avatarFaceCropStyle()}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-xs font-bold text-text">{props.characterName.charAt(0)}</Text>
          </View>
        )}
      </View>
      <AvatarClearRing
        cleared={props.clearProgress.cleared}
        total={props.clearProgress.total}
        cycle={props.clearProgress.cycle}
      />
    </View>
  )
}
