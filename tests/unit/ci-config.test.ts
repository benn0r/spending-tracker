import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Android release packaging has enough heap for D8 dex merging', () => {
  const workflow = readFileSync('.gitea/workflows/ci.yml', 'utf8');
  const releaseMemory =
    '-Dorg.gradle.jvmargs="-Xmx1024m -XX:MaxMetaspaceSize=512m -XX:+UseSerialGC"';

  assert.equal(workflow.split(releaseMemory).length - 1, 2);
  assert.doesNotMatch(
    workflow,
    /-Xmx512m -XX:MaxMetaspaceSize=768m/,
    'release packaging must not regress to the heap size that exhausted D8',
  );
});
