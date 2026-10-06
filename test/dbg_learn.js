// 调试：打印指定课程在给定参数下的 info 文本。node test/dbg_learn.js id '{"k":v}'
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, Math, Float64Array, BigInt, Number, Array, Object, JSON, isFinite, isNaN, parseFloat, setTimeout, clearTimeout, Set, Map, String };
ctx.globalThis = ctx; ctx.getComputedStyle = () => ({ getPropertyValue: () => '#888' }); ctx.document = { documentElement: {} };
vm.createContext(ctx);
const JS = fs.readFileSync(path.join(__dirname, '..', 'build.py'), 'utf8').match(/JS = \[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
for (const n of JS.slice(0, JS.map(n => n.startsWith('learn')).lastIndexOf(true) + 1)) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', n + '.js'), 'utf8'), ctx);
const l = ctx.PS.Learn.L.find(x => x.id === process.argv[2]);
const base = Object.fromEntries((l.sl || []).map(s => [s.k, s.v]));
for (const a of process.argv.slice(3).length ? process.argv.slice(3) : ['{}']) {
  const v = Object.assign({}, base, JSON.parse(a)), r = l.calc(v);
  console.log(a, '→', (r.info || '').replace(/<[^>]+>/g, ''));
  (r.extra || []).forEach(e => e.note && console.log('   extra:', e.note.replace(/<[^>]+>/g, '')));
  if (process.env.STEPS && l.steps) l.steps(v, r).forEach(s => console.log('   ', typeof s === 'string' ? s : s.t + ' | ' + (s.r || '').replace(/<[^>]+>/g, '')));
}
