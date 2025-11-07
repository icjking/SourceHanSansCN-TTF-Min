#!/usr/bin/env node
/**
 * 扩展常用字库脚本：
 * - 读取当前 content.txt 的 3500 常用字与 1000 次常用字
 * - 结合“通用规范汉字表”思路，智能增补现代常用、人名地名、网络、科技相关用字
 * - 目标扩展至 5000-6000 左右，按笔画分组输出到 content-extended.txt
 *
 * 用法：
 *   node extend-charset.js --limit 5800 --preview
 *   node extend-charset.js --limit 6000 --out content-extended.txt
 *   node extend-charset.js --include support/secondary.txt --limit 6000
 * 参数：
 *   --limit <n>    目标总字数（默认 5800）
 *   --out <path>   输出文件路径（默认 content-extended.txt）
 *   --preview      仅打印统计预览，不写文件
 *   --fontDir      指定字体目录（默认 src），用于保障所选字均被字体支持
 *   --include      额外字表文件（每行可空格或逗号分隔），用于二级字表等并入
 */

const fs = require('fs');
const path = require('path');
const cnchar = require('cnchar');
require('cnchar-order');
const fontkit = require('fontkit');

const ROOT = process.cwd();
const CONTENT_PATH = path.join(ROOT, 'content.txt');

function readContent() {
  const raw = fs.readFileSync(CONTENT_PATH, 'utf8');
  return raw;
}

// 解析 content.txt，提取所有已有单字集合
function parseExistingChars(text) {
  const lines = text.split(/\r?\n/);
  const charSet = new Set();
  for (const line of lines) {
    // 只处理形如："<数字>画\t<字 空格分隔>"
    const m = line.match(/^(\d+)[画\s]*\t(.+)$/);
    if (m) {
      const chars = m[2].replace(/\s+/g, ' ').trim().split(' ');
      for (const ch of chars) {
        if (!ch) continue;
        // 跳过非单字或非中文范围的项
        if (ch.length === 1) charSet.add(ch);
      }
    }
  }
  return charSet;
}

// 基于启发式的增补字列表（现代、网络、地名、人名、科技），避免追求全 8105
// 说明：挑选常见但可能未覆盖的字，后续仍以去重和笔画分类输出
const heuristicCandidates = (
  '哼 暧 囧 嗷 嗨 咦 呃 咔 咚 咻 咩 嗯 噗 咣 咔 吧 呗 嘤 嗝 嚯 窝 砍 缤 霾 夸 炫 酷 撩 佛 系 躺 平 内 卷 打 卡 种 草 布 道 赛 道 流 量 出 圈 破 圈 踩 雷 埋 雷 踩 坑 围 观 抄 袭 复 盘 拆 解 种 子 赋 能 互 联 网 算 法 模 型 数据 集 语 料 库 工 业 化 数 字 化 智 能 化 算 力 凯 撒 朵 拉 赵 钱 孙 李 周 吴 郑 王 军 磊 芳 娟 雪 霞 丹 静 冰 彤 俊 杰 博 文 子 轩 梓 萱 沛 文 沛 琳 可 可 乐 乐 妍 妍 昕 祺 祎 臻 宸 皓 轩 皓 宇 皓 天 博 学 浦 东 徐 汇 闵 行 嘉 定 松 江 青 浦 奉 贤 杨 浦 普 陀 虹 口 长 宁 黄 浦 静 安 朝 阳 海 淀 昌 平 顺 义 丰 台 石 景 山 东 城 西 城 天 河 越 秀 海 珠 番 禺 南 沙 黄 埔 白 云 梧 州 桂 林 柳 州 北 海 钦 州 防 城 港 崇 左 东 兴 珠 海 中 山 汕 头 汕 尾 梁 山 江 汉 江 岸 江 夏 硚 口 武 昌 汉 阳 青 山 洪 山 蔡 坪 星 链 区 块 切 片 深 度 学 习 强 化 学 习 迁 移 学 习 联 邦 学 习 参 数 梯 度 权 重 向 量 代 码 仓 软 件 包 管 理 器 接 口 协 议 代 理 服 务 虚 拟 化 容 器 镜 像 云 原 生 边 缘 计 算 物 联 网 数 据 库 缓 存 消 息 队 列 中 间 件 微 服 务 网 关 鉴 权 加 密 解 密 编 码 解 码 字 节 流 式 套 接 字 全 栈 前 端 后 端 中 台 端 到 端 千 层 饼 基 建 可 观 测 性 压 测 稳 态 灰 度 金 且 策 略' // 注意：这里包含了词汇，解析时只会提取单字
).replace(/\s+/g, '');

function buildCandidateSet() {
  const set = new Set();
  for (const ch of heuristicCandidates) {
    if (ch && ch.length === 1) set.add(ch);
  }
  return set;
}

function strokeOf(ch) {
  try {
    let n = cnchar.stroke(ch);
    if (typeof n === 'number' && n > 0) return n;
    const order = cnchar.stroke(ch, 'order');
    if (Array.isArray(order) && order.length > 0) {
      return order[0].length;
    }
  } catch (e) {
    return undefined;
  }
}

