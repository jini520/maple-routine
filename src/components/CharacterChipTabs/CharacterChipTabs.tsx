export interface CharacterChipTabsProps {
  characters: Array<{ ocid: string; characterName: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
}

export function CharacterChipTabs(props: CharacterChipTabsProps): React.JSX.Element {
  return (
    <div className="flex flex-row gap-1.5">
      {props.characters.map((character) => {
        const isActive = character.ocid === props.selectedOcid

        return (
          <button
            key={character.ocid}
            type="button"
            aria-pressed={isActive}
            onClick={() => props.onSelect(character.ocid)}
            className={
              isActive
                ? 'rounded-full border border-[#FFC9A8] bg-[#FFE9DB] px-3 py-1.5 text-xs font-medium text-[#C2410C]'
                : 'rounded-full border border-[#F0DFD1] px-3 py-1.5 text-xs font-medium text-[#B7A490]'
            }
          >
            {character.characterName}
          </button>
        )
      })}
    </div>
  )
}
