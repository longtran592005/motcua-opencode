/** Bộ sinh số giả ngẫu nhiên có hạt giống — dữ liệu mock ổn định giữa các lần tải. */
export interface Rng {
  next: () => number
  float: (min: number, max: number) => number
  int: (min: number, max: number) => number
  pick: <T>(items: readonly T[]) => T
  bool: (probability?: number) => boolean
  sample: <T>(items: readonly T[], count: number) => T[]
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number) =>
    Math.floor(next() * (max - min + 1)) + min

  const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)]

  return {
    next,
    int,
    pick,
    float: (min, max) => min + next() * (max - min),
    bool: (probability = 0.5) => next() < probability,
    sample: <T,>(items: readonly T[], count: number) => {
      const copy = [...items]
      const out: T[] = []
      while (out.length < count && copy.length) {
        out.push(copy.splice(int(0, copy.length - 1), 1)[0])
      }
      return out
    },
  }
}
