import { detectWorldLeap, isChallengersWorld } from '../world-leap'
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

describe('isChallengersWorld', () => {
  it.each(['챌린저스', '챌린저스2'])('%s 는 챌린저스 계열이다', (world) => {
    expect(isChallengersWorld(world)).toBe(true)
  })

  it.each(['엘리시움', '스카니아', '스페셜', '베라'])('%s 는 아니다', (world) => {
    expect(isChallengersWorld(world)).toBe(false)
  })
})

describe('detectWorldLeap', () => {
  it('겪은 사례를 그대로 짚는다', () => {
    expect(detectWorldLeap(옛프로필, [새캐릭터, 남({})], new Set())).toEqual({
      from: 옛프로필,
      to: 새캐릭터,
    })
  })

  it('옛 월드가 챌린저스 계열이 아니면 안 묻는다', () => {
    // 일반 월드에서 캐릭터가 사라지는 것은 삭제일 수 있다. 그때 동명 캐릭터를 짚으면 남의
    // 캐릭터를 관리 목록에 넣는다.
    const 일반 = { ...옛프로필, world: '베라' }
    expect(detectWorldLeap(일반, [새캐릭터], new Set())).toBeNull()
  })

  it('월드를 모르면 안 묻는다', () => {
    expect(detectWorldLeap({ ...옛프로필, world: null }, [새캐릭터], new Set())).toBeNull()
  })

  it('이름이 같아도 직업이 다르면 안 묻는다', () => {
    expect(
      detectWorldLeap(옛프로필, [{ ...새캐릭터, jobClass: '보우마스터' }], new Set()),
    ).toBeNull()
  })

  it('이름·직업이 같은 후보가 둘이면 안 묻는다', () => {
    // 고를 근거가 없다. 앱이 하나를 고르면 그 근거는 응답 순서뿐이다.
    const 둘째 = { ...새캐릭터, ocid: 'another', world: '스카니아' }
    expect(detectWorldLeap(옛프로필, [새캐릭터, 둘째], new Set())).toBeNull()
  })

  it('후보 레벨이 옛 레벨보다 낮으면 안 묻는다', () => {
    // 리프는 레벨을 유지하고 그 뒤로 오를 수만 있다. 낮으면 동명이인이다.
    expect(detectWorldLeap(옛프로필, [{ ...새캐릭터, level: 284 }], new Set())).toBeNull()
  })

  it('후보 레벨이 더 높으면 묻는다', () => {
    // 이전한 뒤 레벨업했을 수 있다.
    const 오른 = { ...새캐릭터, level: 290 }
    expect(detectWorldLeap(옛프로필, [오른], new Set())).toEqual({ from: 옛프로필, to: 오른 })
  })

  it('후보가 이미 추적 중이면 안 묻는다', () => {
    // 사용자가 이미 손을 댄 상태다. 그때 필요한 것은 교체가 아니라 옛 것 해제이고 `✕` 가 한다.
    expect(detectWorldLeap(옛프로필, [새캐릭터], new Set([새캐릭터.ocid]))).toBeNull()
  })

  it('후보가 없으면 안 묻는다', () => {
    expect(detectWorldLeap(옛프로필, [남({})], new Set())).toBeNull()
  })

  it('옛 레벨을 모르면 레벨 조건을 건너뛰고 나머지로 판정한다', () => {
    // 모르는 것을 못 넘긴다로 읽으면, 캐시가 레벨을 잃은 사용자에게 영영 안 묻는다.
    const 레벨없음 = { ...옛프로필, level: null }
    expect(detectWorldLeap(레벨없음, [새캐릭터], new Set())).toEqual({
      from: 레벨없음,
      to: 새캐릭터,
    })
  })

  it('직업을 모르면 안 묻는다', () => {
    // 레벨과 달리 직업은 **유일성을 세우는 조건**이다. 없으면 이름 하나로만 짚게 된다.
    expect(detectWorldLeap({ ...옛프로필, jobClass: null }, [새캐릭터], new Set())).toBeNull()
  })
})
