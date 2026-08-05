import { worldEmblemUrl } from '../../../lib/world-emblem'

export type CharacterSelectDropdownSize = 'default' | 'compact'

export interface CharacterSelectDropdownProps {
  characters: Array<{ ocid: string; characterName: string; world?: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
  // ADR-096 결정 5: 스케줄러는 제목 아래 독립된 줄의 주 컨트롤이라 크게, 관리 화면은 제목 줄
  // 우측의 작은 자리라 그 자리에 있던 읽기 전용 칩과 같은 크기감으로 그린다.
  size?: CharacterSelectDropdownSize
}

// 크기별 치수. 엠블럼 크기·왼쪽 여백이 <select>의 좌측 패딩과 짝이라 한 곳에 모아 둔다 —
// 따로 두면 한쪽만 바꿨을 때 엠블럼이 글자 위로 겹친다.
const SIZE_STYLES: Record<
  CharacterSelectDropdownSize,
  { select: string; withEmblem: string; withoutEmblem: string; emblem: string }
> = {
  default: {
    select: 'min-w-[160px] rounded-[10px] border border-border bg-surface py-3 text-sm text-text',
    withEmblem: 'pl-8 pr-4',
    withoutEmblem: 'px-4',
    emblem: 'left-3 h-[22px]',
  },
  compact: {
    select: 'rounded-full border border-border bg-surface py-1 text-xs font-medium text-text-muted',
    // pr 은 화살표 오른쪽 여백이다 — 네이티브 <select> 는 화살표를 패딩 박스 안 오른쪽 끝에
    // 그리므로, padding-right 를 키우면 화살표가 테두리에서 그만큼 안쪽으로 들어온다.
    withEmblem: 'pl-7 pr-4',
    withoutEmblem: 'pl-3 pr-4',
    emblem: 'left-2.5 h-[14px]',
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
    </div>
  )
}
