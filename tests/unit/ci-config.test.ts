import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Android release packaging stays within the runner memory budget', () => {
  const workflow = readFileSync('.gitea/workflows/ci.yml', 'utf8');
  const packageMemory =
    'GRADLE_PACKAGE_JVM_ARGS: -Xmx640m -XX:MaxMetaspaceSize=320m -XX:MaxDirectMemorySize=128m -XX:+UseSerialGC';
  const nativeMemory =
    'GRADLE_NATIVE_JVM_ARGS: -Xmx384m -XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=128m -XX:+UseSerialGC';
  const dexMemory =
    'GRADLE_DEX_JVM_ARGS: -Xmx1024m -XX:MaxMetaspaceSize=320m -XX:MaxDirectMemorySize=128m -XX:+UseSerialGC';

  assert.equal(workflow.split(packageMemory).length - 1, 1);
  assert.equal(workflow.split(nativeMemory).length - 1, 1);
  assert.equal(workflow.split(dexMemory).length - 1, 1);
  assert.equal(workflow.split('-Dorg.gradle.jvmargs="$GRADLE_PACKAGE_JVM_ARGS"').length - 1, 2);
  assert.equal(workflow.split('-Dorg.gradle.jvmargs="$GRADLE_NATIVE_JVM_ARGS"').length - 1, 1);
  assert.equal(workflow.split('-Dorg.gradle.jvmargs="$GRADLE_DEX_JVM_ARGS"').length - 1, 1);
  assert.match(workflow, /ANDROID_RELEASE_ARCHITECTURES: arm64-v8a/);
  assert.match(workflow, /CMAKE_BUILD_PARALLEL_LEVEL: '1'/);
  assert.match(workflow, /Build Android native libraries/);
  assert.match(workflow, /':app:buildCMakeRelWithDebInfo\[arm64-v8a\]'/);
  assert.match(workflow, /Merge Android release DEX/);
  assert.match(workflow, /:app:mergeExtDexRelease/);
  assert.equal(
    workflow.split('-PreactNativeArchitectures="$ANDROID_RELEASE_ARCHITECTURES"').length - 1,
    4,
  );
  assert.doesNotMatch(
    workflow,
    /-Xmx512m -XX:MaxMetaspaceSize=768m/,
    'release packaging must not regress to the heap size that exhausted D8',
  );
});
