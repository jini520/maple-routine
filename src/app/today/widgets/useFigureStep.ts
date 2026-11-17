import { Image } from 'expo-image'
import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'

import { lookFrameKey, lookFrameUrl } from '../../../lib/character-look'
import type { FigureMotion, LookAction, LookFrame } from '../../../types/figure-motion'
import { figureFrames, planFigureSteps, type FigureStep } from './figure-motion'

/**
 * 프레임 그림의 캐시. 받은 그림을 기기 디스크에 남긴다.
 *
 * 넥슨 응답에는 `Cache-Control` · `ETag` 가 없어 HTTP 캐시에 맡기면 앱을 켤 때마다 다시 받는다.
 * `expo-image` 의 디스크 캐시는 응답 헤더와 상관없이 주소를 열쇠로 남긴다.
 */
export const FIGURE_CACHE_POLICY = 'memory-disk'

/**
 * 프레임이 전부 디스크에 있게 만드는 함수.
 *
 * `Image.prefetch` 는 iOS 에서 캐시를 안 보고 항상 받는다. 그래서 없는 프레임만 골라 넘긴다.
 *
 * @param urls 프레임 주소들
 * @returns 전부 디스크에 있으면 참
 */
async function cacheFrames(urls: string[]): Promise<boolean> {
  const paths = await Promise.all(urls.map((url) => Image.getCachePathAsync(url)))
  const missing = urls.filter((_, index) => !paths[index])

  return missing.length === 0 || Image.prefetch(missing, FIGURE_CACHE_POLICY)
}

/**
 * 그림을 전부 미리 받았는지 내는 훅. 하나라도 못 받으면 계속 거짓이다.
 *
 * 움직이다가 비는 칸이 생기면 캐릭터가 깜빡이므로, 다 받기 전에는 움직이지 않는다.
 *
 * @param imageUrl 캐릭터 그림 주소. `null` 이면 받지 않는다
 * @param frames 받을 그림. 목록이 같으면 다시 받지 않는다
 * @returns 이 주소의 그림을 다 받았으면 참
 */
export function useLookFramesReady(imageUrl: string | null, frames: readonly LookFrame[]): boolean {
  const key = imageUrl === null ? null : `${imageUrl}#${frames.map(lookFrameKey).join(',')}`
  const urls = useMemo(
    () => (imageUrl === null ? [] : frames.map((frame) => lookFrameUrl(imageUrl, frame))),
    // 열쇠가 같으면 같은 주소들이다. 부르는 쪽이 목록을 새로 만들어도 다시 받지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  const [readyKey, setReadyKey] = useState<string | null>(null)

  useEffect(() => {
    if (key === null) return
    let cancelled = false

    cacheFrames(urls)
      .then((ready) => {
        if (!cancelled && ready) setReadyKey(key)
      })
      .catch(() => {
        // 못 받으면 기본 그림 한 장으로 남는다. 알릴 일이 아니다.
      })

    return () => {
      cancelled = true
    }
  }, [key, urls])

  return key !== null && readyKey === key
}

/** 지금 그림과, 깔아 둘 그림들 */
export interface FigureSteps {
  step: FigureStep | null
  /** 이번 계획과 다음 계획이 쓰는 그림. 다음 것을 미리 깔아야 넘어갈 때 깜빡이지 않는다 */
  layers: LookFrame[]
}

function layersOf(steps: FigureStep[]): LookFrame[] {
  return [...new Map(steps.map((step) => [lookFrameKey(step.frame), step.frame])).values()]
}

const STOPPED: FigureSteps = { step: null, layers: [] }

/**
 * 고른 행동을 이어 가는 훅.
 *
 * @param running 움직여도 되면 참. 거짓이 되면 멈추고, 다시 참이 되면 처음부터 한다
 * @param motion 그 캐릭터가 고른 값
 * @returns 지금 그림. 멈춰 있으면 `step` 이 `null`
 */
export function useFigureSteps(running: boolean, motion: FigureMotion): FigureSteps {
  const motionKey = JSON.stringify(motion)
  const stableMotion = useMemo(() => JSON.parse(motionKey) as FigureMotion, [motionKey])
  const [state, setState] = useState<FigureSteps>(STOPPED)

  useEffect(() => {
    if (!running) return

    let last: LookAction | null = null
    const nextPlan = (): FigureStep[] => {
      const plan = planFigureSteps(stableMotion, last, Math.random)
      last = plan.action
      return plan.steps
    }
    let current = nextPlan()
    let upcoming = nextPlan()
    let layers = layersOf([...current, ...upcoming])
    let index = 0
    let timer: ReturnType<typeof setTimeout>

    const advance = (): void => {
      if (index >= current.length) {
        current = upcoming
        upcoming = nextPlan()
        layers = layersOf([...current, ...upcoming])
        index = 0
      }
      const step = current[index]
      index += 1
      setState({ step, layers })
      timer = setTimeout(advance, step.ms)
    }

    timer = setTimeout(advance, 0)
    return () => clearTimeout(timer)
  }, [running, stableMotion])

  return running ? state : STOPPED
}

/**
 * 고른 값의 그림을 받고 다 받았는지 내는 훅. 조회 불가거나 움직임 줄이기면 받지 않는다.
 *
 * @param imageUrl 캐릭터 그림 주소
 * @param motion 고른 값
 * @param unavailable 조회 불가면 참
 */
export function useFigureReady(imageUrl: string, motion: FigureMotion, unavailable: boolean): boolean {
  const reduceMotion = useReducedMotion()
  const motionKey = JSON.stringify(motion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frames = useMemo(() => figureFrames(motion), [motionKey])
  return useLookFramesReady(unavailable || reduceMotion ? null : imageUrl, frames)
}
