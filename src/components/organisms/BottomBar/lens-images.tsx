/**
 * 하단바 렌즈가 휘는 그림(항목 줄 · 뒤 화면)을 뜨는 훅과 색 변환. 언제 뜨고 언제 쓰는지의 판정은 `lens-snapshot.ts` 에 있다.
 *
 * 렌즈 캔버스(`BarLens.tsx`)와 파일을 나눈 것은 컴포넌트 파일이 훅을 함께 내보내면 fast refresh 가 깨지기 때문이다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { AlphaType, ColorType, Skia, TileMode, makeImageFromView, type SkImage } from '@shopify/react-native-skia'

import { BarGlyph } from './BarGlyph'
import { canCapturePage, hasInk, rowRetryDelay, usableSnapshot, type Snapshot } from './lens-snapshot'
import type { GroupId } from '../../../navigation/bar-groups'
import type { TabRouteName } from '../../../navigation/routes'

export interface LensRowItem {
  key: GroupId | TabRouteName
  label: string
  center: number
}

export interface LensRowSpec {
  key: string
  width: number
  items: LensRowItem[]
}

export interface LensRowImages {
  base: SkImage
  accent: SkImage
  edge: SkImage
}

/**
 * 렌즈가 휠 항목 줄 그림을 뜨는 훅. 화면 밖에 원본 뷰(`sources`)를 그려 두고, `signature` 나 `refresh` 가 바뀔 때 뜬다.
 * 아이콘이 찍히지 않은 그림은 쓰지 않고 다시 뜬다. 쓸 그림이 없는 줄은 `images` 에 없고, 바는 그 줄을 앱 뷰로 둔다.
 */
