import { parseBackup, toCsv, toJson } from '../src/lib/backup.ts'
import { hourSum, nudgeHours, setScheduledTotal } from '../src/lib/hours.ts'
import { mixSum, nudgeMix, toggleType } from '../src/lib/mix.ts'
import { buildSampleEntries } from '../src/lib/sample.ts'
import {
  FLAG_MESSAGES,
  dailyTotal,
  environmentInsights,
  hasWritingAvoidance,
  sleepInsights,
  summarizeStoredWeek,
  summarizeWeek,
  timeQualityScore,
  workoutHypothesis,
} from '../src/lib/scoring.ts'
import { sanitizeEntry, sanitizeSleep, sanitizeState } from '../src/lib/storage.ts'
import type { DailyEntry, WorkMix } from '../src/types.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function mix(partial: Partial<WorkMix> = {}): WorkMix {
  return { builder: 0, drafting: 0, research: 0, maintenance: 0, ...partial }
}

function day(partial: Partial<DailyEntry> & Pick<DailyEntry, 'date'>): DailyEntry {
  return {
    isThesisDay: true,
    workMix: mix({ builder: 100 }),
    dailyGoal: 'יעד',
    outputScore: 4,
    effectiveHours: 4,
    qualityIdleHours: 0.5,
    badIdleHours: 0,
    balanceScore: 2,
    balanceTags: [],
    notes: '',
    nextStepBreadcrumb: '',
    workLocation: 'home_other',
    socialContext: 'alone',
    sleepHours: 7,
    ...partial,
  }
}

assert(timeQualityScore(0, 0) === 0, 'zero effective is 0')
assert(timeQualityScore(1, 0) === 1, 'one effective hour is 1')
assert(timeQualityScore(1.5, 5) === 2, '1.5 effective stays 2 even with bad idle')
assert(timeQualityScore(2.5, 0.5) === 3, '2.5 clean hours are 3')
assert(timeQualityScore(3.5, 1) === 3, '3.5 with ratio under 0.85 is 3')
assert(timeQualityScore(4, 0) === 4, 'four clean hours are 4')
assert(timeQualityScore(4, 1) === 3, 'four hours with ratio 0.8 are 3')

const today = new Date(2026, 10, 24)
assert(today.getDay() === 2, '24 Nov 2026 is a Tuesday')
const samples = buildSampleEntries(today)
const sampleList = Object.values(samples)
const sampleKeys = Object.keys(samples).sort()
assert(sampleKeys.join() === '2026-11-22,2026-11-23,2026-11-24', `sample dates ${sampleKeys.join()}`)
assert(sampleList.every((entry) => entry.isSample && entry.nextStepBreadcrumb.length > 0), 'samples carry breadcrumbs')
assert(dailyTotal(samples['2026-11-22']!) === 3, 'sunday total')
assert(dailyTotal(samples['2026-11-23']!) === 6, 'monday total')
assert(dailyTotal(samples['2026-11-24']!) === 10, 'tuesday total')

const sampleSummary = summarizeWeek(sampleList)
assert(sampleSummary.rawAverage === 6.3, `sample raw ${sampleSummary.rawAverage}`)
assert(sampleSummary.average === 5.8, `sample average ${sampleSummary.average}`)
assert(sampleSummary.penalized, 'sample week is under the hour target')
assert(sampleSummary.light === 'yellow', `sample light ${sampleSummary.light}`)
assert(sampleSummary.flags.length === 0, 'sample week has no flags')
assert(sampleSummary.scheduledHours === 12.5, `scheduled ${sampleSummary.scheduledHours}`)
assert(sampleSummary.effectiveHours === 8, `effective ${sampleSummary.effectiveHours}`)
assert(sampleSummary.schedulingCompletionPct === 62.5, `completion ${sampleSummary.schedulingCompletionPct}`)
assert(sampleSummary.workMix.builder === 35 && sampleSummary.workMix.drafting === 10, 'weighted mix')
assert(mixSum(sampleSummary.workMix) === 100, 'display mix sums to 100')

