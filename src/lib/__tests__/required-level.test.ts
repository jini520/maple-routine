import { describe, expect, it } from 'vitest'
import { getBossRequiredLevel, getContentRequiredLevel, isLevelLocked } from '../required-level'

// ADR-055 결정 4·5: 요구 레벨 조회와 잠금 판정. 값은 게임 레퍼런스 데이터(사용자 확정,
// ADR-006)에서만 오고, 값을 모르면 잠그지 않는다.
describe('required-level', () => {
  describe('getBossRequiredLevel — (보스, 난이도)별 조회', () => {
    it('weekly-bosses.json의 난이도별 요구 레벨을 반환한다', () => {
      expect(getBossRequiredLevel('자쿰', '카오스')).toBe(90)
      expect(getBossRequiredLevel('유피테르', '하드')).toBe(295)
    })

    it('난이도별로 값이 다른 보스(메이린)를 난이도에 맞게 구분해 반환한다', () => {
      expect(getBossRequiredLevel('시즌 보스 메이린', '노멀')).toBe(270)
      expect(getBossRequiredLevel('시즌 보스 메이린', '하드')).toBe(280)
    })

    it('월간 보스(검은마법사)도 같은 표에서 조회된다', () => {
      expect(getBossRequiredLevel('검은마법사', '하드')).toBe(255)
    })

    it('참조표에 없는 보스명이면 null이다', () => {
      expect(getBossRequiredLevel('없는보스', '노멀')).toBeNull()
    })

    it('그 보스에 없는 난이도면 null이다', () => {
      expect(getBossRequiredLevel('자쿰', '익스트림')).toBeNull()
    })
  })

  describe('getContentRequiredLevel — 컨텐츠 단일 값 조회', () => {
    it('일간/주간 템플릿 어느 쪽이든 조회된다', () => {
      expect(getContentRequiredLevel('몬스터파크')).toBe(105)
      expect(getContentRequiredLevel('무릉도장')).toBe(105)
      expect(getContentRequiredLevel('[일일 퀘스트] 소멸의 여로 조사')).toBe(200)
    })

    it('레벨 제한이 없어 필드를 생략한 항목은 null이다', () => {
      expect(getContentRequiredLevel('[길드] 지하 수로')).toBeNull()
      expect(getContentRequiredLevel('[메이플 유니온] 주간 드래곤 퇴치')).toBeNull()
    })

    it('템플릿에 없는 항목명이면 null이다', () => {
      expect(getContentRequiredLevel('없는컨텐츠')).toBeNull()
    })
  })

  describe('isLevelLocked — 모르면 잠그지 않는다 (결정 5)', () => {
    it('캐릭터 레벨이 요구 레벨보다 낮을 때만 잠근다', () => {
      expect(isLevelLocked(199, 200)).toBe(true)
      expect(isLevelLocked(200, 200)).toBe(false)
      expect(isLevelLocked(201, 200)).toBe(false)
    })

    it('요구 레벨을 모르면(데이터 미확정) 잠그지 않는다', () => {
      expect(isLevelLocked(10, null)).toBe(false)
    })

    it('캐릭터 레벨을 모르면(캐시 미스) 잠그지 않는다', () => {
      expect(isLevelLocked(null, 300)).toBe(false)
      expect(isLevelLocked(null, null)).toBe(false)
    })
  })
})
