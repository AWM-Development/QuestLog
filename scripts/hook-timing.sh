#!/bin/bash
# Sourced by each SessionStart hook right after it resolves
# CLAUDE_PROJECT_DIR: prints `<script>: completed in <N>s` as the hook's
# last line on any exit-0 path (including its own early no-op exits), so the
# cold-vs-warm cost of a cloud session is readable straight from the hook
# output. Failures print nothing here — their own diagnostics stay last.
# Why: Docs/IMPLEMENTATION_NOTES.md § T-192.
hook_timing_install() {
	_hook_timing_name="$1"
	trap '_hook_timing_rc=$?; if [ "$_hook_timing_rc" -eq 0 ]; then echo "${_hook_timing_name}: completed in ${SECONDS}s"; fi; exit "$_hook_timing_rc"' EXIT
}
