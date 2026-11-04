/**
 * 캐릭터 고르개의 보기.
 *
 * 두 시트가 같은 목록을 그리므로 그 규칙을 한 자리에 둔다. 라벨이 갈리면 같은 뜻이 화면마다 다르게 읽힌다.
 */
import type { SelectOption } from '../../components/organisms/SelectField/SelectField'
import type { SheetAccount } from '../../features/cashbook/account-names'
import { worldEmblemUrl } from '../../lib/assets/asset-lookup'
import type { SelectDecor } from './select-value'

/** 안 고른 상태의 이름. 헥사 매트릭스의 캐릭터 칸에만 남은 보기다. */
export const NO_CHARACTER_LABEL = '선택 안함'

export function characterOptions(
  characters: ReadonlyArray<{ ocid: string; name: string }>,
): SelectOption[] {
  return [{ value: null, label: NO_CHARACTER_LABEL }, ...requiredCharacterOptions(characters)]
}

/**
 * 캐릭터를 꼭 골라야 하는 폼의 보기. `선택 안함` 이 없다.
 *
 * 사냥 기록이 쓴다. 솔 에르다 조각 보관이 캐릭터별이라 캐릭터 없는 사냥 기록의 조각은 갈 곳이 없다.
 */
export function requiredCharacterOptions(
  characters: ReadonlyArray<{ ocid: string; name: string }>,
): SelectOption[] {
  return characters.map((character) => ({ value: character.ocid, label: character.name }))
}

/** 메이플 ID 보기의 값 머리. ocid 와 같은 목록에 서도 갈리게 붙인다. */
const ACCOUNT_VALUE_PREFIX = 'account:'

/**
 * 기록을 붙일 곳의 보기. 추적 캐릭터 뒤에 메이플 ID 가 선다. `선택 안함` 이 없다.
 *
 * @param accounts 메이플 ID 를 고를 수 없는 갈래는 빈 배열이다
 */
export function ownerOptions(
  characters: ReadonlyArray<{ ocid: string; name: string }>,
  accounts: readonly SheetAccount[],
): SelectOption[] {
  return [
    ...requiredCharacterOptions(characters),
    ...accounts.map((account) => ({ value: `${ACCOUNT_VALUE_PREFIX}${account.accountId}`, label: account.label })),
  ]
}

/** 기록의 주인을 보기 값으로. 주인을 모르는 옛 기록과 새 기록은 `null` 이라 빈 칸으로 열린다. */
export function ownerValueOf(record: { ocid: string | null; accountId?: string } | undefined): string | null {
  if (record?.accountId !== undefined) return `${ACCOUNT_VALUE_PREFIX}${record.accountId}`
  return record?.ocid ?? null
}

/** 고른 보기 값을 기록의 칸으로. 메이플 ID 를 고르면 `ocid` 가 빈다. */
export function ownerFieldsOf(value: string | null): { ocid: string | null; accountId?: string } {
  if (value?.startsWith(ACCOUNT_VALUE_PREFIX) === true) return { ocid: null, accountId: value.slice(ACCOUNT_VALUE_PREFIX.length) }
  return { ocid: value }
}

/** 월드 엠블럼의 크기. 닫힌 줄과 목록 줄이 같다. */
const WORLD_ICON_SIZE = 16

/**
 * 캐릭터 드롭다운 줄에 붙는 것. 월드 엠블럼은 늘, 레벨과 목록 글자는 자리마다 고른다.
 *
 * 목록에 없는 값(메이플 ID 보기)은 `null` 이라 글자만 선다.
 *
 * @param characters 시트가 받은 캐릭터
 * @param extra `level` 은 사냥 폼, `notes` 는 조각 칸의 `보유 n개`(ocid 별)
 */
export function characterDecorOf(
  characters: ReadonlyArray<{ ocid: string; worldKey: string | null; level?: number | null }>,
  extra: { level?: boolean; notes?: Readonly<Record<string, string>> } = {},
): (ocid: string) => SelectDecor | null {
  return (ocid) => {
    const character = characters.find((each) => each.ocid === ocid)
    if (character === undefined) return null
    return {
      icon: worldEmblemUrl(character.worldKey),
      iconSize: WORLD_ICON_SIZE,
      level: extra.level === true ? (character.level ?? null) : null,
      listNote: extra.notes?.[ocid] ?? null,
    }
  }
}
