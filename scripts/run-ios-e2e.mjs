import { spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const simulator = process.env.IOS_E2E_SIMULATOR || 'iPhone 17 Pro';
const mockPort = process.env.IOS_E2E_MOCK_PORT || '3210';
const flowPath = process.env.IOS_E2E_FLOW || 'tests/e2e-ios/flows';
const skipBuild = process.env.IOS_E2E_SKIP_BUILD === '1';
const javaHome =
  process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home';
const children = new Set();

function requireCommand(command, help) {
  const result = spawnSync('/bin/zsh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  if (result.status !== 0) throw new Error(`${command} is required. ${help}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited with status ${result.status ?? 'unknown'}`,
    );
  }
}

function runLogged(command, args, logPath, options = {}) {
  const log = openSync(logPath, 'w');
  const result = spawnSync(command, args, { stdio: ['ignore', log, log], ...options });
  closeSync(log);
  if (result.status !== 0) {
    const tail = readFileSync(logPath, 'utf8').split('\n').slice(-80).join('\n');
    console.error(tail);
    throw new Error(
      `${command} ${args.join(' ')} exited with status ${result.status ?? 'unknown'}; full log: ${logPath}`,
    );
  }
}

function start(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

async function waitFor(url, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function simulatorId(name) {
  const result = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('Could not list available iOS Simulators.');
  const runtimes = Object.values(JSON.parse(result.stdout).devices);
  const device = runtimes.flat().find((candidate) => candidate.name === name);
  if (!device) throw new Error(`No available iOS Simulator is named "${name}".`);
  return device.udid;
}

function cleanup() {
  for (const child of children) child.kill('SIGTERM');
}

process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.once('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

try {
  requireCommand('xcrun', 'Install Xcode and its command-line tools.');
  requireCommand(
    'maestro',
    'Install Maestro from https://docs.maestro.dev/getting-started/installing-maestro.',
  );

  console.log(`Booting iOS Simulator: ${simulator}`);
  spawnSync('xcrun', ['simctl', 'boot', simulator], { stdio: 'ignore' });
  run('open', ['-a', 'Simulator']);
  run('xcrun', ['simctl', 'bootstatus', simulator, '-b']);
  const deviceId = simulatorId(simulator);

  const mock = start(process.execPath, ['tests/e2e-ios/mock-server.mjs'], {
    env: { ...process.env, IOS_E2E_MOCK_PORT: mockPort },
  });
  mock.once('exit', (code) => {
    if (code && code !== 0) console.error(`Mock API exited unexpectedly with status ${code}`);
  });
  await waitFor(`http://127.0.0.1:${mockPort}/health`, 'Mock API');

  const derivedData = 'ios/build/native-e2e';
  if (!skipBuild) {
    console.log('Building the self-contained Release app for the simulator...');
    runLogged(
      'xcodebuild',
      [
        '-workspace',
        'ios/ActualBudget.xcworkspace',
        '-scheme',
        'ActualBudget',
        '-configuration',
        'Release',
        '-sdk',
        'iphonesimulator',
        '-destination',
        `platform=iOS Simulator,id=${deviceId}`,
        '-derivedDataPath',
        derivedData,
        '-quiet',
        'ONLY_ACTIVE_ARCH=YES',
        'ARCHS=arm64',
        'build',
      ],
      'ios/build/native-e2e-xcodebuild.log',
    );
  }
  const appPath = `${derivedData}/Build/Products/Release-iphonesimulator/ActualBudget.app`;
  spawnSync('xcrun', ['simctl', 'uninstall', deviceId, 'app.spendingtracker.mobile'], {
    stdio: 'ignore',
  });
  run('xcrun', ['simctl', 'install', deviceId, appPath]);

  run(
    'maestro',
    [
      'test',
      '-e',
      `MOCK_URL=http://127.0.0.1:${mockPort}`,
      '-e',
      'API_TOKEN=native-e2e-token',
      flowPath,
    ],
    {
      env: {
        ...process.env,
        JAVA_HOME: javaHome,
        IOS_E2E_MOCK_URL: `http://127.0.0.1:${mockPort}`,
        IOS_E2E_API_TOKEN: 'native-e2e-token',
      },
    },
  );
} finally {
  cleanup();
}
