import events from '@/content/email-events.json'

/** The eight notification events, with their default subject and HTML. Seeded into SQL by migration 0014. */
export const EVENTS = events as Record<string, { subject: string; html: string }>
export const EVENT_KEYS = Object.keys(EVENTS)
