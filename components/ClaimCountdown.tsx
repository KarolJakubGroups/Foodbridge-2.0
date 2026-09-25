'use client';

import { fmtDayTime, fmtTimeLeft } from '@/lib/format';
import { TONE, type Tone } from '@/components/ui';
import { ClockIcon } from '@/components/icons';

const HOUR = 3_600_000;

/**
 * How long an offer can still be reserved. Turns orange under a day and red under
 * three hours, and says why the deadline is when it is.
 */
export function ClaimCountdown({ deadline, reason, now }: { deadline: Date | string; reason: 'WINDOW' | 'FRESHNESS'; now: number }) {
  const end = new Date(deadline);
  const left = end.getTime() - now;
  const text = fmtTimeLeft(left);
  const tone: Tone = !text || left < 3 * HOUR ? 'red' : left < 24 * HOUR ? 'orange' : 'green';
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 ${TONE[tone]}`} aria-live="polite">
      <ClockIcon className="size-5 shrink-0 mt-0.5" />
      <div className="min-w-0 leading-snug">
        {text ? <div className="text-[15px]">Noch <b className="tabular-nums">{text}</b> reservierbar</div>
          : <div className="text-[15px] font-bold">Reservierung geschlossen</div>}
        <div className="text-sm opacity-90">
          bis {fmtDayTime(end, new Date(now))} Uhr · {reason === 'WINDOW' ? 'danach endet das Abholfenster' : '4-Tage-Frist'}
        </div>
      </div>
    </div>
  );
}
