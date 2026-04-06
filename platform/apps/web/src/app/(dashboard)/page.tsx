'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  provider: string;
  allDay: boolean;
};

const PROVIDER_COLORS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  google: { bg: 'bg-blue-50', border: 'border-l-blue-500', dot: 'bg-blue-500', label: 'Google' },
  microsoft: { bg: 'bg-sky-50', border: 'border-l-sky-500', dot: 'bg-sky-500', label: 'Microsoft' },
  slack: { bg: 'bg-purple-50', border: 'border-l-purple-500', dot: 'bg-purple-500', label: 'Slack' },
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am to 10pm

export default function CalendarPage() {
  const { data: session } = useSession();
  const [view, setView] = useState<'week' | 'day' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set(['google', 'microsoft', 'slack']));

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const token = (session as any)?.apiToken;
    if (!token) { setLoading(false); return; }

    const start = view === 'month' ? startOfMonth(currentDate) : weekStart;
    const end = view === 'month' ? endOfMonth(currentDate) : addDays(weekStart, 6);

    setLoading(true);
    api.get<CalendarEvent[]>(`/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`, token)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [session, currentDate, view]);

  const filteredEvents = events.filter((e) => activeProviders.has(e.provider));

  const getEventsForDay = (day: Date) =>
    filteredEvents.filter((e) => isSameDay(new Date(e.startAt), day));

  const getEventTopPercent = (startAt: string) => {
    const d = new Date(startAt);
    const minutesSince7am = (d.getHours() - 7) * 60 + d.getMinutes();
    return Math.max(0, (minutesSince7am / (16 * 60)) * 100);
  };

  const getEventHeightPercent = (startAt: string, endAt: string) => {
    const duration = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000;
    return Math.max(2, (duration / (16 * 60)) * 100);
  };

  const navigate = (dir: 1 | -1) => {
    if (view === 'week') setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else if (view === 'day') setCurrentDate(addDays(currentDate, dir));
    else setCurrentDate(addDays(currentDate, dir * 30));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
            <div className="flex items-center gap-1">
              <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-36 text-center">
                {view === 'week' ? `${format(weekStart, 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`
                  : view === 'day' ? format(currentDate, 'MMMM d, yyyy')
                  : format(currentDate, 'MMMM yyyy')}
              </span>
              <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight size={16} className="text-gray-600" />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="ml-2 px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Today
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Provider filters */}
            <div className="flex gap-1.5">
              {Object.entries(PROVIDER_COLORS).map(([provider, style]) => (
                <button
                  key={provider}
                  onClick={() => setActiveProviders((prev) => {
                    const next = new Set(prev);
                    next.has(provider) ? next.delete(provider) : next.add(provider);
                    return next;
                  })}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    activeProviders.has(provider)
                      ? 'border-transparent bg-gray-100 text-gray-700'
                      : 'border-gray-200 text-gray-400 bg-white'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', style.dot)} />
                  {style.label}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['week', 'day', 'month'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                    view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'week' ? (
        <WeekView weekDays={weekDays} hours={HOURS} getEventsForDay={getEventsForDay} getEventTopPercent={getEventTopPercent} getEventHeightPercent={getEventHeightPercent} />
      ) : view === 'day' ? (
        <DayView day={currentDate} hours={HOURS} events={getEventsForDay(currentDate)} getEventTopPercent={getEventTopPercent} getEventHeightPercent={getEventHeightPercent} />
      ) : (
        <MonthView currentDate={currentDate} getEventsForDay={getEventsForDay} />
      )}
    </div>
  );
}

function EventChip({ event, style }: { event: CalendarEvent; style?: React.CSSProperties }) {
  const colors = PROVIDER_COLORS[event.provider] || PROVIDER_COLORS.google;
  return (
    <div
      style={style}
      className={cn('absolute left-1 right-1 rounded px-1.5 py-0.5 border-l-2 overflow-hidden cursor-pointer hover:brightness-95 transition-all', colors.bg, colors.border)}
    >
      <p className="text-xs font-medium text-gray-800 truncate">{event.title}</p>
      <p className="text-xs text-gray-500">{format(new Date(event.startAt), 'h:mm a')}</p>
    </div>
  );
}

function WeekView({ weekDays, hours, getEventsForDay, getEventTopPercent, getEventHeightPercent }: any) {
  const totalHeight = 900;
  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 bg-white sticky top-0 z-10">
        <div />
        {weekDays.map((day: Date) => (
          <div key={day.toISOString()} className={cn('p-3 text-center border-l border-gray-100', isToday(day) && 'bg-brand-50')}>
            <p className="text-xs text-gray-500 uppercase">{format(day, 'EEE')}</p>
            <p className={cn('text-lg font-semibold mt-0.5', isToday(day) ? 'text-brand-600' : 'text-gray-900')}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ minHeight: totalHeight }}>
        {/* Hour labels */}
        <div>
          {hours.map((h: number) => (
            <div key={h} style={{ height: totalHeight / hours.length }} className="flex items-start justify-end pr-2 pt-1">
              <span className="text-xs text-gray-400">{h <= 12 ? `${h}am` : `${h - 12}pm`}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day: Date) => (
          <div key={day.toISOString()} className={cn('border-l border-gray-100 relative', isToday(day) && 'bg-brand-50/20')}>
            {hours.map((h: number) => (
              <div key={h} style={{ height: totalHeight / hours.length }} className="border-b border-gray-100" />
            ))}
            {getEventsForDay(day).map((event: CalendarEvent) => (
              <EventChip
                key={event.id}
                event={event}
                style={{
                  top: `${getEventTopPercent(event.startAt)}%`,
                  height: `${getEventHeightPercent(event.startAt, event.endAt)}%`,
                  minHeight: 28,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ day, hours, events, getEventTopPercent, getEventHeightPercent }: any) {
  const totalHeight = 900;
  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-[60px_1fr]" style={{ minHeight: totalHeight }}>
        <div>
          {hours.map((h: number) => (
            <div key={h} style={{ height: totalHeight / hours.length }} className="flex items-start justify-end pr-2 pt-1">
              <span className="text-xs text-gray-400">{h <= 12 ? `${h}am` : `${h - 12}pm`}</span>
            </div>
          ))}
        </div>
        <div className="relative border-l border-gray-100">
          {hours.map((h: number) => (
            <div key={h} style={{ height: totalHeight / hours.length }} className="border-b border-gray-100" />
          ))}
          {events.map((event: CalendarEvent) => (
            <EventChip
              key={event.id}
              event={event}
              style={{
                top: `${getEventTopPercent(event.startAt)}%`,
                height: `${getEventHeightPercent(event.startAt, event.endAt)}%`,
                minHeight: 28,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthView({ currentDate, getEventsForDay }: any) {
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start, end });
  const startPad = (start.getDay() + 6) % 7;
  const padded = [...Array(startPad).fill(null), ...days];

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {padded.map((day, i) => {
          if (!day) return <div key={i} />;
          const dayEvents = getEventsForDay(day);
          return (
            <div key={day.toISOString()} className={cn('min-h-24 p-1.5 rounded-lg border', isToday(day) ? 'border-brand-500 bg-brand-50' : 'border-gray-100 bg-white')}>
              <p className={cn('text-xs font-medium mb-1', isToday(day) ? 'text-brand-600' : 'text-gray-700')}>{format(day, 'd')}</p>
              {dayEvents.slice(0, 3).map((e: CalendarEvent) => {
                const colors = PROVIDER_COLORS[e.provider] || PROVIDER_COLORS.google;
                return (
                  <div key={e.id} className={cn('text-xs px-1 py-0.5 rounded mb-0.5 truncate', colors.bg, 'text-gray-700')}>{e.title}</div>
                );
              })}
              {dayEvents.length > 3 && <p className="text-xs text-gray-400">+{dayEvents.length - 3} more</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
