// Run: node --test tests/gating.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { detect } from '../scripts/detect-3p.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
// A clean env: only PATH, so nothing from the machine running the tests leaks in.
const run = (script, args, env) =>
  spawnSync(process.execPath, [path.join(root, script), ...args], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('first-party sessions are never detected as 3P', () => {
  assert.equal(detect({}).on, false);
  assert.equal(detect({ ANTHROPIC_API_KEY: 'x' }).on, false);
  assert.equal(detect({ ANTHROPIC_BASE_URL: 'https://api.anthropic.com' }).on, false);
  assert.equal(detect({ CLAUDE_CODE_USE_BEDROCK: '0' }).on, false);
  assert.equal(detect({ CLAUDE_CODE_USE_VERTEX: 'false' }).on, false);
  assert.equal(detect({ CLAUDE_CODE_USE_BEDROCK: '' }).on, false);
});

test('provider flags turn 3P on', () => {
  for (const k of ['BEDROCK', 'VERTEX', 'FOUNDRY', 'MANTLE']) {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
      assert.equal(detect({ [`CLAUDE_CODE_USE_${k}`]: v }).on, true, `${k}=${v}`);
    }
  }
});

test('a non-Anthropic ANTHROPIC_BASE_URL (gateway) turns 3P on', () => {
  assert.equal(detect({ ANTHROPIC_BASE_URL: 'https://llm-gw.corp.example/anthropic' }).on, true);
  assert.equal(detect({ ANTHROPIC_BASE_URL: 'not a url' }).on, true);
});

test('DESIGN_TOOLS_3P overrides detection both ways', () => {
  assert.equal(detect({ DESIGN_TOOLS_3P: 'on' }).on, true);
  assert.equal(detect({ DESIGN_TOOLS_3P: 'off', CLAUDE_CODE_USE_BEDROCK: '1' }).on, false);
});

test('session-start hook is silent outside 3P mode', () => {
  const r = run('scripts/session-start.mjs', [], {});
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('session-start hook emits additionalContext in 3P mode', () => {
  const r = run('scripts/session-start.mjs', [], { CLAUDE_CODE_USE_BEDROCK: '1' });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /design-tools-3p:design-slide/);
  assert.match(out.hookSpecificOutput.additionalContext, /design-tools-3p:design-doc/);
});

test('gate line says ON / OFF', () => {
  assert.match(run('scripts/detect-3p.mjs', ['gate'], { CLAUDE_CODE_USE_VERTEX: '1' }).stdout, /GATE: ON/);
  const off = run('scripts/detect-3p.mjs', ['gate'], {}).stdout;
  assert.match(off, /GATE: OFF/);
  assert.match(off, /STOP/);
});

test('manifests are consistent', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  const mp = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(mp.plugins.length, 1);
  assert.equal(mp.plugins[0].name, plugin.name, 'entry name must equal manifest name');
  assert.equal(mp.plugins[0].source, './');
  const hooks = JSON.parse(read('hooks/hooks.json'));
  assert.deepEqual(Object.keys(hooks.hooks), ['SessionStart']);
});

test('every skill is 3P-only in its description and carries the gate', () => {
  for (const s of ['design-slide', 'design-doc']) {
    const md = read(`skills/${s}/SKILL.md`);
    const desc = md.match(/^description: (.*)$/m)[1];
    assert.match(desc, /ONLY when Claude runs in 3P mode/);
    assert.match(desc, /Never use it when Claude (Slides|Docs)/);
    assert.match(md, /detect-3p\.mjs" gate`/);
    assert.ok(md.indexOf('DESIGN-TOOLS-GATE') < md.indexOf('## Creating'), 'gate comes before any instructions');
  }
});

test('example managed settings are valid and reference the real names', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  const mp = JSON.parse(read('.claude-plugin/marketplace.json'));
  for (const f of ['managed-settings.3p-bedrock.json', 'managed-settings.3p-gateway.json']) {
    const s = JSON.parse(read(`docs/3p-install/${f}`));
    assert.ok(s.extraKnownMarketplaces[mp.name], f);
    assert.equal(s.enabledPlugins[`${plugin.name}@${mp.name}`], true, f);
    // The same file that turns the provider on must be the one that installs the plugin.
    const e = s.env || {};
    assert.ok(e.CLAUDE_CODE_USE_BEDROCK === '1' || e.ANTHROPIC_BASE_URL, `${f} sets a 3P provider`);
    assert.equal(detect(e).on, true, `${f} is detected as 3P`);
  }
});
