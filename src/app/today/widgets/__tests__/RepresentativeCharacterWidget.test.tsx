// 대표 캐릭터 위젯. 이 파일이 묻는 것 둘.
// ① 모르는 것을 지어내지 않는가(EXP·엠블럼·직업·길드)
// ② 진행률이 API 가 준 소수 3자리 그대로인가(반올림하면 `99.999%` 가 `100%` 가 된다).

import { within } from '@testing-library/react-native'

import {
  renderAtom,
  findAllOfType,
  flattenStyle,
} from '../../../../components/__tests__/render-atom'
import { RepresentativeCharacterWidget } from '../RepresentativeCharacterWidget'
import { 대표_캐릭터, 뷰모델, 빈_뷰모델 } from './widget-fixture'

const 채워진 = 뷰모델({ representative: 대표_캐릭터 })

async function 위젯(data = 채워진): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(<RepresentativeCharacterWidget data={data} />)
}

describe('모르는 것을 그리지 않는다', () => {
  // 0% 바를 그리면 **경험치가 0** 으로 읽힌다. 없는 것과 0 은 다르다.
  it('`expRate` 가 없으면 EXP 줄 자체가 없다', async () => {
    const { queryByTestId, getByText } = await 위젯(뷰모델({ representative: { ...대표_캐릭터, expRate: undefined } }),
    )

    expect(queryByTestId('representative-exp')).toBeNull()
    // 나머지는 그대로다. EXP 하나가 빠졌다고 카드가 달라지지 않는다.
    expect(getByText('단풍루틴')).toBeTruthy()
  })

  it('`expRate` 가 0 이면 **그린다**. 0 은 아는 값이다', async () => {
    const { getByTestId, getByText } = await 위젯(뷰모델({ representative: { ...대표_캐릭터, expRate: 0 } }),
    )

    expect(getByTestId('representative-exp')).toBeTruthy()
    expect(getByText('0.000%')).toBeTruthy()
  })

  it('엠블럼이 없는 월드면 **엠블럼만** 빠진다', async () => {
    const { queryByTestId, getByText } = await 위젯(뷰모델({ representative: { ...대표_캐릭터, worldKey: 'special' } }),
    )

    expect(queryByTestId('representative-emblem')).toBeNull()
    expect(getByText('단풍루틴')).toBeTruthy()
    expect(getByText('Lv. 291')).toBeTruthy()
    expect(getByText('백호단')).toBeTruthy()
  })

  it('직업을 모르면 레벨만 선다 (옛 캐시 엔트리에는 `jobClass` 가 없다)', async () => {
    const { queryByTestId, getByText } = await 위젯(뷰모델({ representative: { ...대표_캐릭터, jobClass: undefined } }),
    )

    expect(queryByTestId('representative-job')).toBeNull()
    expect(getByText('Lv. 291')).toBeTruthy()
  })

  it.each([
    ['미가입(null)', null],
    ['모름(undefined)', undefined],
  ])('길드가 %s 이면 그 줄이 없다', async (_이름, guildName) => {
    const { queryByTestId } = await 위젯(뷰모델({ representative: { ...대표_캐릭터, guildName } }),
    )

    expect(queryByTestId('representative-guild')).toBeNull()
  })
})

describe('EXP 표기', () => {
  // API 가 `"80.300"` 을 준다. 반올림하면 `99.999%` 가 `100%` 가 되어 **다 찼다** 고 거짓을 말한다.
  it('소수 3자리를 그대로 쓴다', async () => {
    const { getByText } = await 위젯(뷰모델({ representative: { ...대표_캐릭터, expRate: 99.999 } }),
    )

    expect(getByText('99.999%')).toBeTruthy()
  })

  it('진행률 바가 그 값을 채운다', async () => {
    const view = await 위젯()

    // 바는 `ProgressBar` atom 이 그리므로 여기서 묻는 것은 **넘긴 값이 그 비율인가** 다. 트리를 직접
    // 훑는 이유는 `ContentCards` 테스트가 적어 둔 것과 같다. 트랙이 `accessible` 없이
    // `accessibilityRole` 만 달고 있어 RNTL 14 의 역할 질의로는 안 잡힌다.
    const track = findAllOfType(view.toJSON(), 'View').find(
      (node) => node.props.accessibilityRole === 'progressbar',
    )

    expect(track?.props.accessibilityValue).toEqual({ now: 80.3, min: 0, max: 100 })
  })
})

