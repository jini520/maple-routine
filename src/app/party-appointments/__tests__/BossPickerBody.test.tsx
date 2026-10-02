// 보스 추가 단계의 캐릭터 드롭다운. 닫힌 줄에는 얼굴 · 이름 · 레벨만 선다.
import { renderOverlay } from '../../../components/__tests__/render-atom'
import { BossPickerBody } from '../BossPickerBody'

describe('BossPickerBody', () => {
  it('닫힌 줄에 스케줄러 보스 수를 적지 않는다', async () => {
    const view = await renderOverlay(
      <BossPickerBody
        characters={[{ ocid: 'ocid-1', name: '낟낟', level: 295, imageUrl: null, registeredCount: 7 }]}
        ocid="ocid-1"
        onSelectCharacter={jest.fn()}
        sections={{ party: [], scheduler: [], all: [] }}
        picked={[]}
        onPressTile={jest.fn()}
      />,
    )

    expect(view.getByText('낟낟')).toBeTruthy()
    expect(view.queryByText(/스케줄러 보스/)).toBeNull()
  })
})
