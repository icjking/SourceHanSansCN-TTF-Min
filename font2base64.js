#!/usr/bin/env node
/**
 * 字体文件转 Base64 的命令行脚本
 *
 * 作用：递归处理指定目录（默认 src/）下的 .ttf / .otf 文件，
 * 为每个字体生成一个 JS 文件，内容格式为：
 *   export const fontBase64 = 'xxx';
 * 文件名格式：原文件名.js
 *
 * 使用：
 *   node font2base64.js [--dir <srcDir>] [--out <outDir>] [--overwrite] [--ext <exts>]
 *
 * 参数说明：
 *   --dir       要扫描的目录，默认 'src'
 *   --out       输出目录（可选）。不设置时输出到源字体文件所在目录；
 *               设置时会按源目录的相对层级在 out 目录中创建同名子目录。
 *   --overwrite 若目标 JS 文件已存在，允许覆盖；默认不覆盖并跳过。
 *   --ext       处理的扩展名，逗号分隔，默认 'ttf,otf'（大小写不敏感）
 *   -h|--help   显示帮助
 * 
 * 示例：
 *   node font2base64.js --dir src  --out jspdf_fonts           # 扫描 src/，输出到 jspdf_fonts/ 并保留层级
 *   node font2base64.js --dir dist --out jspdf_fonts_simplify  # 扫描 dist/，输出到 jspdf_fonts_simplify/ 并保留层级
 *   node font2base64.js --out jspdf_fonts                      # 扫描 src/，输出到 jspdf_fonts/ 并保留层级
 *   node font2base64.js --dir fonts --overwrite --ext ttf,otf  # 扫描 fonts/，输出到 fonts/ 并覆盖已存在文件
 * 
 * 注意：
 *   1. 脚本会递归处理指定目录下的所有子目录。
 *   2. 若输出目录已存在文件，默认不覆盖，可通过 --overwrite 强制覆盖。
 *   3. 脚本会根据字体文件的相对路径，在输出目录中创建相同的子目录结构。
 */

const fs = require('fs');
const path = require('path');

function printHelp() {
  console.log(`字体转 Base64 脚本使用方法：
  node font2base64.js [--dir <srcDir>] [--out <outDir>] [--overwrite] [--ext <exts>]

示例：
  node font2base64.js                    # 扫描 src/，在原目录生成 -base64.js 文件
  node font2base64.js --out jspdf_fonts  # 扫描 src/，输出到 jspdf_fonts/ 并保留层级
  node font2base64.js --dir fonts --overwrite --ext ttf,otf
`);
}

// 参数解析
const args = process.argv.slice(2);
let srcDir = 'src';
let outDir = null;
let overwrite = false;
let extensions = ['ttf', 'otf'];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-h' || arg === '--help') {
    printHelp();
    process.exit(0);
  } else if (arg === '--dir') {
    srcDir = args[++i] || srcDir;
  } else if (arg === '--out') {
    outDir = args[++i] || null;
  } else if (arg === '--overwrite') {
    overwrite = true;
  } else if (arg === '--ext') {
    const exts = (args[++i] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (exts.length) extensions = exts;
  } else {
    console.warn(`未知参数：${arg}`);
    printHelp();
    process.exit(1);
  }
}

// 校验源目录
const absSrc = path.resolve(process.cwd(), srcDir);
if (!fs.existsSync(absSrc) || !fs.statSync(absSrc).isDirectory()) {
  console.error(`源目录不存在或不可访问：${absSrc}`);
  process.exit(1);
}

// 若指定了输出目录，确保存在
let absOut = null;
if (outDir) {
  absOut = path.resolve(process.cwd(), outDir);
  try {
    fs.mkdirSync(absOut, { recursive: true });
  } catch (e) {
    console.error(`创建输出目录失败：${absOut}\n${e && e.message}`);
    process.exit(1);
  }
}

function isFontFile(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return extensions.includes(ext);
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function ensureDirSync(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function getOutputPath(srcFile) {
  const baseName = path.basename(srcFile, path.extname(srcFile));
  const outFileName = `${baseName}.js`;
  if (!absOut) {
    // 输出到源文件所在目录
    return path.join(path.dirname(srcFile), outFileName);
  }
  // 输出到指定目录，保留相对层级
  const rel = path.relative(absSrc, path.dirname(srcFile));
  const targetDir = path.join(absOut, rel);
  ensureDirSync(targetDir);
  return path.join(targetDir, outFileName);
}

function generateJs(base64) {
  // 保持用户要求的导出格式
  return `export const fontBase64 = '${base64}';\n`;
}

let processed = 0;
let skipped = 0;
let failed = 0;

console.log(`开始处理目录：${absSrc}`);
for (const filePath of walk(absSrc)) {
  if (!isFontFile(filePath)) continue;
  const outPath = getOutputPath(filePath);

  if (!overwrite && fs.existsSync(outPath)) {
    console.log(`跳过（已存在）：${outPath}`);
    skipped++;
    continue;
  }

  try {
    const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
    const jsContent = generateJs(base64);
    fs.writeFileSync(outPath, jsContent, { encoding: 'utf8' });
    console.log(`✅ 生成：${outPath}`);
    processed++;
  } catch (e) {
    console.error(`❌ 失败：${filePath} -> ${outPath}\n${e && e.message}`);
    failed++;
  }
}

console.log(`\n处理完成：成功 ${processed}，跳过 ${skipped}，失败 ${failed}`);
if (failed > 0) {
  process.exitCode = 1;
}