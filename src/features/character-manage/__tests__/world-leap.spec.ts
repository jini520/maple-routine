import { detectWorldLeap, isChallengersWorld } from '../world-leap'
import type { StrandedCharacter } from '../world-leap'
import type { MapleCharacter } from '../../../types'

// 실제로 겪은 사례를 그대로 세운다(2026-09-11). 챌린저스2 의 지내우시가 `character/list` 에서
// 빠지고, 엘리시움에 같은 이름·직업·레벨의 캐릭터가 새 ocid 로 나타났다.
const 옛프로필 = {
  ocid: '4c9b04493104afca3e25fdf619852443',
  name: '지내우시',
  world: '챌린저스2',
  jobClass: '레테',
  level: 285,
}

const 새캐릭터: MapleCharacter = {
  ocid: '62328eaf219a887c3946f3e09918fe8f6fbb98200a15be5bcc73a64995849e9c',
  name: '지내우시',
  world: '엘리시움',
  jobClass: '레테',
  level: 285,
}

const 남 = (over: Partial<MapleCharacter>): MapleCharacter => ({
  ocid: 'other',
  name: '낟낟',
  world: '엘리시움',
  jobClass: '렌',
  level: 295,
  ...over,
})

/** 옮긴 것은 아는데 어디로 갔는지 모르는 결과. */
const 모름 = (from: StrandedCharacter) => ({ kind: 'unknown', from })

describe('isChallengersWorld', () => {
  it.each(['챌린저스', '챌린저스2'])('%s 는 챌린저스 계열이다', (world) => {
    expect(isChallengersWorld(world)).toBe(true)
  })

  it.each(['엘리시움', '스카니아', '스페셜', '베라'])('%s 는 아니다', (world) => {
    expect(isChallengersWorld(world)).toBe(false)
  })
})

