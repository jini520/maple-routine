import { renderOverlay } from '../../../components/__tests__/render-atom'
import { ServerMaintenanceLock } from '../ServerMaintenanceLock'

describe('ServerMaintenanceLock', () => {
  // 점검은 기다리는 것 말고 할 일이 없다. 버튼이 있으면 눌러서 풀리는 것으로 읽힌다.
  it('제목과 설명을 보이고 버튼이 없다', async () => {
    const view = await renderOverlay(<ServerMaintenanceLock until={null} />)

    expect(view.getByText('서버 점검 중입니다')).toBeTruthy()
    expect(view.getByText('점검이 끝나면 자동으로 다시 열립니다')).toBeTruthy()
    expect(view.queryAllByRole('button')).toHaveLength(0)
  })

  // 기기의 시간대가 달라도 한국 시각으로 적는다. 점검 공지가 한국 시각으로 나간다.
  it('종료 예정 시각을 한국 시각으로 칸에 적는다', async () => {
    const view = await renderOverlay(<ServerMaintenanceLock until={Date.parse('2026-12-01T21:05:00Z')} />)

    expect(view.getByText('종료 예정')).toBeTruthy()
    expect(view.getByText('12월 2일 06:05')).toBeTruthy()
  })

  it('종료 예정 시각이 없으면 칸을 그리지 않는다', async () => {
    const view = await renderOverlay(<ServerMaintenanceLock until={null} />)

    expect(view.queryByText('종료 예정')).toBeNull()
  })
})
