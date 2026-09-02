// 가격 미입력 드롭 위젯. 이 파일이 지키는 것 넷 —
// ① **0건이어도 타일이 남는다**(좌표 배치라 빼면 빈 사각형이고, 다음 주에 다시 나타나면 **새 기능**
//    처럼 보인다). 사라지는 대신 `전부 기록했습니다`로 내용이 바뀐다
// ② **2x2 만 이름을 보여 준다**(`값을 적어야지`보다 `그 연마석 얼마에 팔았지`가 손을 움직인다)
// ③ **나머지는 외 N건**. 미리보기에 안 든 것을 버리지 않는다
// ④ **물욕이라는 말을 쓰지 않는다**(정정 14)
//
// **세 크기를 전부 스냅샷으로 찍는다**. v1 배치가 쓰는 것은 2x1 하나뿐이라(정정 13) 나머지 둘은
// 아무도 안 부르는 렌더 분기이고, 그 분기를 지키는 것은 스냅샷뿐이다.

import { renderAtom, findAllOfType } from '../../../../components/__tests__/render-atom'
import { UnpricedDropsWidget } from '../UnpricedDropsWidget'
import { 뷰모델, 미입력, 빈_뷰모델 } from './widget-fixture'
import type { TodayViewModel } from '../../view-model'
import type { WidgetHeight } from '../../../../lib/today/widget-layout'

const 크기 = {
  '2x1': { w: 2, h: 1 },
  '2x2': { w: 2, h: 2 },
  '1x1': { w: 1, h: 1 },
} as const

const 있음 = 뷰모델(미입력(5, ['생명의 연마석', '검은 환생의 불꽃', '미트라의 분노']))

async function 위젯(
  값: { w: number; h: WidgetHeight },
  data: TodayViewModel = 있음,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<UnpricedDropsWidget w={값.w} h={값.h} data={data} />)
}

function 모든글자(view: Awaited<ReturnType<typeof renderAtom>>): string {
  return findAllOfType(view.toJSON(), 'Text')
    .flatMap((node) => (node.children ?? []).filter((child) => typeof child === 'string'))
    .join('|')
}

describe('건수는 세 크기에 다 선다', () => {
  it.each(Object.entries(크기))('%s — 건수를 그린다', async (_이름, 값) => {
    const { getByText } = await 위젯(값)

    expect(getByText('5')).toBeTruthy()
  })

  it.each([
    ['2x1', 크기['2x1']],
    ['2x2', 크기['2x2']],
  ] as const)('%s — 배지 안에 든다', async (_이름, 값) => {
    const { getByTestId } = await 위젯(값)

    expect(getByTestId('unpriced-badge')).toBeTruthy()
  })
})

describe('0건', () => {
  // 사라지면 격자에 구멍이 남는다. 좌표 배치라 아래 타일이 올라오지 않는다.
  it.each(Object.entries(크기))('%s — 타일은 남고 내용만 바뀐다', async (_이름, 값) => {
    const { getByTestId, getByText, queryByTestId } = await 위젯(값, 빈_뷰모델)

    expect(getByTestId('widget-unpriced-drops')).toBeTruthy()
    expect(getByText('전부 기록했습니다')).toBeTruthy()
    expect(queryByTestId('unpriced-badge')).toBeNull()
  })

  // 기록할 것이 없는데 `기록하기`로 보내면 빈 화면에 도착한다.
  it.each(Object.entries(크기))('%s — 행동 유도가 사라진다', async (_이름, 값) => {
    const { queryByTestId } = await 위젯(값, 빈_뷰모델)

    expect(queryByTestId('unpriced-cta')).toBeNull()
  })
})

describe('2x2 만 아이템 이름을 보여 준다', () => {
  it('미리보기 셋이 이름으로 선다', async () => {
    const { getByText } = await 위젯(크기['2x2'])

    expect(getByText('생명의 연마석')).toBeTruthy()
    expect(getByText('검은 환생의 불꽃')).toBeTruthy()
    expect(getByText('미트라의 분노')).toBeTruthy()
  })

  it('반지 레벨은 이름의 일부다 — 같은 반지의 다른 레벨은 다른 물건이다', async () => {
    const view = 뷰모델(미입력(1, ['리스트레인트 링']))
    view.unpricedPreview[0].ringLevel = 3

    const { getByText } = await renderAtom(<UnpricedDropsWidget w={2} h={2} data={view} />)

    expect(getByText('리스트레인트 링 3레벨')).toBeTruthy()
  })

  it.each([
    ['2x1', 크기['2x1']],
    ['1x1', 크기['1x1']],
  ] as const)('%s 은 이름을 그리지 않는다 — 건수와 행동만이다', async (_이름, 값) => {
    const { queryByTestId, queryByText } = await 위젯(값)

    expect(queryByTestId('unpriced-preview')).toBeNull()
    expect(queryByText('생명의 연마석')).toBeNull()
  })
})

describe('미리보기에 안 든 나머지 ( — 타일은 목록이 아니다)', () => {
  it('5건 중 셋만 서면 `외 2건`이 남는다', async () => {
    const view = await 위젯(크기['2x2'])

    expect(모든글자(view)).toContain('외 2건 · 기록하기')
  })

  it('전부 서면 `외 N건`이 없다 — **외 0건** 은 없는 것을 세는 말이다', async () => {
    const view = await 위젯(크기['2x2'], 뷰모델(미입력(2, ['생명의 연마석', '미트라의 분노'])))

    expect(모든글자(view)).toContain('기록하기')
    expect(모든글자(view)).not.toContain('외 ')
  })
})

// 정정 14 — 화면에 보이는 한국어는 `아이템 드롭`이다. 영문 식별자는 그대로 두므로 이 검사는
// **렌더 결과**에만 건다.
describe('`물욕`을 쓰지 않는다', () => {
  it.each(Object.entries(크기))('%s — 어디에도 없다', async (_이름, 값) => {
    const view = await 위젯(값)

    expect(모든글자(view)).not.toContain('물욕')
  })

  it('0건 문구에도 없다', async () => {
    const view = await 위젯(크기['2x2'], 빈_뷰모델)

    expect(모든글자(view)).not.toContain('물욕')
  })
})