const neutral = summarizeWeek([day({ date: '2026-11-22', isThesisDay: false, outputScore: 0, balanceScore: 0 })])
assert(neutral.light === 'neutral' && neutral.average === null && neutral.schedulingCompletionPct === null, 'non-thesis week is neutral')

const green = summarizeWeek(
  [
    day({ date: '2026-11-22' }),
    day({ date: '2026-11-23', outputScore: 3, effectiveHours: 3, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 2 }),
  ],
  { targetWeeklyHours: 10 },
)
assert(green.average === 9 && green.light === 'green' && green.flags.length === 0, `clean green week ${green.average} ${green.light}`)

const needsHours = summarizeWeek([day({ date: '2026-11-22' }), day({ date: '2026-11-23' })], { targetWeeklyHours: 20 })
assert(needsHours.average === 9.5 && needsHours.penalized && needsHours.light === 'yellow', 'high score without the hour target stays yellow')

const exactGreen = summarizeWeek(
  [
    day({ date: '2026-11-22', outputScore: 4, balanceScore: 0 }),
    day({ date: '2026-11-23', outputScore: 3, balanceScore: 0 }),
  ],
  { targetWeeklyHours: 10 },
)
assert(exactGreen.average === 7.5, `7.5 average got ${exactGreen.average}`)
assert(exactGreen.light === 'red', 'balance 0 on two days is burnout, so red')
assert(exactGreen.flags.some((flag) => flag.message === FLAG_MESSAGES.burnout), 'burnout flag text')