// EXP 를 오른쪽 끝의 좁은 열에 두면 바가 짧아 진행이 잘 안 보인다. 닉네임 · 레벨 줄 아래에 같은 폭으로 둔다.
describe('EXP 칸의 자리', () => {
  it('EXP 칸은 닉네임 · 레벨 줄과 같은 열 안에 선다', async () => {
    const view = await 위젯()
    const 열 = within(view.getByTestId('representative-lines'))

    expect(열.getByTestId('representative-name-line')).toBeTruthy()
    expect(열.getByTestId('representative-exp')).toBeTruthy()
  })
})

describe('**대표 없음** 은 추적 캐릭터가 없을 때뿐이다', () => {
  it('그때는 한 줄로 그 사실을 말한다. **임시 대표** 표시도 CTA 도 없다', async () => {
    const { getByText, queryByTestId } = await 위젯(빈_뷰모델)

    expect(getByText('추적 중인 캐릭터가 없습니다')).toBeTruthy()
    expect(queryByTestId('representative-exp')).toBeNull()
    expect(queryByTestId('representative-emblem')).toBeNull()
  })
})

describe('길드는 닉네임 옆이다', () => {
  // 길드는 **누구인가** 의 일부지 별도 항목이 아니다.
  it('닉네임과 길드가 같은 줄이다', async () => {
    const view = await 위젯()
    const 이름줄 = within(view.getByTestId('representative-name-line'))

    expect(이름줄.getByText('단풍루틴')).toBeTruthy()
    expect(이름줄.getByText('백호단')).toBeTruthy()
  })

  // 길드는 잘리면 **다른 길드로 읽힌다**. 닉네임은 초상화가 이미 **누구인가** 를 말한다.
  it('자리가 모자라면 닉네임이 줄어든다. 길드가 아니라', async () => {
    const { getByTestId } = await 위젯()

    expect(flattenStyle(getByTestId('representative-name').props.style).flexShrink).toBe(1)
    expect(flattenStyle(getByTestId('representative-guild').props.style).flexShrink).toBe(0)
  })
})

// 이 카드의 레벨·EXP 는 조회 불가 캐릭터에서 **마지막으로 본 값**이다. 말하지 않으면 지금의
// 사실로 읽힌다.
describe('조회 불가 대표 캐릭터', () => {
  const 조회불가 = 뷰모델({ representative: { ...대표_캐릭터, unavailable: true } })

  // EXP 는 조회를 못 한 순간 굳은 값이다. 바가 그대로 서 있으면 지금의 진행도로 읽힌다.
  it('EXP 바 자리에 배지가 선다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(조회불가)

    expect(getByTestId('representative-issue')).toBeTruthy()
    expect(queryByTestId('representative-exp')).toBeNull()
  })

  it('멀쩡하면 EXP 바가 그대로다', async () => {
    const { getByTestId, queryByTestId } = await 위젯()

    expect(getByTestId('representative-exp')).toBeTruthy()
    expect(queryByTestId('representative-issue')).toBeNull()
  })

  // 이름 옆은 비운다. 같은 말을 두 번 하고, 그 자리는 닉네임이 먼저 줄어드는 자리다.
  it('배지는 EXP 블록 안에만 하나 선다', async () => {
    const { getAllByText, getByTestId } = await 위젯(조회불가)

    expect(getAllByText('조회 불가')).toHaveLength(1)
    expect(getByTestId('representative-issue-block')).toBeTruthy()
  })

  // 아는 값까지 버리지 않는다. 이름·레벨은 그대로 서고 배지가 그 값의 나이를 말한다.
  it('이름은 그대로 그린다', async () => {
    const { getByText } = await 위젯(조회불가)

    expect(getByText(대표_캐릭터.name)).toBeTruthy()
  })
})

// 카드의 얼굴에도 표식이 붙는다. EXP 자리의 배지와 함께 선다.
describe('조회 불가 대표의 얼굴', () => {
  it('얼굴에 표식이 붙는다', async () => {
    const { getByTestId } = await 위젯(뷰모델({ representative: { ...대표_캐릭터, unavailable: true } }),
    )

    expect(getByTestId('portrait-unavailable')).toBeTruthy()
  })

  it('멀쩡하면 안 붙는다', async () => {
    const { queryByTestId } = await 위젯()

    expect(queryByTestId('portrait-unavailable')).toBeNull()
  })
})
