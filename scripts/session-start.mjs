// SessionStart hook: adds context only in 3P mode. Prints nothing otherwise, so the
// plugin leaves no trace in a first-party session. Never fails the session.
import { detect, ON_CONTEXT } from './detect-3p.mjs';

try {
  const { on } = detect();
  if (on) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ON_CONTEXT },
    }));
  }
} catch { /* stay silent */ }
