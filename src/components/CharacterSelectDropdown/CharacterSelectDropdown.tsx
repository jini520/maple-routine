export interface CharacterSelectDropdownProps {
  characters: Array<{ ocid: string; characterName: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
}

export function CharacterSelectDropdown(props: CharacterSelectDropdownProps): React.JSX.Element {
  return (
    <select
      value={props.selectedOcid}
      onChange={(event) => props.onSelect(event.target.value)}
      className="rounded-[10px] border border-[#F0DFD1] bg-white px-4 py-3 text-sm text-[#2B1B10]"
    >
      {props.characters.map((character) => (
        <option key={character.ocid} value={character.ocid}>
          {character.characterName}
        </option>
      ))}
    </select>
  )
}
