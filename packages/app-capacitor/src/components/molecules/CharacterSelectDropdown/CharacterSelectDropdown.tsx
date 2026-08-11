import { ChevronDown } from 'lucide-react'
import { worldEmblemUrl } from '@core/lib/world-emblem'

export type CharacterSelectDropdownSize = 'default' | 'compact'

export interface CharacterSelectDropdownProps {
  characters: Array<{ ocid: string; characterName: string; world?: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
  // ADR-096 결정 5: 스케줄러는 제목 아래 독립된 줄의 주 컨트롤이라 크게, 관리 화면은 제목 줄
  // 우측의 작은 자리라 그 자리에 있던 읽기 전용 칩과 같은 크기감으로 그린다.
  size?: CharacterSelectDropdownSize
}

// 화살표는 **두 크기 모두 직접 그린다**(`appearance-none` + ChevronDown). 두 가지 이유다.
//
// ① 네이티브 <select> 의 화살표는 **오른쪽 테두리에 붙어 함께 움직여서** padding-right 로는
//    안쪽으로 들어오지 않는다 — 상자만 넓어지고 간격은 그대로다(2026-08-05 브라우저 실측:
//    pr 12/16/32/64px 전부 동일). 위치를 정하려면 UA 화살표를 끄는 수밖에 없다.
// ② UA 화살표는 플랫폼마다 모양이 다르다. 이 앱은 Android WebView(Chrome)와 iOS
//    WKWebView(Safari) 양쪽에서 도는 하이브리드라([[ADR-001]]) 그대로 두면 같은 화면이
//    기기마다 다르게 보인다. 직접 그리면 양쪽이 같아진다.
//
// 크기별 치수는 서로 짝이라 한 곳에 모아 둔다 — 엠블럼 크기·left 는 좌측 패딩과, chevron
// 크기·right 는 우측 패딩과 짝이다. 따로 두면 한쪽만 바꿨을 때 글자 위로 겹친다.
const SIZE_STYLES: Record<
  CharacterSelectDropdownSize,
  { select: string; withEmblem: string; withoutEmblem: string; emblem: string; chevron: string }
> = {
  default: {
    select:
      'appearance-none min-w-[160px] rounded-[10px] border border-border bg-surface py-3 text-sm text-text',
    withEmblem: 'pl-8 pr-9',
    withoutEmblem: 'pl-4 pr-9',
    emblem: 'left-3 h-[22px]',
    chevron: 'right-3.5 h-4 w-4',
  },
  compact: {
    select:
      'appearance-none rounded-full border border-border bg-surface py-1 text-xs font-medium text-text-muted',
    withEmblem: 'pl-7 pr-7',
    withoutEmblem: 'pl-3 pr-7',
    emblem: 'left-2.5 h-[14px]',
    chevron: 'right-2.5 h-3 w-3',
  },
}

export function CharacterSelectDropdown(props: CharacterSelectDropdownProps): React.JSX.Element {
  // 네이티브 <select>의 <option>에는 이미지를 넣을 수 없으므로, 닫힌 상태(선택된 캐릭터)
  // 왼쪽에만 그 캐릭터의 월드 엠블럼을 겹쳐 보여준다(UI_GUIDE "스케줄러 캐릭터 드롭다운").
  const selected = props.characters.find((character) => character.ocid === props.selectedOcid)
  const emblemUrl = selected?.world ? worldEmblemUrl(selected.world) : null
  const styles = SIZE_STYLES[props.size ?? 'default']

  return (
    <div className="relative inline-block">
      {emblemUrl !== null && (
        <img
          src={emblemUrl}
          alt={selected?.world ?? ''}
          className={`pointer-events-none absolute top-1/2 w-auto -translate-y-1/2 object-contain ${styles.emblem}`}
        />
      )}
      <select
        value={props.selectedOcid}
        onChange={(event) => props.onSelect(event.target.value)}
        className={`${styles.select} ${emblemUrl !== null ? styles.withEmblem : styles.withoutEmblem}`}
      >
        {props.characters.map((character) => (
          <option key={character.ocid} value={character.ocid}>
            {character.characterName}
          </option>
        ))}
      </select>
      <ChevronDown
        data-testid="character-select-chevron"
        aria-hidden="true"
        strokeWidth={2.5}
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-muted ${styles.chevron}`}
      />
    </div>
  )
}
