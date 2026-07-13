#!/usr/bin/env bash
#
# compat-test.sh — empirically test ngx-mermaid-canvas against multiple Angular majors.
#
# WHAT THIS DOES
#   1. Builds the ngx-mermaid-editor library (ng-packagr) and packs it into a tarball.
#   2. For each requested Angular major version:
#        a. Scaffolds a throwaway standalone Angular app with that major's CLI,
#           in a TEMP directory (never inside the repo, so nothing generated
#           here gets committed).
#        b. Installs the packed library tarball + its runtime peers
#           (@maxgraph/core, mermaid) into that app.
#        c. Wires <ngx-mermaid-canvas> into the root component.
#        d. Runs a production `ng build`.
#   3. Prints a pass/fail results table and removes the temp apps
#      (unless --keep is passed).
#
# WHY TEMP DIRS
#   Angular apps are large (node_modules, build output). Regenerating them on
#   demand keeps the repo clean; only this script needs to be committed.
#
# PORTABILITY NOTE
#   Deliberately avoids bash 4+ features (associative arrays, etc.) because
#   macOS ships bash 3.2 as /bin/bash (and `#!/usr/bin/env bash` resolves to
#   it there). Results are accumulated as delimited strings instead.
#
# USAGE
#   scripts/compat-test.sh                     # tests default versions (17 18 19 20 21 22)
#   scripts/compat-test.sh 18 19 20             # test only these majors
#   COMPAT_VERSIONS="19 20" scripts/compat-test.sh
#   scripts/compat-test.sh --keep 21            # keep the generated app for inspection
#
# REQUIREMENTS
#   - Node/npm on PATH capable of running `npx @angular/cli@<major>`.
#     Different Angular majors have different minimum Node engine requirements
#     (see https://angular.dev/reference/versions). If you have `nvm` installed,
#     this script will try to `nvm exec` a known-good Node version per major
#     (see node_for_major() below); override with COMPAT_NODE_<major>=x.y.z env
#     vars. Without nvm, it just uses whatever node/npx is already on PATH.
#   - Network access (npm installs, `ng new` fetches CLI packages).
#
# EXIT STATUS
#   0 if every tested version installed and built successfully, 1 otherwise.
#   Per-version results are always printed regardless.

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_PROJECT="ngx-mermaid-editor"          # angular.json project name for the library
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/ngx-mermaid-compat.XXXXXX")"
KEEP=0

# Default majors to test. Update this list as new Angular majors ship.
# Check what's current with: npm view @angular/core dist-tags
DEFAULT_VERSIONS="17 18 19 20 21 22"

# Known-good Node version per Angular major (last verified: 2026-07-13).
# Override per-major via COMPAT_NODE_<major>, e.g. COMPAT_NODE_22=22.23.1.
node_for_major() {
  local major="$1"
  local override_var="COMPAT_NODE_$major"
  local override_val
  eval "override_val=\${$override_var:-}"
  if [ -n "$override_val" ]; then
    echo "$override_val"
    return
  fi
  case "$major" in
    17|18|19|20|21) echo "20.19.5" ;;
    22) echo "22.23.1" ;;   # Angular 22 requires Node >=22.22.3 per @angular/core engines
    *) echo "" ;;           # unknown major: use whatever node is already active
  esac
}

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------

ARGS=""
for a in "$@"; do
  case "$a" in
    --keep) KEEP=1 ;;
    --help|-h)
      sed -n '2,48p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) ARGS="$ARGS $a" ;;
  esac
done
ARGS="$(echo "$ARGS" | xargs)"

VERSIONS="${ARGS:-${COMPAT_VERSIONS:-$DEFAULT_VERSIONS}}"

echo "== ngx-mermaid-canvas Angular compat test =="
echo "Versions to test : $VERSIONS"
echo "Scratch workdir  : $WORKDIR"
echo "Keep generated apps after run: $([ "$KEEP" = 1 ] && echo yes || echo no)"
echo

# ---------------------------------------------------------------------------
# Helper: run a command with an optional pinned Node version via nvm
# ---------------------------------------------------------------------------

