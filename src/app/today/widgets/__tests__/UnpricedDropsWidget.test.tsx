// 가격 미입력 드롭 위젯. 이 파일이 지키는 것 셋.
// ① **0건이어도 타일이 남고 크기도 그대로다**(빼면 다음 주에 다시 나타날 때 **새 기능** 처럼 보인다).
//    `기록하기` 줄 자리에 같은 크기의 `전부 기록했습니다` 칸이 선다
// ② **기록할 것이 있을 때만 `기록하기` 줄이 선다**(기록할 것이 없는데 보내면 빈 화면에 도착한다)
// ③ **물욕이라는 말을 쓰지 않는다**

import { renderAtom, findAllOfType, flattenStyle } from '../../../../components/__tests__/render-atom'
import { UnpricedDropsWidget } from '../UnpricedDropsWidget'
import { 뷰모델, 빈_뷰모델 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'

const 있음 = 뷰모델({ unpricedCount: 5 })

async function 위젯(data: TodayViewModel = 있음): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<UnpricedDropsWidget data={data} />)
}

function 모든글자(view: Awaited<ReturnType<typeof renderAtom>>): string {
  return findAllOfType(view.toJSON(), 'Text')
    .flatMap((node) => (node.children ?? []).filter((child) => typeof child === 'string'))
    .join('|')
}

describe('건수가 있을 때', () => {
  it('건수와 `기록하기` 줄을 그린다', async () => {
    const { getByTestId } = await 위젯()

    expect(getByTestId('unpriced-count')).toHaveTextContent('5건')
    expect(getByTestId('unpriced-cta')).toHaveTextContent('기록하기')
  })
})

describe('0건', () => {
  it('타일은 남고 `기록하기` 줄 대신 `전부 기록했습니다` 를 적는다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(빈_뷰모델)

    expect(getByTestId('widget-unpriced-drops')).toBeTruthy()
    expect(getByTestId('unpriced-done')).toHaveTextContent('전부 기록했습니다')
    expect(queryByTestId('unpriced-cta')).toBeNull()
  })

  // 기록을 마치는 순간 위젯 크기가 바뀌면 같은 줄의 최고가 위젯까지 함께 출렁인다.
  it('`전부 기록했습니다` 칸은 `기록하기` 줄과 크기가 같고, 제목 줄 높이도 같다', async () => {
    const 있을때 = await 위젯()
    const 없을때 = await 위젯(빈_뷰모델)
    const 높이 = (view: Awaited<ReturnType<typeof 위젯>>, testID: string): unknown =>
      flattenStyle(view.getByTestId(testID).props.style).height

    expect(높이(없을때, 'unpriced-done')).toBe(높이(있을때, 'unpriced-cta'))
    expect(flattenStyle(없을때.getByTestId('unpriced-head').props.style)).toEqual(
      flattenStyle(있을때.getByTestId('unpriced-head').props.style),
    )
  })
})

// 화면에 보이는 한국어는 `아이템 드롭`이다. 영문 식별자는 그대로 두므로 이 검사는
// **렌더 결과**에만 건다.
describe('`물욕`을 쓰지 않는다', () => {
  it.each([
    ['건수가 있을 때', 있음],
    ['0건', 빈_뷰모델],
  ])('%s: 어디에도 없다', async (_이름, data) => {
    const view = await 위젯(data)

    expect(모든글자(view)).not.toContain('물욕')
  })
})
