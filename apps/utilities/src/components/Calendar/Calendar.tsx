'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type {EventClickArg, EventDropArg} from '@fullcalendar/core';
import type {EventResizeDoneArg} from '@fullcalendar/interaction';

export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO datetime strings — FullCalendar accepts these directly, no Date conversion needed. */
  start: string;
  end: string;
  status: string;
}

export interface CalendarProps {
  events: CalendarEvent[];
  view?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  onEventClick?: (eventId: string) => void;
  /** Called on drag (`eventDrop`) or resize (`eventResize`). Return `false` to revert the
   * change (e.g. the backend rejected it with a 409) — the calendar never commits optimistically. */
  onEventChange?: (eventId: string, start: Date, end: Date) => Promise<boolean>;
  /** Defaults to `defaultEventColor` below; override to recolor by a different status set. */
  eventColor?: (status: string) => string;
}

/** Pure — the session-status → color mapping every call site gets unless it overrides
 * `eventColor`. Kept here (not baked into `toFullCalendarEvent`) so it's independently testable
 * and swappable without touching the mapping function itself. */
export function defaultEventColor(status: string): string {
  switch (status) {
    case 'LIVE':
      return '#16A34A'; // green — happening now
    case 'SCHEDULED':
      return '#0EA5E9'; // blue — upcoming
    case 'ENDED':
      return '#94A3B8'; // gray — done
    case 'CANCELLED':
      return '#EF4444'; // red
    default:
      return '#64748B';
  }
}

/** Pure — maps this project's own event shape to FullCalendar's, so nothing outside this file
 * needs to know FullCalendar's own prop names. Exported and tested directly rather than only
 * through a rendered `<FullCalendar>` tree, per this task's own "no RTL test for FullCalendar's
 * own rendering — test the adapter's prop-mapping function instead" scoping. */
export function toFullCalendarEvent(event: CalendarEvent, colorFn: (status: string) => string = defaultEventColor) {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    color: colorFn(event.status),
  };
}

/**
 * Thin FullCalendar adapter — the first external UI library in this codebase (deliberate
 * exception to the "hand-roll everything visual" convention `BarChart`/`LineChart`/`DonutChart`
 * otherwise follow; decided with the user for Task 43, since a hand-rolled month/week/day grid
 * + drag-and-drop + conflict UI was judged too large/bug-prone versus a well-maintained library
 * that already covers this exact feature set). Every call site imports `Calendar` from here,
 * never `@fullcalendar/react` directly.
 */
export function Calendar({ events, view = 'dayGridMonth', onViewChange, onEventClick, onEventChange, eventColor }: CalendarProps) {
  const fcEvents = events.map((e) => toFullCalendarEvent(e, eventColor));

  async function handleChange(info: EventDropArg | EventResizeDoneArg) {
    if (!onEventChange || !info.event.start || !info.event.end) {
      info.revert();
      return;
    }
    const shouldKeep = await onEventChange(info.event.id, info.event.start, info.event.end);
    if (!shouldKeep) info.revert();
  }

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView={view}
      events={fcEvents}
      editable={!!onEventChange}
      eventClick={(arg: EventClickArg) => onEventClick?.(arg.event.id)}
      eventDrop={handleChange}
      eventResize={handleChange}
      datesSet={(info) => onViewChange?.(info.view.type as CalendarView)}
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
      height="auto"
    />
  );
}
