// 대표 캐릭터 위젯([[ADR-146]] 정정 2·7·8). 이 파일이 묻는 것 셋 —
// ① 세 크기가 **같은 구조**를 그리는가(정정 7) ② 모르는 것을 지어내지 않는가(EXP·엠블럼·직업·길드)
// ③ 진행률이 API 가 준 소수 3자리 그대로인가(반올림하면 `99.999%` 가 `100%` 가 된다).
//
// **크기 셋을 전부 스냅샷으로 찍는다** — v1 배치가 쓰는 것은 4x1 하나뿐이라(정정 13) 나머지 둘은
// 아무도 안 부르는 렌더 분기다. 그 분기의 유일한 안전망이 스냅샷이라는 것이 그 결정의 대가이고,
// 그래서 여기서 회수한다.

import {
  renderAtom,
  findAllOfType,
  flattenStyle,
  기본테마,
} from '../../../../components/__tests__/render-atom'
import { RepresentativeCharacterWidget } from '../RepresentativeCharacterWidget'
import { 대표_캐릭터, 뷰모델, 빈_뷰모델 } from './widget-fixture'
import type { WidgetHeight } from '../../../../lib/widget-layout'

const 채워진 = 뷰모델({ representative: 대표_캐릭터 })

async function 위젯(
  크기: { w: number; h: WidgetHeight },
  data = 채워진,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<RepresentativeCharacterWidget w={크기.w} h={크기.h} data={data} />)
}

const 크기 = {
  '4x1': { w: 4, h: 1 },
  '4x2': { w: 4, h: 2 },
  '2x2': { w: 2, h: 2 },
} as const

describe('세 크기가 같은 구조다 ([[ADR-146]] 정정 7)', () => {
  it.each(Object.entries(크기))('%s — 엠블럼 + 세 줄 + EXP', async (_이름, 값) => {
    const { getByText, getByTestId } = await 위젯(값)

    expect(getByTestId('representative-emblem')).toBeTruthy()
    expect(getByText('단풍루틴')).toBeTruthy()
    expect(getByText('Lv. 291')).toBeTruthy()
    expect(getByText('아크메이지(불,독)')).toBeTruthy()
    expect(getByText('백호단')).toBeTruthy()
    expect(getByTestId('representative-exp')).toBeTruthy()
  })

  it.each(Object.entries(크기))('%s — 스냅샷', async (_이름, 값) => {
    const view = await 위젯(값)

    expect(view.toJSON()).toMatchSnapshot()
  })
})

describe('모르는 것을 그리지 않는다', () => {
  // 0% 바를 그리면 «경험치가 0» 으로 읽힌다 — 없는 것과 0 은 다르다([[ADR-146]] 정정 8).
  it('`expRate` 가 없으면 EXP 줄 자체가 없다', async () => {
    const { queryByTestId, getByText } = await 위젯(
      크기['4x1'],
      뷰모델({ representative: { ...대표_캐릭터, expRate: undefined } }),
    )

    expect(queryByTestId('representative-exp')).toBeNull()
    // 나머지는 그대로다 — EXP 하나가 빠졌다고 카드가 달라지지 않는다.
    expect(getByText('단풍루틴')).toBeTruthy()
  })

  it('`expRate` 가 0 이면 **그린다** — 0 은 아는 값이다', async () => {
    const { getByTestId, getByText } = await 위젯(
      크기['4x1'],
      뷰모델({ representative: { ...대표_캐릭터, expRate: 0 } }),
    )

    expect(getByTestId('representative-exp')).toBeTruthy()
    expect(getByText('0.000%')).toBeTruthy()
  })

  it('엠블럼 매핑에 없는 월드면 **엠블럼만** 빠진다', async () => {
    const { queryByTestId, getByText } = await 위젯(
      크기['4x1'],
      뷰모델({ representative: { ...대표_캐릭터, world: '없는월드' } }),
    )

    expect(queryByTestId('representative-emblem')).toBeNull()
    expect(getByText('단풍루틴')).toBeTruthy()
    expect(getByText('Lv. 291')).toBeTruthy()
    expect(getByText('백호단')).toBeTruthy()
  })

  it('직업을 모르면 레벨만 선다 (옛 캐시 엔트리에는 `jobClass` 가 없다)', async () => {
    const { queryByTestId, getByText } = await 위젯(
      크기['4x1'],
      뷰모델({ representative: { ...대표_캐릭터, jobClass: undefined } }),
    )

    expect(queryByTestId('representative-job')).toBeNull()
    expect(getByText('Lv. 291')).toBeTruthy()
  })

  it.each([
    ['미가입(null)', null],
    ['모름(undefined)', undefined],
  ])('길드가 %s 이면 그 줄이 없다', async (_이름, guildName) => {
    const { queryByTestId } = await 위젯(
      크기['4x1'],
      뷰모델({ representative: { ...대표_캐릭터, guildName } }),
    )

    expect(queryByTestId('representative-guild')).toBeNull()
  })
})

describe('EXP 표기', () => {
  // API 가 `"80.300"` 을 준다 — 반올림하면 `99.999%` 가 `100%` 가 되어 «다 찼다» 고 거짓을 말한다.
  it('소수 3자리를 그대로 쓴다', async () => {
    const { getByText } = await 위젯(
      크기['4x1'],
      뷰모델({ representative: { ...대표_캐릭터, expRate: 99.999 } }),
    )

    expect(getByText('99.999%')).toBeTruthy()
  })

  it('진행률 바가 그 값을 채운다', async () => {
    const view = await 위젯(크기['4x1'])

    // 바는 `ProgressBar` atom 이 그리므로 여기서 묻는 것은 «넘긴 값이 그 비율인가» 다. 트리를 직접
    // 훑는 이유는 `ContentCards` 테스트가 적어 둔 것과 같다 — 트랙이 `accessible` 없이
    // `accessibilityRole` 만 달고 있어 RNTL 14 의 역할 질의로는 안 잡힌다.
    const track = findAllOfType(view.toJSON(), 'View').find(
      (node) => node.props.accessibilityRole === 'progressbar',
    )

    expect(track?.props.accessibilityValue).toEqual({ now: 80.3, min: 0, max: 100 })
  })
})

describe('«대표 없음» 은 추적 캐릭터가 없을 때뿐이다 ([[ADR-146]] 정정 2)', () => {
  it('그때는 한 줄로 그 사실을 말한다 — «임시 대표» 표시도 CTA 도 없다', async () => {
    const { getByText, queryByTestId } = await 위젯(크기['4x1'], 빈_뷰모델)

    expect(getByText('추적 중인 캐릭터가 없습니다')).toBeTruthy()
    expect(queryByTestId('representative-exp')).toBeNull()
    expect(queryByTestId('representative-emblem')).toBeNull()
  })
})

describe('2x2 는 잘리되 지우지 않는다 ([[ADR-146]] 정정 7)', () => {
  it('직업 줄이 한 줄로 잘린다 — 158 폭의 한계다', async () => {
    const { getByTestId } = await 위젯(크기['2x2'])

    expect(getByTestId('representative-job').props.numberOfLines).toBe(1)
  })

  it('이름 색은 테마 `text` 다 — 강조색을 얹지 않는다', async () => {
    const { getByText } = await 위젯(크기['2x2'])

    expect(flattenStyle(getByText('단풍루틴').props.style).color).toBe(기본테마.text)
  })
})