run_with_node() {
  local node_ver="$1"; shift
  if [ -n "$node_ver" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
    if nvm ls "$node_ver" >/dev/null 2>&1; then
      nvm exec "$node_ver" "$@"
      return $?
    else
      echo "  (nvm does not have Node $node_ver installed; run 'nvm install $node_ver' — falling back to current node)" >&2
    fi
  fi
  "$@"
}

# ---------------------------------------------------------------------------
# Step 1: build + pack the library
# ---------------------------------------------------------------------------

echo "-- Building and packing $LIB_PROJECT --"
(
  cd "$REPO_ROOT"
  npx ng build "$LIB_PROJECT"
)
if [ $? -ne 0 ]; then
  echo "FATAL: library build failed" >&2
  exit 1
fi

DIST_DIR="$REPO_ROOT/dist/$LIB_PROJECT"
PACK_NAME=$(cd "$DIST_DIR" && npm pack --silent)
if [ -z "$PACK_NAME" ]; then
  echo "FATAL: npm pack produced no tarball" >&2
  exit 1
fi
TARBALL="$DIST_DIR/$PACK_NAME"
echo "Packed tarball: $TARBALL"
echo

# ---------------------------------------------------------------------------
# Step 2: per-version scaffold + install + build
# ---------------------------------------------------------------------------

# Results accumulate as lines "major|install|build|notes" in this string.
RESULTS=""

for major in $VERSIONS; do
  echo "== Angular $major =="
  APP_DIR="$WORKDIR/compat-ng$major"
  node_ver="$(node_for_major "$major")"

  install_status="n/a"
  build_status="n/a"
  notes=""

  echo "-- Scaffolding app (Node ${node_ver:-<current>}) --"
  # `ng new` refuses to run when invoked from inside an existing Angular
  # workspace (this repo has its own angular.json at REPO_ROOT), so we must
  # cd into a neutral directory first — WORKDIR is outside the repo for
  # exactly this reason. The positional name creates "compat-ng<major>" as a
  # subdir of cwd, which is exactly APP_DIR (do NOT also pass --directory
  # with an absolute path: some CLI versions re-nest it under cwd instead of
  # treating it as absolute).
  if ! (cd "$WORKDIR" && run_with_node "$node_ver" npx --yes "@angular/cli@$major" new "compat-ng$major" \
        --standalone --routing=false --style=scss --skip-git --skip-tests --defaults) \
        >"$WORKDIR/ng${major}-new.log" 2>&1; then
    echo "  SCAFFOLD FAILED (see $WORKDIR/ng${major}-new.log)"
    notes="ng new failed - see ng${major}-new.log"
    RESULTS="$RESULTS
$major|$install_status|$build_status|$notes"
    echo
    continue
  fi

  echo "-- Installing packed library + peers --"
  if (cd "$APP_DIR" && run_with_node "$node_ver" npm i "$TARBALL" @maxgraph/core mermaid) \
        >"$WORKDIR/ng${major}-install.log" 2>&1; then
    install_status="pass"
  else
    install_status="FAIL"
    notes="npm install failed (peer range?) - see ng${major}-install.log"
    echo "  INSTALL FAILED (see $WORKDIR/ng${major}-install.log)"
    echo "  Retrying with --legacy-peer-deps to distinguish 'peer metadata too strict' from 'actually broken'..."
    if (cd "$APP_DIR" && run_with_node "$node_ver" npm i "$TARBALL" @maxgraph/core mermaid --legacy-peer-deps) \
          >"$WORKDIR/ng${major}-install-legacy.log" 2>&1; then
      notes="$notes; installs OK with --legacy-peer-deps"
    else
      notes="$notes; still fails with --legacy-peer-deps (real incompatibility)"
      RESULTS="$RESULTS
$major|$install_status|$build_status|$notes"
      echo
      continue
    fi
  fi

  # Wire the component into the app root. Angular >=20 scaffolds src/app/app.ts;
  # earlier majors scaffold src/app/app.component.ts.
  if [ -f "$APP_DIR/src/app/app.ts" ]; then
    APP_FILE="$APP_DIR/src/app/app.ts"
    CLASS_NAME="App"
  else
    APP_FILE="$APP_DIR/src/app/app.component.ts"
    CLASS_NAME="AppComponent"
  fi

  cat > "$APP_FILE" <<EOF
import { Component } from '@angular/core';
import { MermaidEditorComponent } from 'ngx-mermaid-canvas';

@Component({
  selector: 'app-root',
  // 'standalone: true' is redundant (but harmless) on Angular 19+, where it's
  // the implied default — kept explicit because it is REQUIRED on 17 and 18.
  standalone: true,
  imports: [MermaidEditorComponent],
  template: \`
    <div style="height: 600px">
      <ngx-mermaid-canvas [mermaidText]="'graph TD\\n A-->B'" />
    </div>
  \`,
})
export class $CLASS_NAME {}
EOF

  echo "-- Building app --"
  if (cd "$APP_DIR" && run_with_node "$node_ver" npx ng build) \
        >"$WORKDIR/ng${major}-build.log" 2>&1; then
    build_status="pass"
    # Sanity check: confirm the component actually made it into the bundle,
    # rather than being silently dropped/erroring out of the template.
    if grep -rq "ngx-mermaid-canvas" "$APP_DIR/dist" 2>/dev/null; then
      notes="${notes:+$notes; }selector confirmed in output bundle"
    else
      notes="${notes:+$notes; }WARNING: selector not found in bundle"
    fi
  else
    build_status="FAIL"
    notes="${notes:+$notes; }ng build failed - see ng${major}-build.log"
    echo "  BUILD FAILED (see $WORKDIR/ng${major}-build.log)"
  fi
  echo

  RESULTS="$RESULTS
$major|$install_status|$build_status|$notes"
done

# ---------------------------------------------------------------------------
# Step 3: report + cleanup
# ---------------------------------------------------------------------------

echo "================ RESULTS ================"
printf "%-8s %-10s %-10s %s\n" "Angular" "Installs" "Builds" "Notes"
overall_ok=0
OLD_IFS="$IFS"
IFS='
'
for line in $RESULTS; do
  [ -z "$line" ] && continue
  major="${line%%|*}"; rest="${line#*|}"
  install_status="${rest%%|*}"; rest="${rest#*|}"
  build_status="${rest%%|*}"; notes="${rest#*|}"
  printf "%-8s %-10s %-10s %s\n" "$major" "$install_status" "$build_status" "$notes"
  if [ "$install_status" = "FAIL" ] || [ "$build_status" = "FAIL" ]; then
    overall_ok=1
  fi
done
IFS="$OLD_IFS"
echo "==========================================="
echo "Logs kept in: $WORKDIR"

if [ "$KEEP" = 1 ]; then
  echo "Generated apps kept at: $WORKDIR (remove manually when done)"
else
  echo "Removing generated apps..."
  rm -rf "$WORKDIR"
fi

exit $overall_ok
