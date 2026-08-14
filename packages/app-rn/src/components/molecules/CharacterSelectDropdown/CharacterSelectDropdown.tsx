import { worldEmblemUrl } from '@core/lib/world-emblem'
import { Image, Pressable, Text, View } from 'react-native'

import { naturalAspectStyle } from '../../../lib/image-aspect'
import { ChevronDownIcon } from '../../../lib/icons'

export type CharacterSelectDropdownSize = 'default' | 'compact'

export interface CharacterSelectDropdownProps {
  characters: Array<{ ocid: string; characterName: string; world?: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
  // ADR-096 결정 5: 스케줄러는 제목 아래 독립된 줄의 주 컨트롤이라 크게, 관리 화면은 제목 줄
  // 우측의 작은 자리라 그 자리에 있던 읽기 전용 칩과 같은 크기감으로 그린다.
  size?: CharacterSelectDropdownSize
}

// ── 무엇이 웹뷰 사정이고 무엇이 제품 결정인가 ─────────────────────────────────────
//
// 이 컴포넌트에 [[ADR-001]] 이 걸려 있는 이유는 **하이브리드(Android WebView / iOS WKWebView)라서
// 생긴 사정**이 그 안에 섞여 있기 때문이다. RN 으로 옮기며 둘을 갈랐다.
//
// **웹뷰 사정 — RN 에서는 문제 자체가 없다**
//   · 네이티브 `<select>`/`<option>` 이라는 **메커니즘**. 목록 UI 를 OS 가 그려 줬다.
//   · `appearance-none` 으로 UA 화살표를 끄던 것. 그 화살표는 오른쪽 테두리에 붙어 함께 움직여
//     `padding-right` 로 안쪽에 못 넣고(2026-08-05 브라우저 실측), 플랫폼마다 모양도 달랐다.
//   · `<option>` 에 이미지를 못 넣어 **닫힌 상태 왼쪽에만** 엠블럼을 겹쳐 놓던 우회.
//
// **제품 결정 — 그대로 지킨다**
//   · 크기 두 벌(`default`/`compact`)과 그 치수([[ADR-096]] 결정 5 — 엠블럼 크기·left 는 좌측
//     패딩과, chevron 크기·right 는 우측 패딩과 짝이라 한 곳에 모아 둔다).
//   · **선택된 캐릭터의 월드 엠블럼만** 왼쪽에 둔다(다른 후보의 엠블럼은 그리지 않는다).
//   · chevron 을 **직접 그린다** — 웹에서는 UA 화살표를 끄기 위한 수단이었지만, 그 결과 두 플랫폼이
//     같은 모양을 갖게 된 것이 결정으로 남았다. RN 에는 애초에 UA 화살표가 없으므로 이것은
//     "누를 수 있다"를 말하는 **어포던스**로만 남는다.
//   · `onSelect(ocid)` 계약과 `size` API.
//
// ── ⚠️ 목록(열린 상태)은 아직 없다 ────────────────────────────────────────────────
//
// **RN 에는 `<select>` 의 짝이 없다.** 앱이 목록을 직접 그려야 하는데, *무엇으로* 그리는지가 곧
// 디자인 결정이다 — 중앙 모달([[ADR-094]] `Modal`) · 바텀시트([[ADR-039]] vaul 을 대체할 것) ·
// 트리거 아래 팝오버 셋 다 이 앱에 이미 있는 어법이라 고르는 문제이지 없는 문제가 아니다.
// 웹은 그 자리를 OS 에 넘겼으므로 **참고할 옛 디자인이 존재하지 않는다.**
//
// 그래서 이 단계에서는 **닫힌 상태(트리거)만** 옮긴다. 고르는 것은 오버레이를 소유한 계층(step 5
// organisms)과 함께 정할 일이고, 여기서 조용히 새 화면을 만들지 않는다. `onSelect` 는 그때 목록이
// 붙는 자리라 시그니처를 그대로 둔다.
//
// ── RN 으로 옮기며 바뀐 것 둘 ─────────────────────────────────────────────────────
//
// ① 세로 중앙 정렬이 `top-1/2 -translate-y-1/2` → **`inset-y-0` + `justify-center` 래퍼**다.
//    퍼센트 `translate` 는 RN 에서 버전에 따라 해석이 갈리는데, "위아래를 꽉 채우고 가운데 정렬"은
//    같은 결과를 **레이아웃만으로** 낸다. 래퍼가 생긴 덕에 아이콘에 `testID` 를 줄 수 있다 —
//    lucide 는 `testID` 를 가로채 `data-testid` 로 바꿔 버려 아이콘 자신에게는 못 준다
//    (`lib/nativewind-interop.ts`).
// ② 글자 유틸이 상자에서 `Text` 로 내려왔다(atoms 와 같은 규칙).
//
// ③ **엠블럼이 [[ADR-129]] 에서 붙었다.** 3단계는 *"`<Image source>` 에 무엇을 넣을지가 정해진 뒤에
//    붙인다"* 며 좌측 패딩 규칙만 남겨 뒀는데, 이제 `worldEmblemUrl` 이 번들 에셋 참조를 돌려주므로
//    그 자리가 채워진다. 여기서 안 채우면 **패딩만 엠블럼용으로 벌어지고 그림은 없는** 상태가 된다.
//    `source` 에는 값을 그대로 넣는다 — 번들 에셋이라 원격 URI 처럼 `{ uri }` 로 감싸지 않는다.
//    세로 중앙 정렬은 ①과 같은 이유로 `inset-y-0` + `justify-center` 래퍼다.
//
// ④ **웹의 `w-auto` 는 `resizeMode="contain"` 이 대신하지 못한다**([[ADR-135]] — ③이 그렇게 적어
//    두었던 것을 정정한다). `contain` 은 **상자 안에서 어떻게 맞출지**를 정할 뿐 상자를 만들지
//    않는데, RN 은 우리가 안 적은 축에 **에셋의 고유 픽셀 크기**를 남긴다 — 46×50 엠블럼의 폭 46 이
//    살아남아 그림이 앵커 안에서 가운데로 밀리고, ③이 짝을 맞춰 둔 좌측 패딩이 그만큼 어긋난다.
//    그래서 치수 표가 클래스(`h-[22px]`)가 아니라 **숫자**를 갖고, `naturalAspectStyle` 이 나머지
//    축을 지운다(`lib/image-aspect.ts`).
//
// 치수는 크기별로 짝이라 한 곳에 모아 둔다 — 엠블럼 크기·left 는 좌측 패딩과, chevron 크기·right 는
// 우측 패딩과 짝이다. 따로 두면 한쪽만 바꿨을 때 글자 위로 겹친다.
const SIZE_STYLES: Record<
  CharacterSelectDropdownSize,
  {
    box: string
    label: string
    withEmblem: string
    withoutEmblem: string
    emblemAnchor: string
    /** px. 클래스가 아니라 숫자인 이유는 파일 머리 ④ — 폭은 그림이 정한다. */
    emblemHeight: number
    chevronAnchor: string
    chevronSize: string
  }
> = {
  default: {
    box: 'min-w-[160px] rounded-[10px] border border-border bg-surface py-3',
    label: 'text-sm text-text',
    withEmblem: 'pl-8 pr-9',
    withoutEmblem: 'pl-4 pr-9',
    emblemAnchor: 'left-3',
    emblemHeight: 22,
    chevronAnchor: 'right-3.5',
    chevronSize: 'h-4 w-4',
  },
  compact: {
    box: 'rounded-full border border-border bg-surface py-1',
    label: 'text-xs font-medium text-text-muted',
    withEmblem: 'pl-7 pr-7',
    withoutEmblem: 'pl-3 pr-7',
    emblemAnchor: 'left-2.5',
    emblemHeight: 14,
    chevronAnchor: 'right-2.5',
    chevronSize: 'h-3 w-3',
  },
}

/** 세로 중앙 정렬(위 ①) — 좌우 앵커(`left-*`/`right-*`)만 크기마다 다르다. */
const ANCHOR_BASE = 'absolute inset-y-0 justify-center'

export function CharacterSelectDropdown(props: CharacterSelectDropdownProps): React.JSX.Element {
  const selected = props.characters.find((character) => character.ocid === props.selectedOcid)
  const emblemUrl = selected?.world !== undefined ? worldEmblemUrl(selected.world) : null
  const styles = SIZE_STYLES[props.size ?? 'default']

  return (
    <View className="self-start">
      {emblemUrl !== null && (
        <View
          testID="character-select-emblem"
          className={`${ANCHOR_BASE} ${styles.emblemAnchor}`}
          pointerEvents="none"
        >
          <Image
            source={emblemUrl}
            accessibilityLabel={selected?.world ?? ''}
            style={naturalAspectStyle(emblemUrl, { height: styles.emblemHeight })}
            resizeMode="contain"
          />
        </View>
      )}

      <Pressable
        testID="character-select-trigger"
        role="button"
        className={`${styles.box} ${emblemUrl !== null ? styles.withEmblem : styles.withoutEmblem}`}
      >
        <Text className={styles.label}>{selected?.characterName ?? ''}</Text>
      </Pressable>

      <View
        testID="character-select-chevron"
        className={`${ANCHOR_BASE} ${styles.chevronAnchor}`}
        pointerEvents="none"
      >
        <ChevronDownIcon
          className={`${styles.chevronSize} text-text-muted`}
          strokeWidth={2.5}
          aria-hidden
        />
      </View>
    </View>
  )
}
