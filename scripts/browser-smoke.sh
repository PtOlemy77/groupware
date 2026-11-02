#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
harness_tmp=$(mktemp -d "${TMPDIR:-/tmp}/groupware-harness.XXXXXX")
trap 'rm -rf "$harness_tmp"' EXIT HUP INT TERM
export HARNESS_CLASSPATH_FILE="$harness_tmp/classpath"
./backend/mvnw -f backend/pom.xml -q test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile="$HARNESS_CLASSPATH_FILE"
if [ "${HARNESS_BUILD_READY:-0}" != 1 ]; then npm run build; fi
node tests/browser.e2e.cjs
