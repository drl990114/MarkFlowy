import type { ErrorEvent, StackFrame } from '@sentry/react'

const ERROR_TYPES = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'URIError', 'EvalError', 'AggregateError', 'DOMException',
])

function applicationFrame(frame: StackFrame): StackFrame[] {
  const match = /^(?:tauri:\/\/localhost|https?:\/\/(?:tauri\.localhost|localhost(?::\d+)?)|app:\/\/)?\/assets\/([A-Za-z0-9._-]+\.js)(?:[?#].*)?$/
    .exec(frame.filename ?? '')
  if (!match) return []
  return [{
    filename: `app:///assets/${match[1]}`,
    ...(Number.isSafeInteger(frame.lineno) && (frame.lineno ?? 0) > 0 ? { lineno: frame.lineno } : {}),
    ...(Number.isSafeInteger(frame.colno) && (frame.colno ?? 0) >= 0 ? { colno: frame.colno } : {}),
    in_app: true,
  }]
}

/** Build an allowlisted event: messages, content, URLs and local paths are never copied. */
export function privateErrorEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: 'javascript',
    level: 'error',
    exception: {
      values: (event.exception?.values ?? [{}]).slice(0, 5).map((exception) => ({
        type: ERROR_TYPES.has(exception.type ?? '') ? exception.type : 'Error',
        value: 'Error details omitted for privacy',
        stacktrace: {
          frames: (exception.stacktrace?.frames ?? []).flatMap(applicationFrame).slice(-20),
        },
      })),
    },
  }
}
