# Installing Design Slide and Design Doc for Claude 3P mode

The repository is a Claude Code plugin marketplace named `design-tools`. It lists one plugin, `design-tools-3p`, which contains the
skills `design-slide` and `design-doc` (see `skills/`). Goal: in **3P mode** (Bedrock, Vertex, Foundry or an LLM gateway) "create slides"
and "write a doc" go to these local editors; in a normal first-party session the plugin does nothing and never competes with Claude
Slides or Claude Docs.

## How 3P mode is detected

`scripts/detect-3p.mjs` is the single source of truth. A session counts as 3P when any of these is true:

| Signal | Meaning |
|---|---|
| `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY` or `CLAUDE_CODE_USE_MANTLE` is `1`, `true`, `yes` or `on` | Provider selected |
| `ANTHROPIC_BASE_URL` is set to a host other than `api.anthropic.com` | LLM gateway |
| `DESIGN_TOOLS_3P=on` | Manual override (also lets you cover a provider not listed above) |

`DESIGN_TOOLS_3P=off` forces it off. The variables can come from the shell or from the `env` block of any settings file; both were
checked against a real Claude Code 2.1.312 session (see Verification).

## How the gating works (four layers)

1. **Delivery (hard).** Ship the plugin in the *same* managed settings profile that switches the user to 3P. Removing the 3P profile
   removes the marketplace and the plugin, so a first-party user never has it. This is the only layer that removes the skills from the
   model's view completely.
2. **SessionStart hook** (`hooks/hooks.json`, `scripts/session-start.mjs`). In 3P mode it adds one short context message that names the
   two skills. Outside 3P mode it prints nothing.
3. **Skill gate.** Each `SKILL.md` starts with a shell-injected line from `detect-3p.mjs gate`. When 3P mode is off it reads
   `DESIGN-TOOLS-GATE: OFF ... STOP`, and the skill tells Claude to ignore the rest of the file.
4. **Skill descriptions** say "ONLY when Claude runs in 3P mode ... Never use it when Claude Slides / Claude Docs ... are available", so
   routing also prefers the built-in tools.

## Default install through managed settings

Pick the example that matches your provider and deploy it as managed settings. Both set the provider **and** install the plugin:

- [`managed-settings.3p-bedrock.json`](managed-settings.3p-bedrock.json)
- [`managed-settings.3p-gateway.json`](managed-settings.3p-gateway.json)

```json
{
  "env": { "CLAUDE_CODE_USE_BEDROCK": "1", "AWS_REGION": "us-east-1" },
  "extraKnownMarketplaces": {
    "design-tools": {
      "source": { "source": "github", "repo": "suphawitsawettadul-collab/dev-claude-artifact-for-3P" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": { "design-tools-3p@design-tools": true }
}
```

Where to put it (per the Claude Code managed settings docs; confirm the path for your version): `managed-settings.json` in the system
directory (`/Library/Application Support/ClaudeCode/` on macOS, `/etc/claude-code/` on Linux, `C:\Program Files\ClaudeCode\` on
Windows), an MDM policy, or server-managed settings from the admin console. Notes:

- `enabledPlugins: true` in managed settings cannot be turned off by the user. That is intended: the gate makes the plugin inert when 3P
  is off. If you would rather let users opt out, put `enabledPlugins` in user settings instead.
- Only one managed source applies by default. If server-managed settings already deliver any key, the file is ignored unless
  `managedSourcesBehavior` is `"merge"`.
- A private repository needs git credentials on each machine (the clone runs with the user's git). Otherwise use a seed directory
  (`CLAUDE_CODE_PLUGIN_SEED_DIR`) or an internal `git`/`url` marketplace source.
- Optionally lock marketplaces with `strictKnownMarketplaces` as described in the Claude Code plugin admin docs.
- Manual install without managed settings: `claude plugin marketplace add suphawitsawettadul-collab/dev-claude-artifact-for-3P`, then
  `claude plugin install design-tools-3p@design-tools`.

Copying `skills/` into `~/.claude/skills/` by hand no longer works: the gate script is found through `${CLAUDE_PLUGIN_ROOT}`, so
the skills fail closed outside the plugin. Use the plugin.

## Verification

Run `node --test tests/gating.test.mjs` (no dependencies). It covers detection, the hook output, the gate line, manifest consistency, the skill
descriptions, and that the example managed settings are detected as 3P. In addition, these were run by hand against Claude Code 2.1.312
(`CLAUDE_CONFIG_DIR` pointed at an empty directory):

- `claude plugin validate .` passes; `claude plugin marketplace add`, `install` and `details` list 2 skills and 1 hook.
- Real session start with no 3P settings: the SessionStart hook ran and produced empty output.
- Same with `CLAUDE_CODE_USE_BEDROCK=1` in the shell, and with it in a settings `env` block: the hook produced the 3P context.
- Invoking `/design-tools-3p:design-slide` runs the gate command without a permission prompt (`allowed-tools` is scoped to that one command).

## What cannot be guaranteed

- **The skills stay listed.** Claude Code has no way to hide a plugin skill by runtime state. With the plugin enabled, both skill names
  and descriptions (about 300 tokens, per `claude plugin details`) are in every session. Layers 3 and 4 make a wrong trigger unlikely and
  harmless, but they rely on the model following text. Only layer 1 (not installing the plugin) is a hard guarantee.
- **I could not run the model end to end** (no real API access in the test environment), so "the model declines to use the skill when the
  gate says OFF" is untested; the gate output itself is tested.
- **Gateway detection is a heuristic.** A first-party user who routes through a corporate proxy via `ANTHROPIC_BASE_URL` is treated as
  3P. Set `DESIGN_TOOLS_3P=off` for them.
- **Claude Platform on AWS** is not detected automatically (its selector variable was not confirmed); use `DESIGN_TOOLS_3P=on`.
- Providers configured only through a mechanism other than environment variables (for example a gateway reached with `apiKeyHelper` and
  no base URL change) look like first-party. Set `DESIGN_TOOLS_3P=on` in managed `env` for those.
- If a host app sets `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`, Claude Code ignores provider variables in settings files, so the
  `env`-block route does not work there; export the variables in the process environment or use `DESIGN_TOOLS_3P=on`.
