// 배지 하나가 열세 가지 모양을 낸다. 여기서 지키는 것은 **풀린 값**이다.
// NativeWind 가 렌더 시점에 `className` 을 style 로 바꿔 먹어 트리에 문자열이 안 남는다.
//
// 토큰 색 기대값은 손으로 적지 않고 `job-themes.json` 에서 읽는다. 난이도 색은 테마
// 토큰이 아니라 게임 안의 색이라 파일에 박힌 값을 그대로 단언한다.
import { View } from 'react-native'

import { type AtomElement, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { Badge } from '../Badge'

/** 그라디언트 배지는 상자가 글자의 부모다. 평면 배지는 `Text` 하나라 부모가 없다. */
function boxOf(label: AtomElement): AtomElement {
  const parent = label.parent
  if (parent === null) throw new Error('그라디언트 상자를 찾지 못했습니다')
  return parent
}

describe('평면 variant: 색만 갈리고 상자는 같다', () => {
  // 컨텐츠 카테고리 색은 테마 토큰이 아니라 리터럴 hex 에 `/20` 알파다. 알파가 조용히 사라지는
  // 종류의 실패라 배경이 실제로 붙는지 본다.
  it.each([
    ['epicDungeon', '4dd2ff'],
    ['mapleUnion', 'ffc93c'],
    ['guild', 'ff5c5c'],
  ] as const)('%s 는 글자가 불투명하고 배경만 알파를 갖는다', async (variant, hex) => {
    const { getByText } = await renderAtom(<Badge variant={variant}>라벨</Badge>)

    const style = flattenStyle(getByText('라벨').props.style)
    // 같은 색이 글자는 진하게, 배경은 옅게 깔린다. `33` 이 20% 알파다. 이것이 조용히 사라지면
    // 배경이 글자와 같은 진하기가 되어 라벨을 못 읽는다.
    expect(style.color).toBe(`#${hex}`)
    expect(style.backgroundColor).toBe(`#${hex}33`)
  })

  it('모든 평면 variant 의 상자가 한 치도 다르지 않다', async () => {
    const 기준 = flattenStyle(
      (await renderAtom(<Badge variant="primary">기준</Badge>)).getByText('기준').props.style,
    )

    for (const variant of ['third', 'secondary', 'muted', 'neutral', 'guild'] as const) {
      const { getByText } = await renderAtom(<Badge variant={variant}>칸</Badge>)
      expect(flattenStyle(getByText('칸').props.style)).toMatchObject({
        paddingHorizontal: 기준.paddingHorizontal,
        paddingVertical: 기준.paddingVertical,
        fontSize: 기준.fontSize,
        borderRadius: 기준.borderRadius,
      })
    }
  })
})

describe('size 둘', () => {
  // 난이도 배지도 상태 배지와 같은 상자를 쓴다. 그라디언트 배지만
  // 혼자 작으면 같은 줄에 선 배지들과 높이가 어긋난다.
  // 테두리를 여백 안쪽으로 넣는다. Yoga 는 테두리를 패딩처럼 바깥 크기에 더하므로 빼 주지 않으면
  // 난이도 배지만 평면 배지보다 커진다.
  it('여백과 테두리를 더하면 평면 배지의 여백과 같다', async () => {
    const 평면 = flattenStyle(
      (await renderAtom(<Badge variant="muted">진행 불가</Badge>)).getByText('진행 불가').props.style,
    ) as Record<string, number>

    // 테두리를 클래스로 그리는 outline 도 같은 계약이다.
    const 아웃라인 = flattenStyle(
      (await renderAtom(<Badge variant="outline">v1.0.7</Badge>)).getByText('v1.0.7').props.style,
    ) as Record<string, number>
    expect(아웃라인.paddingVertical).toBe(평면.paddingVertical - 1)
    expect(아웃라인.paddingHorizontal).toBe(평면.paddingHorizontal - 1)

    for (const variant of ['easy', 'normal', 'hard', 'chaos', 'extreme'] as const) {
      const 상자 = flattenStyle(
        boxOf((await renderAtom(<Badge variant={variant}>{variant}</Badge>)).getByText(variant)).props.style,
      ) as Record<string, number>
      expect(상자.paddingVertical + 상자.borderWidth).toBe(평면.paddingVertical)
      expect(상자.paddingHorizontal + 상자.borderWidth).toBe(평면.paddingHorizontal)
    }
  })

  // 난이도만 글자가 작다. 이름이 최대 넉 자라 12px 로는 배지가 넓어진다.
  it('난이도는 글자가 10px 다. 크기의 기본값을 variant 가 덮는다', async () => {
    const 평면 = await renderAtom(<Badge variant="muted">진행 불가</Badge>)
    const 난이도 = await renderAtom(<Badge variant="hard">하드</Badge>)

    expect(flattenStyle(평면.getByText('진행 불가').props.style).fontSize).toBe(12)
    expect(flattenStyle(난이도.getByText('하드').props.style).fontSize).toBe(10)

    // `mini` 는 더 좁은 자리를 위한 것이라 variant 의 10px 에 안 밀린다.
    const 작게 = await renderAtom(<Badge variant="hard" size="mini">하드</Badge>)
    expect(flattenStyle(작게.getByText('하드').props.style).fontSize).toBe(9)
  })

  it('mini 는 높이와 글자만 줄인다. 색은 한 값도 안 갈린다', async () => {
    const 기본 = await renderAtom(<Badge variant="chaos">카오스</Badge>)
    const 작게 = await renderAtom(<Badge variant="chaos" size="mini">카오스</Badge>)

    const 상자 = (v: Awaited<ReturnType<typeof renderAtom>>): Record<string, unknown> =>
      flattenStyle(boxOf(v.getByText('카오스')).props.style) as Record<string, unknown>
    const 글자 = (v: Awaited<ReturnType<typeof renderAtom>>): Record<string, unknown> =>
      flattenStyle(v.getByText('카오스').props.style) as Record<string, unknown>

    // 둘 다 여백이 높이를 만든다. mini 는 여백과 글자가 더 작다.
    expect(Number(상자(작게).paddingVertical)).toBeLessThan(Number(상자(기본).paddingVertical))
    expect(Number(글자(작게).fontSize)).toBeLessThan(Number(글자(기본).fontSize))
    expect(글자(작게).color).toBe(글자(기본).color)
    expect(상자(작게).borderColor).toBe(상자(기본).borderColor)
  })
})

// 높이가 `h-5`·`h-4` 로 고정인 상자는 글자만 커지면 잘린다.
// 배지 높이 = 줄 높이 + 여백 + 테두리. 셋을 합치면 variant 와 무관하게 같아야 한다. 난이도는
// 글자가 10px 이고 나머지는 12px 인데도 같은 자리에서 어긋나면 안 된다.
describe('높이는 variant 를 안 탄다', () => {
  it('줄 높이 + 여백 + 테두리 합이 모든 variant 에서 같다', async () => {
    const 합 = (s: Record<string, number>): number =>
      s.lineHeight + (s.paddingVertical ?? 0) * 2 + (s.borderWidth ?? 0) * 2

    const 기준 = 합(
      flattenStyle(
        (await renderAtom(<Badge variant="muted">완료</Badge>)).getByText('완료').props.style,
      ) as Record<string, number>,
    )

    for (const variant of ['primary', 'secondary', 'outline', 'dashed', 'guild'] as const) {
      const s = flattenStyle(
        (await renderAtom(<Badge variant={variant}>칸</Badge>)).getByText('칸').props.style,
      ) as Record<string, number>
      expect(합(s)).toBe(기준)
    }

    for (const variant of ['easy', 'normal', 'hard', 'chaos', 'extreme'] as const) {
      const 상자 = flattenStyle(
        boxOf((await renderAtom(<Badge variant={variant}>{variant}</Badge>)).getByText(variant))
          .props.style,
      ) as Record<string, number>
      const 글자 = flattenStyle(
        (await renderAtom(<Badge variant={variant}>{variant}</Badge>)).getByText(variant).props
          .style,
      ) as Record<string, number>
      expect(글자.lineHeight + 상자.paddingVertical * 2 + 상자.borderWidth * 2).toBe(기준)
    }
  })
})

describe('글자 배수', () => {
  // 높이를 못박지 않는다. 상자에 높이만 박으면 평면 배지는 `<Text>` 하나라 글자가 위로 쏠린다.
  // 여백이 높이를 만들면 그 일이 없다.
  it('어느 크기도 높이를 못박지 않는다', async () => {
    for (const size of ['default', 'mini'] as const) {
      const 평면 = flattenStyle(
        (await renderAtom(<Badge variant="secondary" size={size}>CLEAR</Badge>)).getByText('CLEAR')
          .props.style,
      )
      expect(평면.height).toBeUndefined()
      expect(평면.paddingVertical).toBeGreaterThan(0)

      const 난이도 = flattenStyle(
        boxOf(
          (await renderAtom(<Badge variant="hard" size={size}>하드</Badge>)).getByText('하드'),
        ).props.style,
      )
      expect(난이도.height).toBeUndefined()
    }
  })

})

describe('프롭', () => {
  // 같은 색을 다른 두께로 쓰는 자리가 있다. 보스 스케줄러의 마감 배지가 muted 인데 bold 다.
  // 클래스로는 못 덮는다(NativeWind 가 두께 충돌을 문자열 순서로 안 푼다).
  it('weight 가 variant 의 기본 두께를 덮는다', async () => {
    const 기본 = await renderAtom(<Badge variant="muted">마감</Badge>)
    expect(flattenStyle(기본.getByText('마감').props.style).fontWeight).toBe('600')

    const 굵게 = await renderAtom(<Badge variant="muted" weight="bold">마감</Badge>)
    expect(flattenStyle(굵게.getByText('마감').props.style).fontWeight).toBe('700')
  })

  it('className 은 코어 뒤에 붙는다. 레이아웃은 호출부가 소유한다', async () => {
    const { getByText } = await renderAtom(
      <Badge variant="primary" className="ml-auto">12</Badge>,
    )

    expect(flattenStyle(getByText('12').props.style)).toMatchObject({
      marginLeft: 'auto',
      backgroundColor: 기본테마.primaryTint,
    })
  })
})

describe('아이콘', () => {
  // 평면 배지는 `Text` 하나라 아이콘을 글자 안에 끼우면 기준선을 따라 위아래로 어긋난다. 그래서 아이콘을 주면 상자를
  // 글자 밖으로 꺼내 둘을 한 줄에 세운다. 상자 값(여백 · 배경 · 테두리)이 글자에 남으면 안쪽에 상자가 하나 더 생긴다.
  it('아이콘과 글자가 한 줄에 서고, 상자는 둘을 감싼 쪽만 갖는다', async () => {
    const { getByText, getByTestId } = await renderAtom(
      <Badge variant="error" size="mini" icon={<View testID="badge-icon" />}>
        일부 기능 제한
      </Badge>,
    )
    const label = getByText('일부 기능 제한')
    const box = boxOf(label)

    expect(getByTestId('badge-icon').parent).toBe(box)
    expect(flattenStyle(box.props.style)).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 기본테마.errorTint,
      paddingHorizontal: 6,
      paddingVertical: 2,
    })
    const text = flattenStyle(label.props.style)
    expect(text.color).toBe(기본테마.errorInk)
    expect(text.backgroundColor).toBeUndefined()
    expect(text.paddingHorizontal).toBeUndefined()
  })

  it('테두리 배지도 테두리는 상자에만 있다', async () => {
    const { getByText } = await renderAtom(
      <Badge variant="outline" icon={<View />}>
        라벨
      </Badge>,
    )
    const label = getByText('라벨')

    expect(flattenStyle(boxOf(label).props.style).borderWidth).toBe(1)
    expect(flattenStyle(label.props.style).borderWidth).toBeUndefined()
  })
})
