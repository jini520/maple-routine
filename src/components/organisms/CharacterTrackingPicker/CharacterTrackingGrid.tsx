// 캐릭터 카드 그리드 — "캐릭터 관리" 모달과 온보딩 캐릭터 선택 단계가 **같은 렌더링**을 쓰도록
// 피커에서 떼어낸 것([[ADR-035]]). 정렬·얼굴 크롭·즐겨찾기·월드 엠블럼이 여기 있고, 오버레이·카드·
// 스크롤포트는 쓰는 쪽에 남는다([[ADR-107]] 결정 3).
//
// ── RN 으로 옮기며 바뀐 것 여섯 ─────────────────────────────────────────────────────
//
// ① **`grid grid-cols-3 gap-2` 를 쓸 수 없다.** RN(Yoga)에는 CSS Grid 가 없다. `flex-row flex-wrap`
//    + `gap-2` 로 옮기면 3열이 되려면 자식 폭이 `calc((100% - 16px) / 3)` 여야 하는데 그 식을 줄
//    방법이 없어(퍼센트만으로는 gap 을 못 뺀다) 좁은 폭에서 조용히 2열로 접힌다. 그래서 **셀을
//    `w-1/3 p-1` 래퍼로 감싸고 줄에 `-m-1` 을 건다** — 셀 사이 간격이 정확히 `p-1 × 2 = 8px`(= 웹의
//    `gap-2`)이고 가장자리는 음수 마진이 되돌려 폭이 그대로다. 어떤 너비에서도 3열이 깨지지 않는다.
// ② **`aria-pressed` → `aria-selected`.** RN 의 접근성 상태에 *pressed* 가 없다(`DifficultySegment`
//    와 같은 판단) — 전달되는 사실은 같다(이 캐릭터가 지금 골라져 있는가).
// ③ `hover:bg-primary-tint` 제거(터치 기기에 hover 가 없다 — atoms 와 같은 규칙).
// ④ `truncate` → `numberOfLines={1}`. 웹의 `truncate` 는 `overflow:hidden`+`text-overflow:ellipsis`
//    인데 RN 은 그 둘을 스타일이 아니라 `Text` 의 프롭으로 받는다.
// ⑤ **`source` 가 둘로 갈린다** — 얼굴은 넥슨이 주는 **원격 URI** 라 `{ uri }` 로 감싸지만, 월드
//    엠블럼은 [[ADR-129]] 이후 **번들 에셋 id** 라 숫자를 그대로 넘긴다. 감싸면 안 뜬다(`{uri: 3}`
//    은 RN 에게 주소가 아니다). 웹에서는 둘 다 문자열 URL 이라 이 구분이 없었다.
// ⑥ 얼굴 크롭은 `<img className="absolute max-w-none" style={…}>` → `<Image>` + 같은 절대 좌표다.
//    `max-w-none` 은 웹 preflight 의 `img{max-width:100%}` 를 지우는 리셋이라 RN 에는 짝이 없다.
// ⑦ **`fill-primary-ink` 는 RN 에 짝이 없다.** `fill` 은 CSS 속성이라 NativeWind 가 RN 스타일로
//    내지 못하고 조용히 사라진다(별이 테두리만 남아 "선택됨"이 안 읽힌다). lucide 의 `fill` 프롭에
//    **테마 값 자체**를 넘겨 같은 그림을 만든다 — `currentColor` 로는 안 된다(그 값의 출처는
//    `Svg` 의 `color` 프롭인데 lucide 는 색을 `stroke` 로만 넘긴다, `nativewind-interop.ts`).
// ⑧ **엠블럼의 `w-auto` 도 짝이 없다**([[ADR-135]]). 웹은 `h-[17px] w-auto object-contain` 으로
//    높이만 정하고 폭을 그림에 맡겼는데, RN 은 **안 적은 축에 에셋의 고유 픽셀 크기를 남긴다** —
//    46×50 엠블럼의 폭 46 이 살아남아 이름 줄 왼쪽에 좌우 각 15.2px 이 빈다. `naturalAspectStyle`
//    이 그 축을 지우고 종횡비를 얹는다(`lib/image-aspect.ts`).
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { worldEmblemUrl } from '../../../lib/world-emblem'
import type { CharacterPickerEntry } from '../../../types'

