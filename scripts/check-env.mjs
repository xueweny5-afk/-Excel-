import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageLockPath = path.join(projectRoot, 'package-lock.json');
const nodeModulesPath = path.join(projectRoot, 'node_modules');
const viteBinPath = path.join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const skipDeps = process.argv.includes('--skip-deps');

function readPackageJson() {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    fail([
      '未找到或无法读取 package.json。',
      `请确认当前目录是项目根目录：${projectRoot}`,
    ]);
  }
}

function fail(messages) {
  console.error('');
  console.error('启动环境检查未通过：');
  messages.forEach((message) => console.error(`- ${message}`));
  console.error('');
  process.exit(1);
}

function parseVersion(version) {
  return version
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));
}

function satisfiesMinimumVersion(current, required) {
  const [currentMajor = 0, currentMinor = 0, currentPatch = 0] = parseVersion(current);
  const [requiredMajor = 0, requiredMinor = 0, requiredPatch = 0] = parseVersion(required.replace(/^[^\d]*/, ''));
  if (currentMajor !== requiredMajor) return currentMajor > requiredMajor;
  if (currentMinor !== requiredMinor) return currentMinor > requiredMinor;
  return currentPatch >= requiredPatch;
}

const packageJson = readPackageJson();
const requiredNode = packageJson.engines?.node ?? '>=20.19.0';
const minimumNode = requiredNode.match(/\d+\.\d+\.\d+/)?.[0] ?? '20.19.0';
const failures = [];

if (!satisfiesMinimumVersion(process.version, minimumNode)) {
  failures.push(`当前 Node.js 版本是 ${process.version}，项目要求 ${requiredNode}。请安装 Node.js ${minimumNode} 或更高版本。`);
}

if (!fs.existsSync(packageLockPath)) {
  failures.push('缺少 package-lock.json，无法确认依赖版本。请检查项目文件是否完整。');
}

if (!skipDeps) {
  if (!fs.existsSync(nodeModulesPath)) {
    failures.push('缺少 node_modules，依赖尚未安装。请运行 npm install。');
  } else if (!fs.existsSync(viteBinPath)) {
    failures.push('node_modules 中缺少 Vite 启动文件，依赖可能安装不完整。请重新运行 npm install。');
  }
}

if (failures.length > 0) fail(failures);

console.log(`启动环境检查通过：Node ${process.version}，依赖${skipDeps ? '检查已跳过' : '完整'}。`);
