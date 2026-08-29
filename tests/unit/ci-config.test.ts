import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Android release packaging stays within the runner memory budget', () => {
  const workflow = readFileSync('.gitea/workflows/ci.yml', 'utf8');
  const releaseMemory =
    '-Dorg.gradle.jvmargs="-Xmx768m -XX:MaxMetaspaceSize=384m -XX:+UseSerialGC"';

  assert.equal(workflow.split(releaseMemory).length - 1, 2);
  assert.match(workflow, /ANDROID_RELEASE_ARCHITECTURES: arm64-v8a/);
  assert.match(workflow, /CMAKE_BUILD_PARALLEL_LEVEL: '1'/);
  assert.equal(
    workflow.split('-PreactNativeArchitectures="$ANDROID_RELEASE_ARCHITECTURES"').length - 1,
    2,
  );
  assert.doesNotMatch(
    workflow,
    /-Xmx512m -XX:MaxMetaspaceSize=768m/,
    'release packaging must not regress to the heap size that exhausted D8',
  );
});