function groupByStroke(chars) {
  const map = new Map(); // stroke -> Set(chars)
  for (const ch of chars) {
    const n = strokeOf(ch);
    if (!n) continue;
    if (!map.has(n)) map.set(n, new Set());
    map.get(n).add(ch);
  }
  return map;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { limit: 5800, outPath: path.join(ROOT, 'content-extended.txt'), preview: false, fontDir: path.join(ROOT, 'src'), includeFiles: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--limit') { out.limit = parseInt(args[++i], 10) || out.limit; }
    else if (a === '--out') { out.outPath = path.resolve(ROOT, args[++i]); }
    else if (a === '--preview') { out.preview = true; }
    else if (a === '--fontDir') { out.fontDir = path.resolve(ROOT, args[++i]); }
    else if (a === '--include') { out.includeFiles.push(path.resolve(ROOT, args[++i])); }
  }
  return out;
}

function formatOutput(strokeMap) {
  // 读取原始 content.txt 的前置说明与排版，保留 2500/1000 标题与英文符号区
  const raw = readContent();
  const headerEndIdx = raw.indexOf('1000 个次常用字大全');
  const prefix = headerEndIdx > -1 ? raw.slice(0, headerEndIdx).trim() : '';
  const suffixStartIdx = raw.indexOf('1234567890');
  const suffix = suffixStartIdx > -1 ? raw.slice(suffixStartIdx).trim() : '';

  let body = '';
  const sorted = Array.from(strokeMap.keys()).sort((a, b) => a - b);
  for (const n of sorted) {
    const list = Array.from(strokeMap.get(n));
    list.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    body += `${n}画\t${list.join(' ')}\n`;
  }
  return `${prefix}\n\n${body}\n\n${suffix}`.trim() + '\n';
}

function main() {
  const { limit, outPath, preview, fontDir, includeFiles } = parseArgs();
  const raw = readContent();
  const existing = parseExistingChars(raw);
  const candidates = buildCandidateSet();
  const union = new Set(existing);
  for (const ch of candidates) union.add(ch);

  // 并入外部字表文件（如二级字表），支持空格/逗号/换行分隔
  for (const inc of includeFiles) {
    try {
      const t = fs.readFileSync(inc, 'utf8');
      const arr = t.split(/[\s,]+/g).map(s => s.trim()).filter(Boolean);
      for (const s of arr) {
        if (s.length === 1) union.add(s);
      }
      console.log(`并入外部字表：${inc}，条目：${arr.length}`);
    } catch (e) {
      console.warn('读取外部字表失败：', inc, e.message || e);
    }
  }

  // 如果已有超过 limit，则按现有为准；否则补充到接近 limit
  const currentCount = union.size;
  console.log(`现有字数：${existing.size}，增补候选：${candidates.size}，合计：${currentCount}，目标：${limit}`);

  // 分笔画分组
  // 从字体收集可用汉字（限定 CJK Unified Ideographs 范围），以保证不出现“字体不支持”的缺字
  try {
    const extra = extractCharsFromFonts(fontDir);
    for (const ch of extra) union.add(ch);
  } catch (e) {
    console.warn('从字体提取字符失败：', e.message || e);
  }

  let strokeMap = groupByStroke(union);

  // 如果超出 limit，执行简单截断：按笔画从低到高、字典序选取前 limit 个
  const total = Array.from(strokeMap.keys()).sort((a, b) => a - b).reduce((acc, k) => acc + strokeMap.get(k).size, 0);
  if (total > limit) {
    const picked = new Set();
    const keys = Array.from(strokeMap.keys()).sort((a, b) => a - b);
    for (const k of keys) {
      const list = Array.from(strokeMap.get(k)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
      for (const ch of list) {
        if (picked.size >= limit) break;
        picked.add(ch);
      }
      if (picked.size >= limit) break;
    }
    strokeMap = groupByStroke(picked);
    console.log(`超过限制，已按笔画与字典序截断至 ${picked.size} 字`);
  }

  if (preview) {
    const totalByStroke = Array.from(strokeMap.entries()).map(([n, s]) => `${n}画:${s.size}`).join(', ');
    console.log(`按笔画统计：${totalByStroke}`);
    return;
  }

  const outText = formatOutput(strokeMap);
  fs.writeFileSync(outPath, outText, 'utf8');
  console.log(`已生成：${outPath}`);
}

main();

// 递归扫描目录，提取 ttf/otf 中的中文字符（基本区）
function extractCharsFromFonts(dirPath) {
  const exts = new Set(['.ttf', '.otf']);
  const chars = new Set();
  const stack = [dirPath];
  while (stack.length) {
    const d = stack.pop();
    const items = fs.readdirSync(d, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(d, it.name);
      if (it.isDirectory()) { stack.push(p); }
      else if (it.isFile() && exts.has(path.extname(it.name).toLowerCase())) {
        try {
          const font = fontkit.openSync(p);
          const glyphs = font.characterSet;
          for (const code of glyphs) {
            // 基本汉字区：U+4E00 ~ U+9FFF
            if (code >= 0x4E00 && code <= 0x9FFF) {
              chars.add(String.fromCharCode(code));
            }
          }
        } catch (e) {
          console.warn('读取字体失败：', p, e.message || e);
        }
      }
    }
  }
  return chars;
}