// 챌린저스에서 조회가 끊기는 길은 리프뿐이라(사용자 판단), 후보를 짚든 못 짚든 **묻는다**.
// 후보 조건들은 묻는 조건이 아니라 **목적지를 아는 조건**으로 내려갔다.
describe('detectWorldLeap', () => {
  it('겪은 사례를 그대로 짚는다', () => {
    expect(detectWorldLeap(옛프로필, [새캐릭터, 남({})], new Set())).toEqual({
      kind: 'confirmed',
      from: 옛프로필,
      to: 새캐릭터,
    })
  })

  it('후보 레벨이 더 높아도 짚는다', () => {
    // 이전한 뒤 레벨업했을 수 있다.
    const 오른 = { ...새캐릭터, level: 290 }
    expect(detectWorldLeap(옛프로필, [오른], new Set())).toEqual({
      kind: 'confirmed',
      from: 옛프로필,
      to: 오른,
    })
  })

  it('옛 레벨을 모르면 레벨 조건을 건너뛰고 짚는다', () => {
    // 모르는 것을 못 넘긴다로 읽으면, 캐시가 레벨을 잃은 사용자에게 영영 안 묻는다.
    const 레벨없음 = { ...옛프로필, level: null }
    expect(detectWorldLeap(레벨없음, [새캐릭터], new Set())).toEqual({
      kind: 'confirmed',
      from: 레벨없음,
      to: 새캐릭터,
    })
  })

  describe('안 묻는 경우는 옛 월드를 모를 때뿐이다', () => {
    it('옛 월드가 챌린저스 계열이 아니면 안 묻는다', () => {
      // 일반 월드는 장기 미접속으로 조회가 막혔다가 접속하면 풀릴 수 있다(사용자 판단). 그 캐릭터를
      // 옮겼다고 말하면 안 된다.
      expect(detectWorldLeap({ ...옛프로필, world: '베라' }, [새캐릭터], new Set())).toBeNull()
    })

    it('월드를 모르면 안 묻는다', () => {
      // 챌린저스였는지 모르면 위 규칙을 걸 근거가 없다.
      expect(detectWorldLeap({ ...옛프로필, world: null }, [새캐릭터], new Set())).toBeNull()
    })
  })

  describe('옮긴 것만 알고 어디로 갔는지 모를 때', () => {
    it('후보가 없으면 모름 으로 묻는다', () => {
      // 닉네임을 바꾸고 리프한 경우가 여기다. 로스터에는 새 이름이 서 있어 앱이 못 잇는다.
      expect(detectWorldLeap(옛프로필, [남({})], new Set())).toEqual(모름(옛프로필))
    })

    it('이름이 같아도 직업이 다르면 모름 이다', () => {
      const 다른직업 = { ...새캐릭터, jobClass: '보우마스터' }
      expect(detectWorldLeap(옛프로필, [다른직업], new Set())).toEqual(모름(옛프로필))
    })

    it('이름·직업이 같은 후보가 둘이면 모름 이다', () => {
      // 고를 근거가 없다. 앱이 하나를 고르면 그 근거는 응답 순서뿐이다.
      const 둘째 = { ...새캐릭터, ocid: 'another', world: '스카니아' }
      expect(detectWorldLeap(옛프로필, [새캐릭터, 둘째], new Set())).toEqual(모름(옛프로필))
    })

    it('후보 레벨이 옛 레벨보다 낮으면 모름 이다', () => {
      // 리프는 레벨을 유지하고 그 뒤로 오를 수만 있다. 낮으면 동명이인이다.
      expect(detectWorldLeap(옛프로필, [{ ...새캐릭터, level: 284 }], new Set())).toEqual(
        모름(옛프로필),
      )
    })

    it('이름·직업이 같은 후보가 추적 중으로 둘이면 모름 이다', () => {
      // 하나가 추적 중이라 걸러졌다는 사실이 나머지를 고를 근거가 되지는 않는다.
      const 둘째 = { ...새캐릭터, ocid: 'another', world: '스카니아' }
      const 추적중 = new Set([새캐릭터.ocid, 둘째.ocid])
      expect(detectWorldLeap(옛프로필, [새캐릭터, 둘째], 추적중)).toEqual(모름(옛프로필))
    })

    it('추적 중인 후보라도 레벨이 낮으면 모름 이다', () => {
      // 목적지를 짚는 규칙은 추적 여부와 무관하게 같다. 낮으면 동명이인이다.
      const 낮음 = { ...새캐릭터, level: 284 }
      expect(detectWorldLeap(옛프로필, [낮음], new Set([낮음.ocid]))).toEqual(모름(옛프로필))
    })

    it('옛 직업을 모르면 모름 이다', () => {
      // 직업은 후보를 짚는 재료이지 **옮겼는가** 를 정하는 재료가 아니다. 이름 하나로 짚을 수 없을
      // 뿐이라, 안 묻는 대신 목적지를 비운다.
      expect(detectWorldLeap({ ...옛프로필, jobClass: null }, [새캐릭터], new Set())).toEqual(
        모름({ ...옛프로필, jobClass: null }),
      )
    })
  })

  // 사용자가 리프 뒤에 새 캐릭터를 직접 추가한 경우. 앱이 후보를 짚을 수 있는데도 전에는
  // 추적 중이라는 이유로 걸러 모름 으로 떨어졌다.
  describe('옮겨간 캐릭터를 이미 관리 중일 때', () => {
    it('월드를 그대로 짚고 해제를 묻는다', () => {
      expect(detectWorldLeap(옛프로필, [새캐릭터], new Set([새캐릭터.ocid]))).toEqual({
        kind: 'alreadyTracked',
        from: 옛프로필,
        to: 새캐릭터,
      })
    })

    it('추적 중이 아닌 후보가 함께 있으면 그쪽이 이긴다', () => {
      // 교체할 수 있으면 교체가 답이다. 해제를 먼저 보면 지금 확정되는 교체가 해제로 바뀐다.
      const 미추적 = { ...새캐릭터, ocid: 'free', world: '스카니아' }
      expect(detectWorldLeap(옛프로필, [새캐릭터, 미추적], new Set([새캐릭터.ocid]))).toEqual({
        kind: 'confirmed',
        from: 옛프로필,
        to: 미추적,
      })
    })
  })
})
