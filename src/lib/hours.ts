export interface HourSplit {
  effectiveHours: number
  qualityIdleHours: number
  badIdleHours: number
}

export const HOUR_STEP = 0.5
export const HOUR_BUCKET_MAX = 16
export const SCHEDULED_MAX = HOUR_BUCKET_MAX * 3

const BUCKETS = ['effectiveHours', 'qualityIdleHours', 'badIdleHours'] as const
type Bucket = (typeof BUCKETS)[number]
const TAKE_ORDER: Bucket[] = ['badIdleHours', 'qualityIdleHours', 'effectiveHours']

function snap(value: number): number {
  return Math.round(value * 2) / 2
}

export function hourSum(hours: HourSplit): number {
  return snap(hours.effectiveHours + hours.qualityIdleHours + hours.badIdleHours)
}

export function setScheduledTotal(hours: HourSplit, total: number): HourSplit {
  const next = snap(Math.min(SCHEDULED_MAX, Math.max(0, total)))
  const result: HourSplit = { ...hours }
  const current = hourSum(result)
  if (next === current) return result
  if (next > current) {
    let extra = snap(next - current)
    for (const key of BUCKETS) {
      if (extra <= 0) break
      const room = snap(HOUR_BUCKET_MAX - result[key])
      const add = Math.min(Math.max(0, room), extra)
      result[key] = snap(result[key] + add)
      extra = snap(extra - add)
    }
    return result
  }
  let cut = snap(current - next)
  for (const key of TAKE_ORDER) {
    if (cut <= 0) break
    const take = Math.min(result[key], cut)
    result[key] = snap(result[key] - take)
    cut = snap(cut - take)
  }
  return result
}

function largestDonor(hours: HourSplit, except: Bucket): Bucket | null {
  let best: Bucket | null = null
  for (const key of TAKE_ORDER) {
    if (key === except || hours[key] < HOUR_STEP) continue
    if (!best || hours[key] > hours[best]) best = key
  }
  return best
}

function recipientFor(hours: HourSplit, except: Bucket): Bucket | null {
  const preferred: Bucket[] = except === 'effectiveHours'
    ? ['qualityIdleHours', 'badIdleHours']
    : ['effectiveHours', 'qualityIdleHours', 'badIdleHours']
  for (const key of preferred) {
    if (key === except) continue
    if (hours[key] <= HOUR_BUCKET_MAX - HOUR_STEP) return key
  }
  return null
}

export function nudgeHours(hours: HourSplit, key: Bucket, delta: number): HourSplit {
  if (delta === 0) return hours
  const result: HourSplit = { ...hours }
  if (delta > 0) {
    if (result[key] >= HOUR_BUCKET_MAX) return hours
    const donor = largestDonor(result, key)
    if (!donor) return hours
    result[key] = snap(result[key] + HOUR_STEP)
    result[donor] = snap(result[donor] - HOUR_STEP)
    return result
  }
  if (result[key] < HOUR_STEP) return hours
  const recipient = recipientFor(result, key)
  if (!recipient) return hours
  result[key] = snap(result[key] - HOUR_STEP)
  result[recipient] = snap(result[recipient] + HOUR_STEP)
  return result
}

export function canIncreaseBucket(hours: HourSplit, key: Bucket): boolean {
  return hours[key] < HOUR_BUCKET_MAX && largestDonor(hours, key) !== null
}

export function canDecreaseBucket(hours: HourSplit, key: Bucket): boolean {
  return hours[key] >= HOUR_STEP && recipientFor(hours, key) !== null
}
