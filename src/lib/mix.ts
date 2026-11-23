import type { WorkMix, WorkType } from '../types.ts'

export const WORK_ORDER: WorkType[] = ['builder', 'drafting', 'research', 'maintenance']

export const DEFAULT_TARGET_HOURS = 20

export function zeroMix(): WorkMix {
  return { builder: 0, drafting: 0, research: 0, maintenance: 0 }
}

export function defaultMix(): WorkMix {
  return { builder: 100, drafting: 0, research: 0, maintenance: 0 }
}

export function activeTypes(mix: WorkMix): WorkType[] {
  return WORK_ORDER.filter((type) => mix[type] > 0)
}

export function mixSum(mix: WorkMix): number {
  return WORK_ORDER.reduce((sum, type) => sum + mix[type], 0)
}

export function shiftMix(mix: WorkMix, from: WorkType, to: WorkType, amount: number): WorkMix {
  if (from === to || amount <= 0) return mix
  const step = Math.floor(Math.min(mix[from], amount) / 5) * 5
  if (step <= 0) return mix
  return { ...mix, [from]: mix[from] - step, [to]: mix[to] + step }
}

export function toggleType(mix: WorkMix, type: WorkType): WorkMix {
  const active = activeTypes(mix)
  if (active.length === 0) return { ...zeroMix(), [type]: 100 }
  if (mix[type] > 0) {
    if (active.length <= 1) return mix
    const recipient = active
      .filter((item) => item !== type)
      .reduce((best, item) => (mix[item] > mix[best] ? item : best))
    return shiftMix(mix, type, recipient, mix[type])
  }
  const donor = active.reduce((best, item) => (mix[item] > mix[best] ? item : best))
  const share = Math.min(20, mix[donor] - (mix[donor] % 5))
  if (share < 5) return mix
  return shiftMix(mix, donor, type, share)
}

function largestOther(mix: WorkMix, type: WorkType): WorkType | null {
  const others = activeTypes(mix).filter((item) => item !== type)
  if (others.length === 0) return null
  return others.reduce((best, item) => (mix[item] > mix[best] ? item : best))
}

export function nudgeMix(mix: WorkMix, type: WorkType, delta: number): WorkMix {
  const partner = largestOther(mix, type)
  if (!partner) {
    if (delta > 0 && mix[type] === 0) return { ...zeroMix(), [type]: 100 }
    return mix
  }
  if (delta > 0) return shiftMix(mix, partner, type, 5)
  if (mix[type] <= 0) return mix
  return shiftMix(mix, type, partner, 5)
}

export function normalizeToHundred(raw: WorkMix): WorkMix {
  const total = WORK_ORDER.reduce((sum, type) => sum + Math.max(0, raw[type]), 0)
  if (total <= 0) return zeroMix()
  const units = WORK_ORDER.map((type) => {
    const exact = Math.max(0, raw[type]) / 5
    const floor = Math.floor(exact + 1e-9)
    return { type, floor, frac: exact - floor }
  })
  let used = units.reduce((sum, item) => sum + item.floor, 0)
  const bonus = new Map<WorkType, number>()
  if (used > 20) {
    const ranked = [...units].sort((a, b) => b.floor - a.floor || WORK_ORDER.indexOf(a.type) - WORK_ORDER.indexOf(b.type))
    for (const item of ranked) {
      if (used <= 20) break
      const removable = item.floor + (bonus.get(item.type) ?? 0)
      const take = Math.min(removable, used - 20)
      bonus.set(item.type, (bonus.get(item.type) ?? 0) - take)
      used -= take
    }
  } else {
    const ranked = [...units].sort(
      (a, b) => b.frac - a.frac || WORK_ORDER.indexOf(a.type) - WORK_ORDER.indexOf(b.type),
    )
    for (const item of ranked) {
      if (used >= 20) break
      bonus.set(item.type, (bonus.get(item.type) ?? 0) + 1)
      used += 1
    }
  }
  const result = zeroMix()
  for (const item of units) result[item.type] = (item.floor + (bonus.get(item.type) ?? 0)) * 5
  return result
}

export function weightedMix(entries: Array<{ mix: WorkMix; weight: number }>): { raw: WorkMix; display: WorkMix } {
  const raw = zeroMix()
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
  if (entries.length === 0) return { raw, display: zeroMix() }
  if (total <= 0) {
    for (const entry of entries) {
      for (const type of WORK_ORDER) raw[type] += entry.mix[type] / entries.length
    }
  } else {
    for (const entry of entries) {
      const share = Math.max(0, entry.weight) / total
      for (const type of WORK_ORDER) raw[type] += entry.mix[type] * share
    }
  }
  return { raw, display: normalizeToHundred(raw) }
}
