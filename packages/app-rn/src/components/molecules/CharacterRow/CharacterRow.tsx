// 캐릭터 한 줄 — 캐릭터 관리 화면의 **두 층이 함께 쓰는 카드**([[ADR-144]] 결정 2).
//
// 위(선택됨)와 아래(후보)는 같은 것들의 **두 상태**이지 다른 종류가 아니라, 카드는 한 벌이고
// **좌우 슬롯만 갈린다**(`leading` 핸들 · `trailing` 은 `★ ✕` 또는 `＋`). 모양을 갈라 두면 카드가
// 층을 옮길 때(결정 3) 「다른 물건」으로 보인다.
//
// ── 카드 안쪽 두 줄 ───────────────────────────────────────────────────────────────
//
//   (얼굴)  [스] 내옆에최성일        ← 1줄: 월드 엠블럼 + 닉네임(주인공은 이름이라 월드는 글자로
//           Lv.285 아크메이지(썬, 콜)   적지 않는다 — 드롭다운 행에서는 그것이 계정을 가르는
//                                       기준이라 성질이 다르다)
//
// **모르면 그 자리를 비운다**([[ADR-101]] 결정 1) — 레벨을 모르면 직업만, 직업을 모르면 레벨만,
// 둘 다 모르면 **2줄 자체를 그리지 않는다**(빈 줄을 남기면 행 높이만 들쭉날쭉해진다). 조회 불가는
// 그 둘보다 먼저 알아야 할 사실이라 2줄을 통째로 대체한다.
//
// ── 웹 그리드에서 가져온 것 셋 ─────────────────────────────────────────────────────
//
// ① **얼굴 크롭**은 [[ADR-015]] 기법 그대로이고, 표와 크기(36px)는 **`lib/face-crop` 한 곳**에서
//    온다 — 드롭다운 행·보스 수익 아바타·초상화 레일이 이미 쓰던 그 표다(아래).
// ② **엠블럼은 번들 에셋 id 라 `{ uri }` 로 감싸지 않는다**([[ADR-129]]) — 얼굴만 원격 URI 다.
// ③ **`w-auto` 의 짝이 `naturalAspectStyle` 이다**([[ADR-135]]) — RN 은 이름을 부르지 않은 축에
//    에셋의 고유 픽셀 크기를 남기므로, 높이만 정하고 폭을 그림에 맡기려면 그 축을 지워야 한다.
import { Image, Pressable, Text, View } from 'react-native'

import { worldEmblemUrl } from '@core/lib/world-emblem'

import { faceCropStyle } from '../../../lib/face-crop'
import { naturalAspectStyle } from '../../../lib/image-aspect'

// 얼굴 크롭 표는 `lib/face-crop` 하나뿐이다(사용자 지정 2026-08-17) — 이 파일이 들고 있던 표는
// 56px 그리드 시절의 것(`{x:115, y:120, size:64}` · 40px)이라 **같은 얼굴이 드롭다운 행과 다르게
// 잘렸다.** 드롭다운 행의 표(48px 크롭 · 36px 아바타)로 통일했고, 그 값은 이 앱의 다른 초상화들
// (보스 수익 아바타 · 초상화 레일)이 이미 쓰던 것이다.

const ROW_CLASS = 'flex-row items-center gap-2 rounded-[14px] border border-border bg-surface px-2.5 py-2'

/** 2줄에 설 글자 — 아무것도 모르면 `null` 이고, 그때 그 줄은 아예 그려지지 않는다. */
function captionText(level: number | null, jobClass: string | undefined): string | null {
  const parts = [level !== null ? `Lv.${level}` : null, jobClass ?? null].filter(
    (part): part is string => part !== null,
  )
  return parts.length === 0 ? null : parts.join(' ')
}

export interface CharacterRowProps {
  name: string
  level: number | null
  jobClass?: string
  world?: string
  imageUrl: string | null
  /** 조회 불가 — 2줄이 «조회할 수 없는 캐릭터» 로 바뀐다([[ADR-067]] 결정 1). */
  unavailable?: boolean
  /** 왼쪽 슬롯: 끌기 핸들(위 층에만 — 결정 5). */
  leading?: React.ReactNode
  /** 오른쪽 슬롯: 위 층은 별+✕, 아래 층은 ＋. */
  trailing?: React.ReactNode
  /** 주면 **카드 전체**가 버튼이 된다(결정 3 — `＋` 는 표시일 뿐 버튼이 아니다). */
  onPress?: () => void
}

export function CharacterRow(props: CharacterRowProps): React.JSX.Element {
  const emblem = props.world !== undefined ? worldEmblemUrl(props.world) : null
  const caption = captionText(props.level, props.jobClass)

  const body = (
    <>
      {props.leading}

      {/* 상자에 배경색을 두지 않는다(사용자 지정 2026-08-17) — 얼굴 크롭이 원을 꽉 채우므로 그 색은
          이미지가 뜨기 전 한 프레임에만 보이고, 그 한 프레임이 «회색 원이 깜빡인다» 로 읽혔다.
          이미지가 **없을 때**만 아래 폴백이 자기 배경을 갖는다. */}
      <View className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
        {props.imageUrl !== null ? (
          <Image
            testID="character-row-face"
            accessibilityLabel={props.name}
            source={{ uri: props.imageUrl }}
            style={{ position: 'absolute', ...faceCropStyle() }}
          />
        ) : (
          // 이름 첫 글자가 아니라 **테마 주황 원 + `?`** 다(사용자 지정) — 첫 글자는 «이 캐릭터의
          // 얼굴» 처럼 보여서 «못 가져왔다» 를 말하지 못했다. 글자색은 `on-primary`(그 색 위에 놓는
          // 글자로 이미 정의된 토큰 — 테마마다 흰색 계열이다).
          <View
            testID="character-row-face-fallback"
            className="h-full w-full items-center justify-center bg-primary"
          >
            <Text className="text-base font-bold text-on-primary">?</Text>
          </View>
        )}
      </View>

      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-1">
          {emblem !== null && (
            <View testID="character-row-emblem" className="shrink-0">
              <Image
                accessibilityLabel={props.world ?? ''}
                source={emblem}
                style={naturalAspectStyle(emblem, { height: 17 })}
                resizeMode="contain"
              />
            </View>
          )}
          <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-semibold text-text">
            {props.name}
          </Text>
        </View>

        {props.unavailable === true ? (
          <Text testID="character-row-caption" numberOfLines={1} className="text-xs text-error-ink">
            조회할 수 없는 캐릭터
          </Text>
        ) : (
          caption !== null && (
            <Text testID="character-row-caption" numberOfLines={1} className="text-xs text-text-muted">
              {caption}
            </Text>
          )
        )}
      </View>

      {props.trailing}
    </>
  )

  // 누를 것이 없으면 버튼이라고 말하지 않는다 — 위 층 행은 좌우 컨트롤로만 조작한다.
  return props.onPress === undefined ? (
    <View testID="character-row" className={ROW_CLASS}>
      {body}
    </View>
  ) : (
    <Pressable testID="character-row" role="button" onPress={props.onPress} className={ROW_CLASS}>
      {body}
    </Pressable>
  )
}
