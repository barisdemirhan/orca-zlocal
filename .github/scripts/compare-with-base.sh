#!/usr/bin/env bash
# Re-runs what failed on the dist commit against the upstream release it sits on, and fails only on
# problems that release does not have. Upstream's own CI runs a curated subset with tags and caches we
# do not mirror, so some checks fail on the bare release too; those are not ours to fix.
#
#   compare-with-base.sh tests <vitest log>
#   compare-with-base.sh lint  <pnpm lint log>
#
# Needs BASE (full SHA of the upstream release) and RUNNER_TEMP; runs from the dist checkout.
set -euo pipefail

mode=$1
log=$2
: "${BASE:?}" "${RUNNER_TEMP:?}"
work="$RUNNER_TEMP/compare"
base_dir="$RUNNER_TEMP/base"
mkdir -p "$work"

strip_ansi() { sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g'; }

prepare_base() {
  git cat-file -e "$BASE^{commit}" 2>/dev/null || git fetch --quiet --no-tags --depth=1 origin "$BASE"
  git worktree add --quiet --detach "$base_dir" "$BASE"
  (cd "$base_dir" && pnpm install --frozen-lockfile --reporter=silent)
}

# Vitest prints one "FAIL <project> <file> > <suite> > <test>" line per failed test; the key drops the project.
# A clean run has no FAIL line; grep's exit 1 must not end the script under pipefail.
failed_tests() { strip_ansi < "$1" | { grep -E '^ FAIL ' || true; } | sed -E 's/^ FAIL +[^ ]+ +//' | sort -u; }
files_of() { sed -E 's/ > .*//; s/ \[.*//' | sort -u; }

run_tests() {
  local dir=$1 files=$2 out=$3
  (
    cd "$dir"
    node config/scripts/electron-installation/platform-layout/install-electron-package-binary.mjs > /dev/null
    node config/scripts/workspace-package-build/build-workspace-packages.mjs > /dev/null
    node config/scripts/native-build/node-addons/ensure-native-runtime.mjs --runtime=node > /dev/null
    # shellcheck disable=SC2046 # one argument per test file
    ORCA_BACKGROUND_LAUNCH=1 node config/scripts/test-runtime/execution-policy/run-vitest.mjs run \
      --config config/vitest.config.ts --maxWorkers=4 $(cat "$files")
  ) > "$out.log" 2>&1 || true
  failed_tests "$out.log" > "$out"
}

compare_tests() {
  failed_tests "$log" > "$work/dist-first"
  if [ ! -s "$work/dist-first" ]; then
    echo "::error::vitest failed but printed no FAIL line; see the log above"
    exit 1
  fi
  files_of < "$work/dist-first" > "$work/dist-files"
  echo "Re-running $(wc -l < "$work/dist-files") failed file(s) on this commit to drop flakes…"
  run_tests . "$work/dist-files" "$work/dist"
  if [ ! -s "$work/dist" ]; then
    echo "::notice::Every failure passed on a re-run (flaky)."
    return 0
  fi
  prepare_base
  : > "$work/base-files"
  while IFS= read -r f; do
    if [ -e "$base_dir/$f" ]; then echo "$f" >> "$work/base-files"; fi
  done < <(files_of < "$work/dist")
  : > "$work/base"
  if [ -s "$work/base-files" ]; then
    echo "Running $(wc -l < "$work/base-files") of those file(s) on the upstream release…"
    run_tests "$base_dir" "$work/base-files" "$work/base"
  fi
  comm -23 "$work/dist" "$work/base" > "$work/new"
  echo "Failures upstream shares (ignored): $(comm -12 "$work/dist" "$work/base" | wc -l)"
  if [ -s "$work/new" ]; then
    echo "::error::$(wc -l < "$work/new") test failure(s) the upstream release does not have:"
    sed 's/^/  /' "$work/new"
    exit 1
  fi
}

# Durations and pnpm's own echo differ between runs; drop them so only findings are compared.
normalize() {
  strip_ansi | sed -E 's/[0-9]+(\.[0-9]+)?m?s\b//g; s/\(verified [^)]*\)//g' | { grep -vE '^(\$|>) |^\s*$|ELIFECYCLE' || true; } | sort -u
}

run_step() {
  local dir=$1 step=$2 out=$3
  if (cd "$dir" && pnpm run "$step") > "$out.raw" 2>&1; then
    return 0
  fi
  normalize < "$out.raw" > "$out"
  return 1
}

compare_lint() {
  local steps
  steps=$(strip_ansi < "$log" | grep -oE 'lint step\(s\) failed in [0-9.]+s: .*' | sed 's/.*: //' | tr ',' '\n' | tr -d ' ')
  if [ -z "$steps" ]; then
    echo "::error::pnpm lint failed but named no failed step; see the log above"
    exit 1
  fi
  prepare_base
  (cd "$base_dir" && pnpm --dir mobile install --frozen-lockfile --reporter=silent)
  local regressions=0
  for step in $steps; do
    if run_step . "$step" "$work/dist-$step"; then
      echo "$step: passed on a re-run (flaky)"
      continue
    fi
    if run_step "$base_dir" "$step" "$work/base-$step"; then
      echo "::error::$step fails here but passes on the upstream release:"
      sed 's/^/  /' "$work/dist-$step" | head -60
      regressions=1
      continue
    fi
    comm -23 "$work/dist-$step" "$work/base-$step" > "$work/new-$step"
    if [ -s "$work/new-$step" ]; then
      echo "::error::$step fails on the upstream release too, but reports more here:"
      sed 's/^/  /' "$work/new-$step" | head -60
      regressions=1
    else
      echo "$step: fails the same way on the upstream release (ignored)"
    fi
  done
  exit "$regressions"
}

case "$mode" in
  tests) compare_tests ;;
  lint) compare_lint ;;
  *) echo "usage: $0 tests|lint <log>" >&2; exit 2 ;;
esac
