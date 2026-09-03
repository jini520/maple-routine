/**
 * 캐릭터 한 줄. 캐릭터 관리 화면의 두 층이 함께 쓰는 카드.
 *
 * 위(선택됨)와 아래(후보)는 같은 것의 두 상태라 카드는 한 벌이고 **좌우 슬롯만 갈린다**
 * (`leading` 핸들 · `trailing` 은 `★ ✕` 또는 `＋`). 모양을 갈라 두면 카드가 층을 옮길 때 다른
 * 물건으로 보인다.
 *
 * ```
 * (얼굴)  [스] 내옆에최성일        ← 1줄: 월드 엠블럼 + 닉네임
 *         Lv.285 아크메이지(썬, 콜)  ← 2줄
 * ```
 *
 * **모르면 그 자리를 비운다.** 레벨을 모르면 직업만, 직업을 모르면 레벨만, 둘 다 모르면 2줄 자체를
 * 안 그린다(빈 줄을 남기면 행 높이만 들쭉날쭉해진다). 조회 불가는 그 둘보다 먼저 알아야 할 사실이라
 * 2줄을 통째로 대체한다.
 */
import { Image, Pressable, View } from 'react-native'

import { worldEmblemUrl } from '../../../lib/assets/asset-lookup'

import { FACE_AVATAR_SIZE } from '../../../lib/face-crop'
import { CharacterAvatar } from '../../molecules/CharacterAvatar/CharacterAvatar'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { Text } from '../../atoms'

// 얼굴 크롭 표는 `lib/face-crop` 하나뿐이다. 이 파일이 자기 표를 들면 같은 얼굴이 드롭다운 행과
// 다르게 잘린다. 값(48px 크롭 · 36px 아바타)은 이 앱의 다른 초상화들이 이미 쓰던 것이다.

const ROW_CLASS = 'flex-row items-center gap-2 rounded-[14px] border border-border bg-surface px-2.5 py-2'

/** 2줄에 설 글자. 아무것도 모르면 `null` 이고, 그때 그 줄은 아예 그려지지 않는다. */
function captionText(level: number | null, jobClass: string | undefined): string | null {
  const parts = [level !== null ? `Lv.${level}` : null, jobClass ?? null].filter(
    (part): part is string => part !== null,
  )
  return parts.length === 0 ? null : parts.join(' ')
}

export interface CharacterRowProps {
  /**
   * 이 행이 어느 층인가. 캐릭터 관리의 두 층이 한 격자의 형제라 상자로는 가를 수 없어, 화면
   * 밖에서 층을 물을 길이 이것뿐이다.
   */
  testID?: string
  name: string
  level: number | null
  jobClass?: string
  world?: string
  imageUrl: string | null
  /** 조회 불가. 2줄이 조회할 수 없는 캐릭터 로 바뀐다. */
  unavailable?: boolean
  /** 왼쪽 슬롯. 끌기 핸들(위 층에만). */
  leading?: React.ReactNode
  /** 오른쪽 슬롯: 위 층은 별+✕, 아래 층은 ＋. */
  trailing?: React.ReactNode
  /** 주면 카드 전체를 버튼으로 만드는 콜백. `＋` 는 표시일 뿐 버튼이 아니다. */
  onPress?: () => void
}

export function CharacterRow(props: CharacterRowProps): React.JSX.Element {
  const emblem = props.world !== undefined ? worldEmblemUrl(props.world) : null
  const caption = captionText(props.level, props.jobClass)

  const body = (
    <>
      {props.leading}

      {/* 이름 첫 글자가 아니라 테마 주황 원 + `?` 다. 첫 글자는 이 캐릭터의 얼굴처럼 보여서 못
          가져왔다 를 말하지 못한다. 글자색은 `on-primary`. 그 색 위에 놓는 글자로 이미 정의된
          토큰이라 테마마다 대비가 보장된다. */}
      <CharacterAvatar
        imageTestID="character-row-face"
        imageUrl={props.imageUrl}
        name={props.name}
        size={FACE_AVATAR_SIZE}
        className="shrink-0"
        fallback={
          <View
            testID="character-row-face-fallback"
            className="h-full w-full items-center justify-center bg-primary"
          >
            <Text className="text-base font-bold text-on-primary">?</Text>
          </View>
        }
      />

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

  // 누를 것이 없으면 버튼이라고 말하지 않는다. 위 층 행은 좌우 컨트롤로만 조작한다.
  return props.onPress === undefined ? (
    <View testID={props.testID ?? 'character-row'} className={ROW_CLASS}>
      {body}
    </View>
  ) : (
    <Pressable
      testID={props.testID ?? 'character-row'}
      role="button"
      onPress={props.onPress}
      className={ROW_CLASS}
    >
      {body}
    </Pressable>
  )
}
