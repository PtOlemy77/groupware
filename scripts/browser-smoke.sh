#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# The Java process is explicitly bound to a new H2 memory database by the runner.
./backend/mvnw -f backend/pom.xml -q test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=/tmp/groupware-smoke-classpath
API_INTERNAL_URL=http://127.0.0.1:18080 npm run build
node tests/browser.e2e.cjs
