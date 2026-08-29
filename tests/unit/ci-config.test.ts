import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Android release packaging stays within the runner memory budget', () => {
  const workflow = readFileSync('.gitea/workflows/ci.yml', 'utf8');
  const androidBuild = readFileSync('android/app/build.gradle', 'utf8');
  const packageMemory =
    'GRADLE_PACKAGE_JVM_ARGS: -Xmx512m -XX:MaxMetaspaceSize=384m -XX:MaxDirectMemorySize=64m -XX:ReservedCodeCacheSize=64m -XX:+UseSerialGC';
  const nativeMemory =
    'GRADLE_NATIVE_JVM_ARGS: -Xmx256m -XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=64m -XX:ReservedCodeCacheSize=64m -XX:+UseSerialGC';
  const dexMemory =
    'GRADLE_DEX_JVM_ARGS: -Xmx1024m -XX:MaxMetaspaceSize=320m -XX:MaxDirectMemorySize=128m -XX:+UseSerialGC';
  const lintMemory = 'GRADLE_LINT_JVM_ARGS: -Xmx512m -XX:MaxMetaspaceSize=512m';

  assert.equal(workflow.split(packageMemory).length - 1, 1);
  assert.equal(workflow.split(nativeMemory).length - 1, 1);
  assert.equal(workflow.split(dexMemory).length - 1, 1);
  assert.equal(workflow.split(lintMemory).length - 1, 1);
  assert.equal(workflow.split('-Dorg.gradle.jvmargs="$GRADLE_PACKAGE_JVM_ARGS"').length - 1, 2);
  assert.equal(workflow.split('-Dorg.gradle.jvmargs="$GRADLE_NATIVE_JVM_ARGS"').length - 1, 1);
  assert.equal(workflow.split('-Dorg.gradle.jvmargs="$GRADLE_DEX_JVM_ARGS"').length - 1, 1);
  assert.equal(workflow.split('-Dorg.gradle.jvmargs="$GRADLE_LINT_JVM_ARGS"').length - 1, 1);
  assert.match(workflow, /ANDROID_RELEASE_ARCHITECTURES: arm64-v8a/);
  assert.match(workflow, /CMAKE_BUILD_PARALLEL_LEVEL: '1'/);
  assert.match(workflow, /Build Android native libraries/);
  assert.match(workflow, /':app:buildCMakeRelWithDebInfo\[arm64-v8a\]'/);
  assert.match(workflow, /Merge Android release DEX/);
  assert.match(workflow, /:app:mergeExtDexRelease :app:mergeDexRelease/);
  assert.match(workflow, /Run Android release lint/);
  assert.match(workflow, /:app:lintVitalAnalyzeRelease/);
  assert.equal(
    workflow.split('-PreactNativeArchitectures="$ANDROID_RELEASE_ARCHITECTURES"').length - 1,
    5,
  );
  assert.doesNotMatch(
    workflow,
    /-Xmx512m -XX:MaxMetaspaceSize=768m/,
    'release packaging must not regress to the heap size that exhausted D8',
  );
  assert.match(androidBuild, /CMAKE_C_FLAGS_RELWITHDEBINFO=-O2 -DNDEBUG -g0/);
  assert.match(androidBuild, /CMAKE_CXX_FLAGS_RELWITHDEBINFO=-O2 -DNDEBUG -g0/);
  assert.match(androidBuild, /CMAKE_SHARED_LINKER_FLAGS=-Wl,--threads=1/);
});
