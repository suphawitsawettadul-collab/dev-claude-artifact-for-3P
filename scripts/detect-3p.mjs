// Decides whether Claude Code runs in "3P mode" (a third-party provider or gateway).
// Pure function of the environment so it can be tested without Claude Code.

import { pathToFileURL } from 'node:url';

const FIRST_PARTY_HOSTS = new Set(['api.anthropic.com']);
const PROVIDER_FLAGS = [
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_MANTLE',
];

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v ?? '').trim());
const falsy = (v) => /^(0|false|no|off)$/i.test(String(v ?? '').trim());

// Returns { on: boolean, reason: string }. DESIGN_TOOLS_3P=on|off overrides detection.
export function detect(env = process.env) {
  const override = String(env.DESIGN_TOOLS_3P ?? '').trim().toLowerCase();
  if (truthy(override)) return { on: true, reason: 'DESIGN_TOOLS_3P override is on' };
  if (falsy(override)) return { on: false, reason: 'DESIGN_TOOLS_3P override is off' };

  for (const name of PROVIDER_FLAGS) {
    if (truthy(env[name])) return { on: true, reason: `${name} is set` };
  }

  const base = String(env.ANTHROPIC_BASE_URL ?? '').trim();
  if (base) {
    let host = '';
    try { host = new URL(base).hostname.toLowerCase(); } catch { /* unparsable: treat as gateway */ }
    if (!FIRST_PARTY_HOSTS.has(host)) {
      return { on: true, reason: `ANTHROPIC_BASE_URL points to a gateway (${host || 'unparsable URL'})` };
    }
  }

  return { on: false, reason: 'no 3P provider or gateway settings found' };
}

export const ON_CONTEXT =
  '3P mode is active (the Claude Slides and Claude Docs artifact types are not available here). ' +
  'For slides, a deck or a presentation use the skill design-tools-3p:design-slide. ' +
  'For a document the user will keep editing (doc, report, proposal, memo, spec) use the skill design-tools-3p:design-doc. ' +
  'Both open a local editor; do not publish these as artifacts.';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { on, reason } = detect();
  // Used by the skills (shell injection) as a gate line.
  if (process.argv[2] === 'gate') {
    console.log(on
      ? `DESIGN-TOOLS-GATE: ON (${reason}). Continue with this skill.`
      : `DESIGN-TOOLS-GATE: OFF (${reason}). STOP. This skill is only for Claude 3P mode. Do not follow the rest of this skill; use the normal Slides/Docs route (or tell the user these tools are inactive) and ignore everything below.`);
  } else {
    console.log(JSON.stringify({ on, reason }));
  }
}
