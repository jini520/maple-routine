/**
 * 조회할 수 없게 된 추적 캐릭터가 **월드 리프를 한 것인가**. 순수 함수 하나가 그 판정을 갖는다.
 *
 * 월드 이전은 ocid 를 새로 만든다. 옛 ocid 는 `character/list` 에서 빠지고 `character/basic` 은
 * 200 에 전 필드 `null` 을 준다. 두 ocid 를 잇는 단서는 **캐릭터 이름·직업·레벨** 셋뿐이고 셋 다
 * 넥슨이 보증해 주는 것이 아니라, 앱은 짚기만 하고 **바꾸는 것은 사용자가 확인할 때만** 한다.
 *
 * 저장소·네트워크를 안 부른다. 판정 재료를 전부 인자로 받아야 규칙을 테스트가 직접 물 수 있다.
 */

import type { MapleCharacter } from '../../types'

/**
 * 이전이 일어나기 전 그 캐릭터에 대해 **마지막으로 아는 것**.
 *
 * 출처는 `character_profiles`(지워지지 않는 스냅샷)다. 5분 TTL 캐시에서 읽으면 캐시 비우기 한
 * 번에 판정 재료가 사라진다.
 *
 * `level`·`jobClass` 가 `null` 일 수 있는 것은 스냅샷이 그것을 모를 수 있어서다. 둘의 처지는
 * 다르다(아래 `detectWorldLeap`).
 */
export interface StrandedCharacter {
  ocid: string
  name: string
  world: string | null
  jobClass: string | null
  level: number | null
}

/**
 * 옮겼다는 사실 하나. **목적지를 아는가, 그리고 그것을 이미 관리 중인가로 갈린다.**
 *
 * 챌린저스에서 조회가 끊기는 길은 리프뿐이라(사용자 판단 2026-09-11) 묻는 조건은 옛 월드
 * 하나다. 이름·직업·레벨은 **어디로 갔는지를 짚는 조건**이라, 못 짚어도 안 묻을 이유가 안 된다.
 *
 * `alreadyTracked` 는 사용자가 리프 뒤에 새 캐릭터를 직접 추가한 경우다. 목적지는 아는데 **바꿀
 * 일이 없다** - 새 것은 이미 목록에 있고 남은 것은 조회할 수 없는 옛 ocid 를 빼는 일뿐이다.
 *
 * `unknown` 이 겨냥하는 것은 닉네임을 바꾸고 리프한 경우다. 두 ocid 를 잇는 단서가
 * 이름·직업·레벨뿐이라 그 사이 `character/list` 를 못 받았으면 바뀐 이름을 알 길이 없다.
 */
export type WorldLeapNotice =
  | { kind: 'confirmed'; from: StrandedCharacter; to: MapleCharacter }
  | { kind: 'alreadyTracked'; from: StrandedCharacter; to: MapleCharacter }
  | { kind: 'unknown'; from: StrandedCharacter }

/**
 * 챌린저스 계열 월드인가. 지금까지 본 이름은 `챌린저스`·`챌린저스2` 다.
 *
 * 접두사로 보는 것은 넥슨이 뒤에 숫자를 붙여 월드를 늘리기 때문이다. `챌린저스3` 이 생겨도
 * 이 판정이 따라간다.
 */
export function isChallengersWorld(world: string): boolean {
  return world.startsWith('챌린저스')
}

/**
 * 이 캐릭터가 **옮겼는가**, 그리고 **어디로 갔는지 아는가**.
 *
 * 묻는 조건은 하나다. 옛 월드가 챌린저스 계열일 것. 챌린저스에서 ocid 가 조회 불가로 굳는 길은
 * 리프뿐이다(사용자 판단 2026-09-11). 일반 월드는 장기 미접속으로 막혔다가 접속하면 풀릴 수
 * 있어 같은 말을 할 수 없고, 옛 월드를 모르면 이 규칙을 걸 근거가 없다. 그 둘만 `null` 이다.
 *
 * 나머지는 **목적지를 짚는 조건**이고, 전부 맞아야 목적지를 말한다. 하나라도 어긋나면 `unknown`
 * 이다. 틀리게 짚으면 사용자가 남의 캐릭터를 자기 관리 목록에 넣는다.
 *
 * | 조건 | 왜 |
 * |---|---|
 * | 옛 직업을 안다 | 이름만으로는 유일하지 않다 |
 * | 이름·직업이 같은 후보가 정확히 하나 | 둘 이상이면 고를 근거가 응답 순서뿐이다 |
 * | 후보 레벨 ≥ 옛 레벨 | 리프는 레벨을 유지하고 그 뒤로 오를 수만 있다 |
 *
 * 옛 레벨만 처지가 다르다. 모르면 그 조건을 건너뛴다. 모름을 못 넘긴다로 읽으면 캐시가 레벨을
 * 잃은 사용자에게 영영 목적지를 못 짚어 준다.
 *
 * **추적 여부는 목적지를 짚는 조건이 아니라 처방을 가르는 조건이다.** 짚은 후보가 이미 추적
 * 중이면 할 일이 교체가 아니라 옛 것 해제이고(`alreadyTracked`), 그 사실은 어디로 갔는지 모른다
 * 와 다르다. 교체할 수 있는 후보가 하나라도 있으면 그것이 먼저다.
 *
 * 후보의 월드가 챌린저스 계열인지는 안 본다. 여기까지 온 캐릭터가 또 다른 챌린저스 월드에
 * 있다면 그것도 이전이라 물을 이유가 같다.
 *
 * @param stranded 조회할 수 없게 된 추적 캐릭터
 * @param roster `character/list` 가 준 **전 계정** 캐릭터. 한 계정만 넘기면 계정을 넘은 리프를 놓친다
 * @param trackedOcids 지금 추적 중인 ocid
 */
export function detectWorldLeap(
  stranded: StrandedCharacter,
  roster: readonly MapleCharacter[],
  trackedOcids: ReadonlySet<string>,
): WorldLeapNotice | null {
  if (stranded.world === null || !isChallengersWorld(stranded.world)) {
    return null
  }

  const candidates =
    stranded.jobClass === null
      ? []
      : roster.filter(
          (character) =>
            character.name === stranded.name &&
            character.jobClass === stranded.jobClass &&
            character.ocid !== stranded.ocid &&
            (stranded.level === null || character.level >= stranded.level),
        )

  const untracked = candidates.filter((character) => !trackedOcids.has(character.ocid))
  if (untracked.length === 1) {
    return { kind: 'confirmed', from: stranded, to: untracked[0]! }
  }
  // 추적 중이라 교체 대상이 못 되는 후보. 교체할 후보가 하나도 없을 때만 본다.
  if (untracked.length === 0 && candidates.length === 1) {
    return { kind: 'alreadyTracked', from: stranded, to: candidates[0]! }
  }
  return { kind: 'unknown', from: stranded }
}