const yellowFloor = summarizeWeek([
  day({ date: '2026-11-22', outputScore: 2, effectiveHours: 2, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
])
assert(yellowFloor.average === 5 && yellowFloor.light === 'yellow' && !yellowFloor.penalized, 'one day at 5.0 stays yellow')

const low = summarizeWeek(
  [
    day({ date: '2026-11-22', outputScore: 2, effectiveHours: 2, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
    day({ date: '2026-11-23', outputScore: 2, effectiveHours: 2, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
    day({ date: '2026-11-24', outputScore: 1, effectiveHours: 2, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
  ],
  { targetWeeklyHours: 10 },
)
assert(low.average === 4.7 && low.light === 'red' && low.flags.length === 0, `low week ${low.average} ${low.light}`)

const pushedRed = summarizeWeek([
  day({ date: '2026-11-22', outputScore: 2, effectiveHours: 2, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
  day({ date: '2026-11-23', outputScore: 2, effectiveHours: 2, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
])
assert(pushedRed.average === 4.5 && pushedRed.penalized && pushedRed.light === 'red', 'penalty can move a 5.0 week under 5')

const fullTarget = summarizeWeek(
  [
    day({ date: '2026-11-22', effectiveHours: 4, qualityIdleHours: 1, badIdleHours: 0 }),
    day({ date: '2026-11-23', effectiveHours: 4, qualityIdleHours: 1, badIdleHours: 0 }),
    day({ date: '2026-11-24', effectiveHours: 4, qualityIdleHours: 1, badIdleHours: 0 }),
  ],
  { targetWeeklyHours: 20 },
)
assert(fullTarget.schedulingCompletionPct === 75 && !fullTarget.penalized && fullTarget.light === 'yellow', '75% avoids the penalty and still misses green')

const passive = summarizeWeek(
  [
    day({ date: '2026-11-22', workMix: mix({ research: 100 }) }),
    day({ date: '2026-11-23', workMix: mix({ maintenance: 100 }) }),
    day({ date: '2026-11-24', workMix: mix({ research: 70, maintenance: 30 }) }),
  ],
  { targetWeeklyHours: 10 },
)
assert(passive.average === 10 && passive.light === 'red', 'high average still red with a flag')
assert(passive.flags[0]?.message === FLAG_MESSAGES.passive, 'passive flag text')

const justEnoughMaking = summarizeWeek(
  [
    day({ date: '2026-11-22', workMix: mix({ builder: 30, research: 70 }) }),
    day({ date: '2026-11-23', workMix: mix({ builder: 30, research: 70 }) }),
    day({ date: '2026-11-24', workMix: mix({ builder: 30, research: 70 }) }),
  ],
  { targetWeeklyHours: 10 },
)
assert(!justEnoughMaking.flags.some((flag) => flag.id === 'passive'), '30% making is not a passive loop')

const padding = summarizeWeek(
  [
    day({
      date: '2026-11-22',
      outputScore: 1,
      effectiveHours: 3,
      qualityIdleHours: 0.5,
      badIdleHours: 0.5,
      balanceScore: 1,
    }),
    day({
      date: '2026-11-23',
      outputScore: 1,
      effectiveHours: 3,
      qualityIdleHours: 0.5,
      badIdleHours: 0.5,
      balanceScore: 1,
    }),
  ],
  { targetWeeklyHours: 8 },
)
assert(padding.schedulingCompletionPct === 100, `padding completion ${padding.schedulingCompletionPct}`)
assert(padding.flags.some((flag) => flag.message === FLAG_MESSAGES.padding), 'padding flag text')
assert(padding.light === 'red', 'padding forces red')

const enoughOutput = summarizeWeek(
  [
    day({ date: '2026-11-22', outputScore: 2, effectiveHours: 3, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
    day({ date: '2026-11-23', outputScore: 2, effectiveHours: 3, qualityIdleHours: 0.5, badIdleHours: 0.5, balanceScore: 1 }),
  ],
  { targetWeeklyHours: 8 },
)
assert(!enoughOutput.flags.some((flag) => flag.id === 'padding'), 'output average of 2 is not padding')

const bottleneck = summarizeWeek(
  [
    day({ date: '2026-11-22', outputScore: 0 }),
    day({ date: '2026-11-23', outputScore: 0 }),
    day({ date: '2026-11-24', isThesisDay: false, outputScore: 0, workMix: mix({ maintenance: 100 }) }),
  ],
  { targetWeeklyHours: 10 },
)
assert(bottleneck.stuckOutputCount === 2, 'non-thesis zero does not count')
assert(bottleneck.flags.some((flag) => flag.message === FLAG_MESSAGES.bottleneck), 'bottleneck flag text')
assert(bottleneck.light === 'red', 'bottleneck forces red')

const quiet = day({ date: '2026-11-01', workMix: mix({ research: 100 }), effectiveHours: 2 })
const skipped = day({ date: '2026-11-15', workMix: mix({ maintenance: 100 }), effectiveHours: 2 })
const current = day({ date: '2026-11-22', workMix: mix({ research: 100 }), effectiveHours: 2 })
const history = [quiet, skipped, current]
assert(hasWritingAvoidance(history, new Date(2026, 10, 22)), 'three active weeks without drafting, with a gap')
assert(!hasWritingAvoidance([quiet, skipped], new Date(2026, 10, 22)), 'an empty current week does not extend the streak')
assert(
  !hasWritingAvoidance(
    [quiet, skipped, day({ date: '2026-11-22', workMix: mix({ drafting: 10, research: 90 }), effectiveHours: 2 })],
    new Date(2026, 10, 22),
  ),
  'drafting breaks the streak',
)
const writing = summarizeStoredWeek(history, new Date(2026, 10, 22), 10)
assert(writing.flags.some((flag) => flag.message === FLAG_MESSAGES.writing), 'writing flag text')

const hypothesis = workoutHypothesis(sampleList)
assert(hypothesis.workoutOutput === 4 && hypothesis.workoutQuality === 4 && hypothesis.workoutCount === 1, 'workout side')
assert(hypothesis.restOutput === 1.5 && hypothesis.restQuality === 2.5 && hypothesis.restCount === 2, 'rest side')

let stepped = mix({ builder: 100 })
stepped = toggleType(stepped, 'drafting')
assert(stepped.builder === 80 && stepped.drafting === 20 && mixSum(stepped) === 100, 'toggle takes 20')
stepped = nudgeMix(stepped, 'research', 5)
assert(stepped.builder === 75 && stepped.research === 5 && mixSum(stepped) === 100, 'nudge moves 5')
assert(toggleType(mix({ builder: 100 }), 'builder').builder === 100, 'the last active type stays on')

const creative = sanitizeEntry({
  date: '2026-11-22',
  isThesisDay: true,
  workType: 'creative',
  dailyGoal: 'יעד ישן',
  outputScore: 4,
  focusScore: 4,
  balanceScore: 2,
  balanceTags: ['ריצה', 'לא-קיים'],
  notes: 'ישן',
})
assert(creative?.workMix.builder === 50 && creative.workMix.drafting === 50, 'creative splits into making and writing')
assert(creative?.effectiveHours === 4 && creative.qualityIdleHours === 0.5 && creative.badIdleHours === 0, 'focus 4 maps to hours')
assert(creative?.balanceTags.join() === 'ריצה', 'unknown tags drop')
assert(timeQualityScore(creative!.effectiveHours, creative!.badIdleHours) === 4, 'mapped focus 4 still scores 4')

const hoursWin = sanitizeEntry({
  date: '2026-11-22',
  isThesisDay: true,
  workType: 'creative',
  focusScore: 4,
  effectiveHours: 1,
  outputScore: 2,
  balanceScore: 1,
})
assert(hoursWin?.effectiveHours === 1 && hoursWin.qualityIdleHours === 0 && hoursWin.badIdleHours === 0, 'explicit hours replace focus')
assert(hoursWin?.workMix.builder === 50, 'legacy type still applies when no mix is stored')

const kept = sanitizeEntry({
  date: '2026-11-23',
  isThesisDay: true,
  workType: 'creative',
  focusScore: 1,
  workMix: { builder: 70, drafting: 0, research: 20, maintenance: 10 },
  effectiveHours: 2.2,
  qualityIdleHours: 0,
  badIdleHours: 0,
  outputScore: 3,
  balanceScore: 1,
  nextStepBreadcrumb: 'א'.repeat(200),
})
assert(kept?.workMix.builder === 70 && kept.workMix.research === 20, 'a valid mix is kept')
assert(kept?.effectiveHours === 2, 'hours snap to half hours')
assert(kept?.nextStepBreadcrumb.length === 180, 'breadcrumb is capped')

const migrated = sanitizeState({
  version: 1,
  entries: {
    '2026-11-22': {
      date: '2026-11-22',
      isThesisDay: true,
      workType: 'research',
      outputScore: 2,
      focusScore: 2,
      balanceScore: 1,
    },
  },
  reflections: {
    '2026-11-22': { weekId: '2026-11-22', topAchievement: 'פסקה', bottleneck: '', nextFirstStep: '' },
    '2026-11-15': { weekId: '2026-11-15', topAchievement: '', bottleneck: '', nextFirstStep: '' },
  },
  weeks: {
    '2026-11-22': { weekId: '2026-11-22', targetWeeklyHours: 30, topAchievement: 'מהשבוע', bottleneck: '', nextFirstStep: '' },
  },
})
assert(migrated?.version === 2, 'saved state becomes version 2')
assert(migrated?.entries['2026-11-22']?.workMix.research === 100, 'research stays research')
assert(migrated?.weeks['2026-11-22']?.targetWeeklyHours === 30, 'week record wins over the old reflection')
assert(migrated?.weeks['2026-11-22']?.topAchievement === 'מהשבוע', 'week text wins')
assert(migrated?.weeks['2026-11-15'] === undefined, 'an empty default week is not stored')

const state = {
  version: 2 as const,
  entries: {
    '2026-11-22': day({
      date: '2026-11-22',
      dailyGoal: 'יעד, עם פסיק',
      notes: 'שורה אחת, עם "ציטוט"\nושורה שנייה',
      balanceTags: ['ריצה', 'שינה טובה'],
      nextStepBreadcrumb: 'לפתוח את הקובץ',
      workLocation: 'lab',
      socialContext: 'collaborative',
      sleepHours: 5.5,
      isSample: true,
      workMix: mix({ research: 80, maintenance: 20 }),
    }),
  },
  weeks: {
    '2026-11-22': {
      weekId: '2026-11-22',
      targetWeeklyHours: 22,
      topAchievement: 'פסקה',
      bottleneck: 'נתקעתי, כי חסר נתון',
      nextFirstStep: 'לכתוב פתיחה',
    },
  },
}

const csv = parseBackup(toCsv(state))
assert(csv.ok, csv.ok ? '' : csv.error)
if (csv.ok) {
  const restored = csv.state.entries['2026-11-22']
  assert(restored?.notes.includes('\n'), 'csv keeps newlines')
  assert(restored?.notes.includes('"ציטוט"'), 'csv keeps quotes')
  assert(restored?.dailyGoal === 'יעד, עם פסיק', 'csv keeps commas')
  assert(restored?.balanceTags.join('|') === 'ריצה|שינה טובה', 'csv keeps tags')
  assert(restored?.workMix.research === 80 && restored.workMix.maintenance === 20, 'csv keeps the mix')
  assert(restored?.nextStepBreadcrumb === 'לפתוח את הקובץ', 'csv keeps the breadcrumb')
  assert(restored?.workLocation === 'lab' && restored.socialContext === 'collaborative', 'csv keeps the environment')
  assert(restored?.sleepHours === 5.5, 'csv keeps sleep')
  assert(restored?.effectiveHours === 4, 'csv keeps hours')
  assert(csv.state.weeks['2026-11-22']?.targetWeeklyHours === 22, 'csv keeps the weekly target')
  assert(csv.state.weeks['2026-11-22']?.bottleneck === 'נתקעתי, כי חסר נתון', 'csv keeps the weekly note')
}

const legacyCsv = [
  'type,date,weekId,isThesisDay,workType,dailyGoal,outputScore,focusScore,balanceScore,balanceTags,notes,topAchievement,bottleneck,nextFirstStep,isSample',
  'entry,2026-11-22,,true,creative,"יעד, עם פסיק",4,4,2,ריצה,הערה,,,,false',
  'reflection,,2026-11-22,,,,,,,,,פסקה,"נתקעתי, כי חסר נתון",לכתוב פתיחה,',
].join('\n')
const legacy = parseBackup(legacyCsv)
assert(legacy.ok, legacy.ok ? '' : legacy.error)
if (legacy.ok) {
  const restored = legacy.state.entries['2026-11-22']
  assert(restored?.workMix.builder === 50 && restored.workMix.drafting === 50, 'old csv creative migrates')
  assert(restored?.effectiveHours === 4 && restored.badIdleHours === 0, 'old csv focus migrates')
  assert(restored?.dailyGoal === 'יעד, עם פסיק', 'old csv keeps commas')
  assert(legacy.state.weeks['2026-11-22']?.bottleneck === 'נתקעתי, כי חסר נתון', 'old reflection imports')
  assert(legacy.state.weeks['2026-11-22']?.targetWeeklyHours === 20, 'old reflection defaults the target')
}

const json = parseBackup(toJson(state))
assert(json.ok && json.state.entries['2026-11-22']?.workMix.research === 80, 'json roundtrip')
assert(json.ok && json.state.weeks['2026-11-22']?.targetWeeklyHours === 22, 'json keeps the target')

const oldJson = parseBackup(
  JSON.stringify({
    version: 1,
    entries: [
      {
        date: '2026-11-22',
        isThesisDay: true,
        workType: 'maintenance',
        outputScore: 1,
        focusScore: 1,
        balanceScore: 0,
      },
    ],
    reflections: {},
  }),
)
assert(oldJson.ok && oldJson.state.entries['2026-11-22']?.workMix.maintenance === 100, 'old json maintenance migrates')
assert(oldJson.ok && oldJson.state.entries['2026-11-22']?.effectiveHours === 1, 'old json focus 1 migrates')

assert(samples['2026-11-22']?.workLocation === 'home_other' && samples['2026-11-22']?.socialContext === 'alone', 'sunday context')
assert(samples['2026-11-23']?.workLocation === 'matlam_my_room' && samples['2026-11-23']?.socialContext === 'body_doubling', 'monday context')
assert(samples['2026-11-24']?.workLocation === 'lab' && samples['2026-11-24']?.socialContext === 'collaborative', 'tuesday context')

const moved = day({ date: '2026-11-22', workLocation: 'batza', socialContext: 'alone' })
const stayed = day({ date: '2026-11-22', workLocation: 'lab', socialContext: 'collaborative' })
assert(dailyTotal(moved) === dailyTotal(stayed), 'location does not change the daily total')
assert(summarizeWeek([moved]).average === summarizeWeek([stayed]).average, 'location does not change the weekly score')

const places = environmentInsights(sampleList)
assert(places.locations[0]?.location === 'lab' && places.locations[0].averageScore === 10, 'lab ranks first')
assert(places.locations.find((item) => item.location === 'matlam_my_room')?.averageScore === 6, 'matlam score')
assert(places.locations.find((item) => item.location === 'home_other')?.averageScore === 3, 'home score')
assert(places.locations.find((item) => item.location === 'batza')?.count === 0, 'unused locations stay empty')
const homeRatio = places.locations.find((item) => item.location === 'home_other')?.cleanRatio ?? 0
assert(Math.round(homeRatio * 1000) / 10 === 42.9, `home clean ratio ${homeRatio}`)
assert(places.calmest.join() === 'collaborative', 'collaborative has the least bad idle')
assert(places.social.find((item) => item.context === 'alone')?.averageBadIdle === 2, 'alone bad idle')
assert(places.social.find((item) => item.context === 'body_doubling')?.averageQuality === 3, 'body doubling quality')

const ignoredPlace = environmentInsights([
  day({ date: '2026-11-22', isThesisDay: false, workLocation: 'lab', socialContext: 'collaborative', outputScore: 4, balanceScore: 2 }),
])
assert(ignoredPlace.locations.every((item) => item.count === 0) && ignoredPlace.calmest.length === 0, 'non-thesis days stay out of environment stats')

const bare = sanitizeEntry({ date: '2026-11-22', isThesisDay: true, outputScore: 2, balanceScore: 1, workType: 'research' })
assert(bare?.workLocation === 'home_other' && bare.socialContext === 'alone', 'missing environment falls back')
const keptPlace = sanitizeEntry({
  date: '2026-11-23',
  isThesisDay: true,
  workLocation: 'other_room',
  socialContext: 'body_doubling',
  outputScore: 3,
  balanceScore: 1,
})
assert(keptPlace?.workLocation === 'other_room' && keptPlace.socialContext === 'body_doubling', 'known environment is kept')
const junkPlace = sanitizeEntry({ date: '2026-11-24', isThesisDay: true, workLocation: 'office', socialContext: 'crowd' })
assert(junkPlace?.workLocation === 'home_other' && junkPlace.socialContext === 'alone', 'unknown environment falls back')

assert(samples['2026-11-22']?.sleepHours === 5.5, 'sunday sleep')
assert(samples['2026-11-23']?.sleepHours === 6.5, 'monday sleep')
assert(samples['2026-11-24']?.sleepHours === 8, 'tuesday sleep')

const rested = day({ date: '2026-11-22', sleepHours: 8 })
const shortNight = day({ date: '2026-11-22', sleepHours: 5.5 })
assert(dailyTotal(rested) === dailyTotal(shortNight), 'sleep does not change the daily total')

const shortWeek = ['2026-11-22', '2026-11-23', '2026-11-24'].map((date) =>
  day({ date, sleepHours: 5.5, effectiveHours: 8, qualityIdleHours: 0, badIdleHours: 0 }),
)
const debt = summarizeWeek(shortWeek)
assert(debt.flags.some((flag) => flag.message === FLAG_MESSAGES.sleep), 'three short nights raise sleep debt')
assert(debt.light === 'red', 'sleep debt turns the week red')
assert(debt.average === 10, 'sleep debt leaves the average intact')
const twoShort = summarizeWeek(shortWeek.slice(0, 2))
assert(!twoShort.flags.some((flag) => flag.id === 'sleep') && twoShort.light === 'green', 'two short nights stay under the flag')
const withRestDay = summarizeWeek([
  ...shortWeek.slice(0, 2),
  day({ date: '2026-11-24', isThesisDay: false, sleepHours: 4, outputScore: 4, balanceScore: 2 }),
])
assert(!withRestDay.flags.some((flag) => flag.id === 'sleep'), 'a non-thesis night stays out of the flag')

const slept = sleepInsights(sampleList)
const under = slept.find((item) => item.bracket === 'under6')
const mid = slept.find((item) => item.bracket === 'mid')
const high = slept.find((item) => item.bracket === 'rested')
assert(under?.averageScore === 3 && under.averageEffective === 1.5 && under.averageBadIdle === 2, 'short sleep stats')
assert(mid?.averageScore === 6 && mid.averageEffective === 2.5 && mid.averageBadIdle === 0.5, 'mid sleep stats')
assert(high?.averageScore === 10 && high.averageEffective === 4 && high.averageBadIdle === 0, 'rested sleep stats')
const ignoredSleep = sleepInsights([
  day({ date: '2026-11-22', isThesisDay: false, sleepHours: 4, outputScore: 4, balanceScore: 2 }),
])
assert(ignoredSleep.every((item) => item.count === 0), 'non-thesis days stay out of sleep stats')

const morning = day({ date: '2026-11-25', outputScore: null, balanceScore: null, sleepHours: 4, effectiveHours: 8, dailyGoal: 'לטיוט' })
const withMorning = summarizeWeek([day({ date: '2026-11-22' }), morning])
assert(dailyTotal(morning) === null, 'a morning plan has no score')
assert(withMorning.thesisDaysCount === 1 && withMorning.average === 10, 'a morning plan stays out of the average')
assert(withMorning.scheduledHours === 4.5, 'a morning plan does not add scheduled hours')
assert(!withMorning.flags.some((flag) => flag.id === 'sleep'), 'a morning plan does not count as a short night')

const split = { effectiveHours: 1.5, qualityIdleHours: 0.5, badIdleHours: 2 }
const raised = setScheduledTotal(split, 4.5)
assert(hourSum(raised) === 4.5 && raised.effectiveHours === 2 && raised.badIdleHours === 2, 'extra scheduled time lands on effective hours')
const lowered = setScheduledTotal(split, 3)
assert(hourSum(lowered) === 3 && lowered.badIdleHours === 1 && lowered.effectiveHours === 1.5, 'a smaller total is taken from bad idle first')
const shifted = nudgeHours(split, 'effectiveHours', 0.5)
assert(hourSum(shifted) === 4 && shifted.effectiveHours === 2 && shifted.badIdleHours === 1.5, 'raising one row takes from the largest other row')
const returned = nudgeHours(shifted, 'badIdleHours', -0.5)
assert(hourSum(returned) === 4 && returned.effectiveHours === 2.5 && returned.badIdleHours === 1, 'lowering a row gives the time back to effective hours')
assert(hourSum(nudgeHours({ effectiveHours: 0, qualityIdleHours: 0, badIdleHours: 0 }, 'effectiveHours', 0.5)) === 0, 'a row cannot grow before the total does')

assert(sanitizeSleep(undefined) === 7, 'missing sleep defaults to 7')
assert(sanitizeSleep('5.5') === 5.5, 'sleep text is kept')
assert(sanitizeSleep(0) === 0 && sanitizeSleep(3) === 3 && sanitizeSleep(10) === 10, 'sleep keeps values inside 0 to 10')
assert(sanitizeSleep(-1) === 0 && sanitizeSleep(12) === 10 && sanitizeSleep(7.2) === 7, 'sleep snaps into range')
const bareSleep = sanitizeEntry({ date: '2026-11-22', isThesisDay: true, outputScore: 2, balanceScore: 1 })
assert(bareSleep?.sleepHours === 7, 'legacy entry defaults sleep')

const oldSleepCsv = parseBackup(['type,date,isThesisDay,outputScore,balanceScore', 'entry,2026-11-22,true,2,1'].join('\n'))
assert(oldSleepCsv.ok && oldSleepCsv.state.entries['2026-11-22']?.sleepHours === 7, 'old csv defaults sleep')

console.log('scoring and backup checks passed')