import { naturalAspectStyle } from '../../../lib/image-aspect'
import { BanIcon, StarIcon } from '../../../lib/icons'
import { useThemeAppearance } from '../../../theme/context'
import { Text } from '../../atoms/Text/Text'

// [[ADR-015]]: character/basic 이 주는 300x300 전신 룩에서 얼굴만 보이도록 확대·정렬해 자른다.
// 헤어스타일/포즈에 따라 완벽히 얼굴만 나오지 않을 수 있는 근사치다(ADR-015 미확정 항목).
const SOURCE_IMAGE_SIZE = 300
const FACE_CROP_BOX = { x: 115, y: 120, size: 64 }
const AVATAR_SIZE = 56

interface FaceCropStyle {
  width: number
  height: number
  left: number
  top: number
}

function faceCropStyle(): FaceCropStyle {
  const scale = AVATAR_SIZE / FACE_CROP_BOX.size
  return {
    width: SOURCE_IMAGE_SIZE * scale,
    height: SOURCE_IMAGE_SIZE * scale,
    left: -FACE_CROP_BOX.x * scale,
    top: -FACE_CROP_BOX.y * scale,
  }
}

// [[ADR-015]]: 즐겨찾기(선택)한 캐릭터를 그룹 맨 앞으로 보내고, 각 그룹 내부에서는 entries 가 이미
// 레벨 내림차순이므로 필터만으로 순서가 그대로 유지된다.
function sortForDisplay(entries: CharacterPickerEntry[], checkedOcids: string[]): CharacterPickerEntry[] {
  const checked = new Set(checkedOcids)
  const favorited = entries.filter((entry) => checked.has(entry.ocid))
  const rest = entries.filter((entry) => !checked.has(entry.ocid))
  return [...favorited, ...rest]
}

export interface CharacterTrackingGridProps {
  entries: CharacterPickerEntry[]
  /** 최초 선택 상태(초기값으로만 쓴다 — 이후엔 그리드가 자체 상태로 관리한다). */
  trackedOcids: string[]
  /**
   * 선택이 바뀔 때마다 그 시점의 선택 ocid 배열을 통지한다 — 부모(모달의 저장 버튼, 온보딩
   * 페이지의 계속하기 버튼)가 이 값을 받아 자기 CTA 에 연결한다.
   */
  onChange: (selectedOcids: string[]) => void
}

