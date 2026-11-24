import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { FLAG_MESSAGES } from '../lib/scoring.ts'
import { LIGHT_TONE } from './TrafficLight.tsx'

export function ScoringGuide({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 items-center gap-1 rounded-xl px-1 text-sm font-medium text-teal-800"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
        חזרה להגדרות
      </button>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">הציון היומי</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          תוצר + איכות זמן + איזון. הטווח הוא <bdi dir="ltr">0–10</bdi>. יום בלי תוצר או בלי איזון נשמר, ועדיין בלי ציון.
        </p>
        <ul className="mt-3 space-y-3 text-sm leading-6 text-stone-700">
          <li>
            <span className="font-medium text-ink">תוצר, </span>
            <bdi dir="ltr">0–4</bdi>
            <span>. 0 נתקעתי או לא יצא כלום, 2 התקדמות חלקית, 4 היעד הושלם. 1 ו־3 הם שלבי ביניים.</span>
          </li>
          <li>
            <span className="font-medium text-ink">איכות זמן, </span>
            <bdi dir="ltr">0–4</bdi>
            <span>. נגזרת מהזמן האפקטיבי ומנבז לא טוב. נבז איכותי לא מוריד נקודות.</span>
          </li>
          <li>
            <span className="font-medium text-ink">איזון, </span>
            <bdi dir="ltr">0–2</bdi>
            <span>. 0 מרוח מול מסך, 1 הפסקה או התרעננות, 2 אימון או פעילות גופנית.</span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">איכות הזמן</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
          <ScoreRow points="0">אין שעות אפקטיביות.</ScoreRow>
          <ScoreRow points="1">
            יש קצת זמן אפקטיבי, ופחות מ־<bdi dir="ltr">1.5</bdi> שעות.
          </ScoreRow>
          <ScoreRow points="2">
            לפחות <bdi dir="ltr">1.5</bdi> שעות אפקטיביות.
          </ScoreRow>
          <ScoreRow points="3">
            לפחות <bdi dir="ltr">2.5</bdi> שעות אפקטיביות, והן לפחות <bdi dir="ltr">70%</bdi> מהאפקטיבי ועוד הנבז הלא
            טוב.
          </ScoreRow>
          <ScoreRow points="4">
            לפחות <bdi dir="ltr">3.5</bdi> שעות אפקטיביות, והן לפחות <bdi dir="ltr">85%</bdi> מהאפקטיבי ועוד הנבז הלא
            טוב.
          </ScoreRow>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">צבע היום</h3>
        <ul className="mt-3 space-y-2">
          <LightRow tone="green" range="8–10" text="יום חזק." />
          <LightRow tone="yellow" range="5–7" text="יום בינוני." />
          <LightRow tone="red" range="0–4" text="יום חלש." />
        </ul>
        <p className="mt-3 text-sm leading-6 text-stone-600">יום ללא תזה, ויום שעוד ממתין לסיכום, נשארים בלי צבע.</p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">מה לא נכנס לציון</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          יעד, מיקום וחברה לא מוסיפים ולא מורידים נקודות. גם שעות השינה לא משנות את הציון היומי. שינה קצרה יכולה להדליק דגל שבועי.
          התמהיל לא משנה את הציון היומי, אבל תמהיל בלי יצירה וכתיבה יכול להדליק דגל.
        </p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">צבע השבוע</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          הממוצע מחושב רק מימי תזה עם תוצר ואיזון. אם יש לפחות שני ימים כאלה, ושובצו פחות מ־<bdi dir="ltr">75%</bdi>{' '}
          מיעד השעות, יורדות <bdi dir="ltr">0.5</bdi> נקודות. מעבר ל־<bdi dir="ltr">100%</bdi> לא מוסיף נקודות.
        </p>
        <ul className="mt-3 space-y-2">
          <LightRow tone="green" range="ירוק" text="ממוצע 7.5 ומעלה, לפחות 80% מיעד השעות, ובלי אף דגל." />
          <LightRow tone="yellow" range="צהוב" text="ממוצע 5 ומעלה, בלי דגל, ועדיין בלי שני התנאים של הירוק." />
          <LightRow tone="red" range="אדום" text="ממוצע מתחת ל־5, או דגל אחד לפחות." />
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">דגלים שמאדימים את השבוע</h3>
        <ul className="mt-3 space-y-3 text-sm leading-6 text-stone-700">
          <li>
            <p className="font-medium text-ink">{FLAG_MESSAGES.padding}</p>
            <p>הלו״ז מלא לפחות כמו היעד, והתפוקה הממוצעת מתחת ל־2.</p>
          </li>
          <li>
            <p className="font-medium text-ink">{FLAG_MESSAGES.passive}</p>
            <p>לפחות שלושה ימי תזה, ופחות מ־30% מהזמן האפקטיבי הוא פיתוח או כתיבה.</p>
          </li>
          <li>
            <p className="font-medium text-ink">{FLAG_MESSAGES.burnout}</p>
            <p>לפחות שני ימי תזה, ובכולם האיזון הוא 0.</p>
          </li>
          <li>
            <p className="font-medium text-ink">{FLAG_MESSAGES.bottleneck}</p>
            <p>לפחות שני ימים עם תוצר 0.</p>
          </li>
          <li>
            <p className="font-medium text-ink">{FLAG_MESSAGES.writing}</p>
            <p>שלושה שבועות עם ימי תזה, ובכולם אין כתיבה חדשה.</p>
          </li>
          <li>
            <p className="font-medium text-ink">{FLAG_MESSAGES.sleep}</p>
            <p>שלושה ימי תזה מלאים עם פחות מ־6 שעות שינה.</p>
          </li>
        </ul>
      </section>
    </div>
  )
}

function ScoreRow({ points, children }: { points: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <bdi dir="ltr" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-sm font-semibold text-ink">
        {points}
      </bdi>
      <span>{children}</span>
    </li>
  )
}

function LightRow({ tone, range, text }: { tone: 'green' | 'yellow' | 'red'; range: string; text: string }) {
  return (
    <li className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${LIGHT_TONE[tone].soft}`}>
      <bdi dir="ltr" className="shrink-0 text-sm font-semibold">
        {range}
      </bdi>
      <span className="text-sm leading-6">{text}</span>
    </li>
  )
}
