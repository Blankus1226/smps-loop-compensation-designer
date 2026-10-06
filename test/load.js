// 在 Node 中加载 src/*.js（与浏览器内联顺序一致），返回 PS 命名空间
const fs = require('fs'), path = require('path'), vm = require('vm');
const ORDER = ['core', 'model', 'loops', 'comp', 'digital', 'analysis', 'design', 'checks', 'sim', 'netlist', 'netsw'];
module.exports = function () {
  const ctx = { console, Math, Float64Array, BigInt, Number, Array, Object, JSON, isFinite, isNaN, parseFloat, setTimeout, clearTimeout };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const n of ORDER) {
    const f = path.join(__dirname, '..', 'src', n + '.js');
    if (fs.existsSync(f)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  }
  return ctx.PS;
};
