#!/bin/bash
# Installs the "Impeccable" design skill (https://github.com/pbakaus/impeccable,
# npm package `impeccable` by Paul Bakaus) — 23 commands (/impeccable polish,
# critique, audit, live, etc.) plus anti-pattern detection. Runs at every
# session start, since the ephemeral container's $HOME (and its
# ~/.claude/skills) doesn't survive between containers. Only runs in Claude
# Code on the web; degrades gracefully (warns, never blocks session startup)
# if install fails.
#
# Deliberate choice: git-clone the repo and copy .claude/skills/impeccable/
# verbatim, instead of running the documented `npx impeccable install`.
# That installer's own bundle download hits a custom API host
# (https://impeccable.style/api/download/bundle/universal) that this
# session's egress policy does not allow (403) — confirmed not a transient
# error, so not retried per the proxy's own guidance. The skill's scripts
# have no bare npm imports (only Node builtins + relative paths), so a plain
# clone is fully self-contained and functionally identical to the official
# install: all 23 commands and the "live" browser-automation mode work the
# same way, since SKILL.md invokes them via `node .claude/skills/impeccable/
# scripts/*.mjs` directly, not through the blocked API.
#
# Global scope only (like the ux-ui-agent-skills kit): lands in
# $HOME/.claude/skills, not this repo's .claude/. Keeps ~30k lines of
# vendored third-party JS (including a 500KB+ browser-automation bundle) out
# of git history — refetched from GitHub each session instead of committed.
# No PreToolUse edit-hook is installed into this project's settings.json —
# out of scope for "install the skill commands"; can be revisited explicitly.

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

SKILLS_DIR="$HOME/.claude/skills"
MARKER="$HOME/.impeccable-installed"

if [ -f "$MARKER" ]; then
  echo "[session-start] impeccable already installed — skipping."
  exit 0
fi

TMP_CLONE="$(mktemp -d)"
if ! git clone --depth 1 https://github.com/pbakaus/impeccable.git "$TMP_CLONE" >/tmp/impeccable-clone.log 2>&1; then
  echo "[session-start] WARNING: clone of impeccable failed — skill will be unavailable this session. See /tmp/impeccable-clone.log" >&2
  rm -rf "$TMP_CLONE"
  exit 0
fi

if [ ! -d "$TMP_CLONE/.claude/skills/impeccable" ]; then
  echo "[session-start] WARNING: impeccable repo layout changed (.claude/skills/impeccable not found) — skipping install." >&2
  rm -rf "$TMP_CLONE"
  exit 0
fi

mkdir -p "$SKILLS_DIR"
rm -rf "$SKILLS_DIR/impeccable"
cp -r "$TMP_CLONE/.claude/skills/impeccable" "$SKILLS_DIR/impeccable"
rm -rf "$TMP_CLONE"

touch "$MARKER"
echo "[session-start] impeccable installed (global scope)."
