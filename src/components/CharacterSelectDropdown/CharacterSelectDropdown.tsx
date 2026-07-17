import { worldEmblemUrl } from '../../lib/world-emblem'

export interface CharacterSelectDropdownProps {
  characters: Array<{ ocid: string; characterName: string; world?: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
}

export function CharacterSelectDropdown(props: CharacterSelectDropdownProps): React.JSX.Element {
  // 네이티브 <select>의 <option>에는 이미지를 넣을 수 없으므로, 닫힌 상태(선택된 캐릭터)
  // 왼쪽에만 그 캐릭터의 월드 엠블럼을 겹쳐 보여준다(UI_GUIDE "스케줄러 캐릭터 드롭다운").
  const selected = props.characters.find((character) => character.ocid === props.selectedOcid)
  const emblemUrl = selected?.world ? worldEmblemUrl(selected.world) : null

  return (
    <div className="relative inline-block">
      {emblemUrl !== null && (
        <img
          src={emblemUrl}
          alt={selected?.world ?? ''}
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-auto -translate-y-1/2 object-contain"
        />
      )}
      <select
        value={props.selectedOcid}
        onChange={(event) => props.onSelect(event.target.value)}
        className={`min-w-[160px] rounded-[10px] border border-border bg-surface py-3 text-sm text-text ${
          emblemUrl !== null ? 'pl-9 pr-4' : 'px-4'
        }`}
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