export function useLensRowImages(
  rows: LensRowSpec[],
  height: number,
  pillW: number,
  pillH: number,
  accent: string,
  muted: string,
  edgeColor: string,
  signature: string,
  ext: number,
  plateColor: string,
  pageColor: string,
  vertical = false,
  refresh = 0,
): { images: Record<string, LensRowImages>; sources: React.JSX.Element } {
  // 뜬 그림은 뜰 때의 signature 와 함께 둔다. 테마가 바뀌면 새로 뜨는 동안 옛 색 그림을 내지 않는다.
  const [shot, setShot] = useState<Snapshot<Record<string, LensRowImages>> | null>(null)
  const images = usableSnapshot(shot, signature) ?? {}
  const refs = useRef<Record<string, View | null>>({})

  useEffect(() => {
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | null = null
    const capture = async (attempt: number) => {
      // 원본 뷰가 그려진 뒤에 뜬다(두 프레임). 길게 기다리면 테마를 바꾼 뒤 그만큼 렌즈 없이 지낸다.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const next: Record<string, LensRowImages> = {}
      for (const row of rows) {
        const take = (kind: string) => {
          const view = refs.current[`${row.key}:${kind}`]
          return view ? makeImageFromView({ current: view }) : Promise.resolve(null)
        }
        const [base, accentImage, edge] = await Promise.all([take('base'), take('accent'), take('edge')])
        if (base && accentImage && edge && rowHasInk(base, row, height, vertical)) next[row.key] = { base, accent: accentImage, edge }
      }
      if (cancelled) return
      // 위 화면에 가려진 동안 뜨면 실기기에서 빈 그림이 나왔다. 빈 그림을 쓰면 누를 때 아이콘이 다 사라진다.
      const delay = rowRetryDelay(attempt, Object.keys(next).length === rows.length)
      if (delay !== null) {
        retry = setTimeout(() => void capture(attempt + 1), delay)
        return
      }
      setShot({ key: signature, value: next })
    }
    void capture(0)
    return () => {
      cancelled = true
      if (retry !== null) clearTimeout(retry)
    }
    // signature · 다시 뜨기 요청(refresh)이 바뀔 때만 다시 뜬다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, refresh])

  const sources = (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: -2000 }}>
      {rows.map((row) =>
        (['base', 'accent', 'edge'] as const).map((kind) => (
          <View
            key={`${row.key}:${kind}`}
            ref={(view) => {
              refs.current[`${row.key}:${kind}`] = view
            }}
            collapsable={false}
            style={vertical ? { width: height, height: row.width, backgroundColor: 'transparent' } : { width: row.width, height, backgroundColor: 'transparent' }}
          >
            {kind === 'edge' ? (
              <View
                style={
                  vertical
                    ? { position: 'absolute', left: 0, top: 0, width: height, height: row.width, backgroundColor: pageColor }
                    : { position: 'absolute', left: 0, top: 0, width: row.width, height, backgroundColor: pageColor }
                }
              >
              <View
                style={{
                  position: 'absolute',
                  ...(vertical
                    ? { top: 0, left: ext, height: row.width, width: height - ext * 2 }
                    : { left: 0, top: ext, width: row.width, height: height - ext * 2 }),
                  borderRadius: 999,
                  backgroundColor: plateColor,
                }}
              />
              </View>
            ) : (
              row.items.map((item) => (
                <View
                  key={item.key}
                  style={{
                    position: 'absolute',
                    ...(vertical
                      ? { top: item.center - pillW / 2, left: (height - pillH) / 2, height: pillW, width: pillH }
                      : { left: item.center - pillW / 2, top: (height - pillH) / 2, width: pillW, height: pillH }),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BarGlyph id={item.key} label={item.label} active={kind === 'accent'} accent={accent} muted={muted} />
                </View>
              ))
            )}
          </View>
        )),
      )}
    </View>
  )

  return { images, sources }
}

/** 뜬 줄 그림의 첫 칸 가운데 둘레에 아이콘이 찍혔는가. */
function rowHasInk(image: SkImage, row: LensRowSpec, height: number, vertical: boolean): boolean {
  const item = row.items[0]
  if (item === undefined) return true
  const scale = image.width() / (vertical ? height : row.width)
  const cx = Math.round((vertical ? height / 2 : item.center) * scale)
  const cy = Math.round((vertical ? item.center : height / 2) * scale)
  const size = Math.round(24 * scale)
  const pixels = image.readPixels(Math.max(0, cx - size / 2), Math.max(0, cy - size / 2), {
    width: size,
    height: size,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Premul,
  })
  return pixels === null || hasInk(pixels)
}

export interface PageImages {
  sharp: SkImage
  blurred: SkImage
}

/**
 * 렌즈 뒤에 비칠 화면을 뜨는 훅. 바를 뺀 화면 상자(`ref`)를 뜨고 흐린 사본을 함께 만든다.
 *
 * @param themeKey 지금 테마를 이은 글자. 뜬 순간의 값과 다르면 그림을 쓰지 않는다
 * @param isCovered 위 화면에 가려졌는가. 가려진 뷰를 뜨면 앱이 죽는다
 */
export function usePageSnapshot(
  ref: React.RefObject<View | null> | null,
  themeKey: string,
  isCovered: () => boolean,
): {
  images: PageImages | null
  capture: () => Promise<void>
} {
  const [shot, setShot] = useState<Snapshot<PageImages> | null>(null)
  const images = usableSnapshot(shot, themeKey)
  const keyRef = useRef(themeKey)
  useEffect(() => {
    keyRef.current = themeKey
  })
  const busy = useRef(false)
  const capture = useCallback((): Promise<void> => {
    if (ref === null || ref.current === null) return Promise.resolve()
    if (!canCapturePage({ covered: isCovered(), busy: busy.current })) return Promise.resolve()
    busy.current = true
    const capturedKey = keyRef.current
    return makeImageFromView(ref as React.RefObject<View>)
      .then((sharp) => {
        if (sharp === null) return
        const w = sharp.width()
        const h = sharp.height()
        const surface = Skia.Surface.MakeOffscreen(w, h) ?? Skia.Surface.Make(w, h)
        if (surface === null) return
        const paint = Skia.Paint()
        // 흐린 사본. 렌즈 안 바 판에 쓴다. 화면 배율 3 기준 약 10pt.
        paint.setImageFilter(Skia.ImageFilter.MakeBlur(30, 30, TileMode.Clamp, null))
        surface.getCanvas().drawImage(sharp, 0, 0, paint)
        surface.flush()
        const snap = surface.makeImageSnapshot()
        setShot({ key: capturedKey, value: { sharp, blurred: snap.makeNonTextureImage() ?? snap } })
      })
      .catch(() => {
        // 못 뜨면 렌즈 안을 그림 없이 바 판 색으로 그린다.
      })
      .finally(() => {
        busy.current = false
      })
  }, [ref, isCovered])
  return { images, capture }
}

/** `rgba(r, g, b, a)` 나 `#rrggbb` 를 셰이더 uniform 값(0~1 네 개)으로. */
export function colorToUniform(color: string): number[] {
  const rgba = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\)/.exec(color)
  if (rgba) return [Number(rgba[1]) / 255, Number(rgba[2]) / 255, Number(rgba[3]) / 255, rgba[4] === undefined ? 1 : Number(rgba[4])]
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]
  }
  return [0, 0, 0, 0]
}

