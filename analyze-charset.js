#!/usr/bin/env node
/**
 * Analyze extended charset file and report:
 * 1) total unique characters
 * 2) delta vs 3500 baseline
 * 3) stroke count distribution
 * 4) presence of specific chars: "哼", "暧"
 * 5) brief usage suggestions (printed as text)
 */

const fs = require('fs');
const path = require('path');
const cnchar = require('cnchar');
require('cnchar-order');

function isCJK(ch) {
  const cp = ch.codePointAt(0);
  return cp >= 0x4E00 && cp <= 0x9FFF; // Basic CJK block
}

function strokeOf(ch) {
  try {
    const s = cnchar.stroke(ch);
    if (typeof s === 'number' && Number.isFinite(s) && s > 0) return s;
  } catch (_) {}
  try {
    const order = cnchar.stroke(ch, 'order');
    if (Array.isArray(order) && order.length > 0) return order.length;
  } catch (_) {}
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { file: 'content-extended.txt' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file' || a === '-f') opts.file = args[++i];
  }
  return opts;
}

function main() {
  const { file } = parseArgs();
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const set = new Set();
  for (const ch of content) {
    if (isCJK(ch)) set.add(ch);
  }

  const total = set.size;
  const baseline = 3500;
  const delta = total - baseline;

  // Stroke distribution
  const dist = new Map();
  let unknown = 0;
  for (const ch of set) {
    const s = strokeOf(ch);
    if (s == null) {
      unknown++;
      continue;
    }
    dist.set(s, (dist.get(s) || 0) + 1);
  }

  const ordered = Array.from(dist.entries()).sort((a, b) => a[0] - b[0]);

  const hasHeng = set.has('哼');
  const hasAi = set.has('暧');

  console.log('=== 扩展字库统计报告 ===');
  console.log(`文件: ${path.relative(process.cwd(), filePath)}`);
  console.log(`总字数(唯一): ${total}`);
  console.log(`相比3500基线的增量: ${delta >= 0 ? '+' + delta : delta}`);
  console.log('笔画分布:');
  const lineParts = [];
  for (const [stroke, count] of ordered) {
    lineParts.push(`${stroke}画:${count}`);
  }
  if (unknown > 0) lineParts.push(`未知:${unknown}`);
  console.log(lineParts.join(' | '));
  console.log('补丁字包含情况:');
  console.log(`- 哼: ${hasHeng ? '是' : '否'}`);
  console.log(`- 暧: ${hasAi ? '是' : '否'}`);
  console.log('\n使用建议:');
  console.log('- 在构建流程中改用 `content-extended.txt` 作为字库源。');
  console.log('- 保留原 `content.txt` 作为最小集合，避免过度膨胀。');
  console.log('- 若需新增字，将其维护在外部列表，用扩展脚本合并。');
  console.log('- 定期运行扩展与分析脚本，核对笔画分布与目标上限。');
}

main();