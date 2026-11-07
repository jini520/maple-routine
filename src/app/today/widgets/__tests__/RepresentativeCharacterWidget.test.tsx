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

// 이 카드의 레벨은 조회 불가 캐릭터에서 **마지막으로 본 값**이다. 말하지 않으면 지금의
// 사실로 읽힌다.
describe('조회 불가 대표 캐릭터', () => {
  const 조회불가 = 뷰모델({ representative: { ...대표_캐릭터, unavailable: true } })

  // 조회를 못 하면 보여 줄 EXP 가 없다. 굳은 바가 서 있으면 지금의 진행도로 읽힌다.
  it('EXP 칸을 비운다', async () => {
    const { queryByTestId } = await 위젯(조회불가)

    expect(queryByTestId('representative-exp')).toBeNull()
  })

  it('멀쩡하면 EXP 바가 서고 알약은 없다', async () => {
    const { getByTestId, queryByTestId } = await 위젯()

    expect(getByTestId('representative-exp')).toBeTruthy()
    expect(queryByTestId('representative-issue')).toBeNull()
  })

  // 글자 열 안에 서면 닉네임 · 레벨 줄을 밀어낸다. 카드 오른쪽 위 구석에 서고 글자가 그 폭만큼 비켜 선다.
  it('알약은 글자 열 밖 오른쪽 위에 하나 선다', async () => {
    const view = await 위젯(조회불가)
    const 알약 = view.getByTestId('representative-issue')
    const 카드 = findAllOfType(view.toJSON(), 'View').find(
      (node) => node.props.testID === 'widget-representative-character',
    )
    const 마지막 = 카드?.children?.at(-1)

    expect(view.getAllByText('조회 불가')).toHaveLength(1)
    expect(within(view.getByTestId('representative-lines')).queryByTestId('representative-issue')).toBeNull()
    expect(typeof 마지막 === 'object' ? 마지막?.props.testID : undefined).toBe('representative-issue')
    expect(flattenStyle(알약.props.style).alignSelf).toBe('flex-start')
  })

  // 아는 값까지 버리지 않는다. 이름 · 레벨은 그대로 서고 알약이 그 값의 나이를 말한다.
  it('이름은 그대로 그린다', async () => {
    const { getByText } = await 위젯(조회불가)

    expect(getByText(대표_캐릭터.name)).toBeTruthy()
  })

  // 마지막으로 본 룩은 지금 모습이라고 말할 수 없다. 누구인지는 이름이 말한다.
  it('전신 그림 대신 흰 실루엣이 표식 없이 선다', async () => {
    const view = await 위젯(조회불가)

    expect(view.getByTestId('representative-figure-unknown')).toBeTruthy()
    expect(view.queryByTestId('representative-figure')).toBeNull()
    expect(view.queryByTestId('portrait-unavailable')).toBeNull()
  })
})

describe('전신 그림', () => {
  it('좌우를 뒤집어 그린다', async () => {
    const view = await 위젯()

    expect(flattenStyle(view.getByTestId('representative-figure-frame').props.style).transform).toEqual([{ scaleX: -1 }])
  })

  // 큰 모자 · 무기 · 날개가 그림 자리 밖으로 나가도 다 보여야 한다(사용자 지정 2026-11-07).
  it.each([
    ['전신 그림', 채워진],
    ['흰 실루엣', 뷰모델({ representative: { ...대표_캐릭터, unavailable: true } })],
  ])('멈춘 %s을 그림 자리에서 자르지 않는다', async (_, data) => {
    const view = await 위젯(data)

    expect(flattenStyle(view.getByTestId('representative-figure-frame').props.style).overflow).not.toBe('hidden')
  })
})
