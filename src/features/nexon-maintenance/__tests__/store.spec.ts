import { nexonMaintenanceReporter, resetNexonMaintenanceForTest, useNexonMaintenanceStore } from '../store'

const 기본 = '/maplestory/v1/character/basic'
const 목록 = '/maplestory/v1/character/list'
const 공지 = '/maplestory/v1/notice'

const 지금 = () => useNexonMaintenanceStore.getState()

beforeEach(() => {
  resetNexonMaintenanceForTest()
})

describe('메이플스토리 API 점검', () => {
  it('점검 응답을 받으면 배너가 선다', () => {
    nexonMaintenanceReporter.maintenance('game', 기본)

    expect(지금().scope).toBe('game')
  })

  // character/list 는 메이플스토리 API 점검 중에도 200 이다. 그 성공으로 내리면 점검 중에 배너가 사라진다.
  it('점검 중에도 열리는 경로의 성공으로는 내리지 않는다', () => {
    nexonMaintenanceReporter.maintenance('game', 기본)
    nexonMaintenanceReporter.succeeded(목록)

    expect(지금().scope).toBe('game')
  })

  it('막혔던 경로가 전부 다시 성공해야 내린다', () => {
    nexonMaintenanceReporter.maintenance('game', 기본)
    nexonMaintenanceReporter.maintenance('game', 공지)
    nexonMaintenanceReporter.succeeded(기본)
    expect(지금().scope).toBe('game')

    nexonMaintenanceReporter.succeeded(공지)
    expect(지금().scope).toBeNull()
  })
})

describe('Open API 점검', () => {
  it('어느 경로든 성공하면 내린다. 모든 경로가 막히는 점검이다', () => {
    nexonMaintenanceReporter.maintenance('api', 기본)
    nexonMaintenanceReporter.succeeded(목록)

    expect(지금().scope).toBeNull()
  })

  it('메이플스토리 API 점검과 겹치면 Open API 점검을 말한다. 더 넓게 막힌 쪽이다', () => {
    nexonMaintenanceReporter.maintenance('game', 기본)
    nexonMaintenanceReporter.maintenance('api', 목록)

    expect(지금().scope).toBe('api')
  })
})

describe('닫기', () => {
  it('닫으면 이번 점검 동안 다시 서지 않는다', () => {
    nexonMaintenanceReporter.maintenance('game', 기본)
    지금().dismiss()
    nexonMaintenanceReporter.maintenance('game', 공지)

    expect(지금().scope).toBeNull()
  })

  it('점검이 끝난 뒤 다음 점검에는 다시 선다', () => {
    nexonMaintenanceReporter.maintenance('game', 기본)
    지금().dismiss()
    nexonMaintenanceReporter.succeeded(기본)
    nexonMaintenanceReporter.maintenance('game', 기본)

    expect(지금().scope).toBe('game')
  })

  it('메이플스토리 API 점검을 닫은 뒤 Open API 점검이 오면 다시 선다. 다른 점검이다', () => {
    nexonMaintenanceReporter.maintenance('game', 기본)
    지금().dismiss()
    nexonMaintenanceReporter.maintenance('api', 목록)

    expect(지금().scope).toBe('api')
  })
})
