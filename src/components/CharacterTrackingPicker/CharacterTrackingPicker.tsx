import { useState } from 'react'

export interface CharacterTrackingPickerProps {
  allCharacters: Array<{ ocid: string; characterName: string }>
  trackedOcids: string[]
  onSave: (ocids: string[]) => void
  onClose: () => void
}

export function CharacterTrackingPicker(props: CharacterTrackingPickerProps): React.JSX.Element {
  const [checkedOcids, setCheckedOcids] = useState<string[]>(props.trackedOcids)

  function toggle(ocid: string): void {
    setCheckedOcids((prev) => (prev.includes(ocid) ? prev.filter((id) => id !== ocid) : [...prev, ocid]))
  }

  return (
    <div
      data-testid="character-tracking-picker-overlay"
      onClick={props.onClose}
      className="fixed inset-0 flex items-center justify-center bg-[#2B1B10]/40"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-[14px] border border-[#F0DFD1] bg-white p-6"
      >
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {props.allCharacters.map((character) => (
            <label key={character.ocid} className="flex items-center gap-2 py-1 text-sm text-[#2B1B10]">
              <input
                type="checkbox"
                checked={checkedOcids.includes(character.ocid)}
                onChange={() => toggle(character.ocid)}
              />
              {character.characterName}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-[#8A7362] hover:text-[#5B4636]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => props.onSave(checkedOcids)}
            className="rounded-full bg-[#FF7033] px-5 py-2.5 text-sm font-semibold text-[#2B1206] hover:bg-[#E6652E]"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