export function CharacterTrackingGrid(props: CharacterTrackingGridProps): React.JSX.Element {
  const [checkedOcids, setCheckedOcids] = useState<string[]>(props.trackedOcids)
  // 별을 채우는 색(파일 머리 ⑦). 클래스가 아니라 값이어야 하는 자리라 정의에서 직접 읽는다.
  const { definition } = useThemeAppearance()

  function toggle(ocid: string): void {
    const next = checkedOcids.includes(ocid) ? checkedOcids.filter((id) => id !== ocid) : [...checkedOcids, ocid]
    setCheckedOcids(next)
    props.onChange(next)
  }

  const available = props.entries.filter((entry) => entry.unavailable !== true)
  const unavailable = props.entries.filter((entry) => entry.unavailable === true)
  const sortedEntries = sortForDisplay(available, checkedOcids)

  function card(entry: CharacterPickerEntry): React.JSX.Element {
    const isChecked = checkedOcids.includes(entry.ocid)
    // [[ADR-068]] 결정 4: 조회 불가 항목은 **해제만** 가능하다 — 고를 수 없는 후보를 새로 고르게
    // 하면 그 즉시 매 동기화 실패로 이어진다. 이미 추적 중인 경우의 해제는 유일한 탈출구라 막지 않는다.
    const isUnavailable = entry.unavailable === true
    const canToggle = !isUnavailable || isChecked
    const emblemUrl = entry.world !== undefined ? worldEmblemUrl(entry.world) : null

    return (
      // 셀 래퍼가 간격을 만든다(파일 머리 ①) — 카드 자신은 웹과 같은 클래스를 그대로 쓴다.
      <View key={entry.ocid} className="w-1/3 p-1">
        <Pressable
          role="button"
          aria-selected={isChecked}
          disabled={!canToggle}
          onPress={canToggle ? () => toggle(entry.ocid) : undefined}
          className={
            isUnavailable
              ? `items-center gap-1 rounded-[14px] border border-border px-1 py-3${
                  isChecked ? ' bg-surface-2' : ' opacity-60'
                }`
              : isChecked
                ? 'items-center gap-1 rounded-[14px] border border-primary bg-primary-tint px-1 py-3'
                : 'items-center gap-1 rounded-[14px] border border-border px-1 py-3'
          }
        >
          {isUnavailable ? (
            <BanIcon className="absolute right-1.5 top-1.5 h-4 w-4 text-text-muted" strokeWidth={1.75} />
          ) : (
            <StarIcon
              className={
                isChecked
                  ? 'absolute right-1.5 top-1.5 h-4 w-4 text-primary-ink'
                  : 'absolute right-1.5 top-1.5 h-4 w-4 text-text-muted'
              }
              fill={isChecked ? definition.primaryInk : 'none'}
              strokeWidth={1.5}
            />
          )}

          <View className="h-14 w-14 overflow-hidden rounded-full bg-surface-2">
            {entry.imageUrl !== null ? (
              <Image
                testID={`character-face-${entry.ocid}`}
                accessibilityLabel={entry.name}
                source={{ uri: entry.imageUrl }}
                style={{ position: 'absolute', ...faceCropStyle() }}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-xs text-text-muted">?</Text>
              </View>
            )}
          </View>

          <View className="w-full flex-row items-center justify-center gap-0.5">
            {emblemUrl !== null && (
              <Image
                testID={`world-emblem-${entry.ocid}`}
                accessibilityLabel={entry.world ?? ''}
                source={emblemUrl}
                // 웹 `h-[17px] w-auto` 의 짝(파일 머리 ⑧) — 폭은 그림이 정한다.
                style={naturalAspectStyle(emblemUrl, { height: 17 })}
                className="shrink-0"
                resizeMode="contain"
              />
            )}
            <Text numberOfLines={1} className="min-w-0 text-xs font-semibold text-text">
              {entry.name}
            </Text>
          </View>

          <Text className="text-xs text-text-muted">Lv.{entry.level}</Text>
        </Pressable>
      </View>
    )
  }

  // 조회 불가 항목은 정상 후보 아래 별도 섹션으로 내린다([[ADR-068]] 결정 4) — 숨기지 않는 이유는
  // 사용자가 추적을 해제할 자리가 필요하기 때문이다(이슈 #78 A-1).
  //
  // 높이 상한도 스크롤도 여기 없다([[ADR-107]] 결정 3) — 스크롤포트는 **쓰는 쪽**이 자기 자리에
  // 맞게 둔다. 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 그려지므로, 그 상자를 어디에 두느냐가
  // 곧 인디케이터 위치다.
  return (
    <View>
      <View className="-m-1 flex-row flex-wrap">{sortedEntries.map(card)}</View>

      {unavailable.length > 0 && (
        <View testID="unavailable-roster" className="mt-4">
          <View className="mb-1.5 flex-row items-center gap-1.5">
            <BanIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
            <Text className="text-[11px] font-bold tracking-wide text-text-muted">
              조회할 수 없는 캐릭터
            </Text>
          </View>
          <View className="-m-1 flex-row flex-wrap">{unavailable.map(card)}</View>
        </View>
      )}
    </View>
  )
}
