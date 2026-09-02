// 추적 캐릭터를 한 줄로 늘어놓는 **초상화 레일**([[ADR-142]] 결정 1) — 드롭다운을 대신한다.
//
// **드롭다운이 못 채운 계약을 여기서 채운다.** `CharacterSelectDropdown` 은 닫힌 상태만 옮겨 와
// `onSelect` 가 한 번도 안 불렸다(그 파일 머리 «⚠️ 목록은 아직 없다»). 레일에는 열고 닫을 것이 없어
// — 항목이 곧 목록이다 — 누르면 그 자리에서 바뀐다.
//
// ── 음수 마진이 하는 일 ───────────────────────────────────────────────────────────
//
// 레일은 `PageHeader` 안에 있고 그 셸은 `px-4` 다. 그대로 두면 스크롤이 16px 안쪽에서 잘려 **«더
// 있다» 가 안 보인다** — 굴러 들어오는 칸이 여백 앞에서 사라지는 것처럼 보인다. 그래서 좌우
// 패딩을 음수 마진으로 뚫고, 같은 값을 스크롤 **콘텐츠**의 패딩으로 되돌린다: 첫 칸과 마지막 칸은
// 제자리에 서고 스크롤만 화면 끝까지 간다.
import { ScrollView, View } from 'react-native'

import { CharacterPortrait } from '../CharacterPortrait/CharacterPortrait'
import { PORTRAIT_RAIL } from '../CharacterPortrait/portrait-metrics'
import type { PortraitRingProgress } from '../CharacterPortrait/PortraitRing'

export interface CharacterRailEntry {
  ocid: string
  characterName: string
  level: number | null
  imageUrl: string | null
  /**
   * 0개면 링 없음(관리 화면), 1개면 온전한 원, 2개면 좌·우 반원
   * ([[ADR-142]] 정정 1·8 — `CharacterPortrait` 의 같은 프롭).
   */
  rings: [] | [PortraitRingProgress] | [PortraitRingProgress, PortraitRingProgress]
}

export interface CharacterRailProps {
  entries: CharacterRailEntry[]
  selectedOcid: string
  onSelect: (ocid: string) => void
}

/** `PageHeader` 의 좌우 패딩(px) — 위 「음수 마진」 절이 뚫었다 되돌리는 값이다. */
const HEADER_PADDING = 16

export function CharacterRail(props: CharacterRailProps): React.JSX.Element {
  return (
    <View testID="character-rail" style={{ marginHorizontal: -HEADER_PADDING }}>
      <ScrollView
        testID="character-rail-scroll"
        horizontal
        // 스크롤바를 안 그린다 — «더 있다» 는 잘린 초상화가 말한다(ADR 대가에 적힌 그 값이다).
        showsHorizontalScrollIndicator={false}
        // 간격은 칸이 아니라 레일이 준다. 값은 칸의 치수 표에서 온다. 링 유무로 안 갈린다
        // ([[ADR-161]] 결정 1). 숫자를 여기 적으면 표와 레일이 서로 다른 값을 믿는다.
        contentContainerStyle={{ paddingHorizontal: HEADER_PADDING, gap: PORTRAIT_RAIL.gap }}
      >
        {props.entries.map((entry) => (
          <CharacterPortrait
            key={entry.ocid}
            variant="rail"
            ocid={entry.ocid}
            characterName={entry.characterName}
            level={entry.level}
            imageUrl={entry.imageUrl}
            rings={entry.rings}
            isSelected={entry.ocid === props.selectedOcid}
            onPress={() => props.onSelect(entry.ocid)}
          />
        ))}
      </ScrollView>
    </View>
  )
}
