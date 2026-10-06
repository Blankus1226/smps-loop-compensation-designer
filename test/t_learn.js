// 学习模式：每个课程在默认值、滑杆两端、每个下拉选项下执行 calc / talk / steps / roles / mark / extra，检查异常、NaN、undefined
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, Math, Float64Array, BigInt, Number, Array, Object, JSON, isFinite, isNaN, parseFloat, setTimeout, clearTimeout, Set, Map, String };
ctx.globalThis = ctx; ctx.getComputedStyle = () => ({ getPropertyValue: () => '#888' }); ctx.document = { documentElement: {} };
vm.createContext(ctx);
// 文件顺序取自 build.py，只加载到最后一个 learn_*（UI 文件依赖 DOM）
const JS = fs.readFileSync(path.join(__dirname, '..', 'build.py'), 'utf8').match(/JS = \[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
const ORDER = JS.slice(0, JS.map(n => n.startsWith('learn')).lastIndexOf(true) + 1);
for (const n of ORDER) { const f = path.join(__dirname, '..', 'src', n + '.js'); vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }); }
const PS = ctx.PS, Lr = PS.Learn;
let fail = 0, nSteps = 0, nRoles = 0, nQuiz = 0, nTalk = 0;
const bad = s => /NaN|undefined|Infinity(?!\s*dB)|\[object/.test(s.replace(/∞/g, ''));
const strip = s => s.replace(/<[^>]+>/g, ' ');
const flt = process.argv.slice(2);
for (const l of Lr.ordered()) {
  if (flt.length && !flt.some(f => l.id.includes(f))) continue;
  const base = Object.fromEntries((l.sl || []).map(s => [s.k, s.v]));
  const cases = [['默认', base]];
  (l.sl || []).forEach(s => {
    if (s.opts) s.opts.forEach(o => { if (String(o[0]) !== String(s.v)) cases.push([s.k + '=' + o[0], Object.assign({}, base, { [s.k]: o[0] })]); });
    else { cases.push([s.k + '=min', Object.assign({}, base, { [s.k]: s.a })]); cases.push([s.k + '=max', Object.assign({}, base, { [s.k]: s.b })]); }
  });
  for (const [cn, v] of cases) {
    try {
      const r = l.calc ? l.calc(v) : {};
      if (l.mark) l.mark(v, r);
      let txt = (r.info || '') + (typeof l.talk === 'function' ? l.talk(v, r) : '');
      if (l.steps) { const st = l.steps(v, r); nSteps += st.length; txt += Lr.stepsHtml(st); }
      if (l.roles) { const t = typeof l.roles === 'function' ? l.roles(v, r) : l.roles; nRoles += t.rows.length; txt += Lr.rolesHtml(t); }
      (r.extra || []).forEach(e => { txt += e.title + (e.note || '') + (e.svg || '') + (e.html || ''); if (e.cfg) e.cfg.panels.forEach(p => p.series.forEach(s => { if (!s.x.length) throw new Error('附加图空序列 ' + s.name); })); });
      if (r.series) r.series.forEach(s => { const y = s.fn(PS.C.jw(1e3)); if (!isFinite(y.re) && !isFinite(y.im)) throw new Error('序列 ' + s.name + ' 在 1 kHz 处非有限'); });
      // 只对默认值严格检查数值文本（滑杆极端值允许出现“参数无效”提示）
      if (cn === '默认' && bad(strip(txt))) { fail++; const m = strip(txt).match(/.{0,60}(NaN|undefined|\[object|Infinity).{0,30}/); console.log('FAIL ' + l.id + ' ' + cn + ' 文本含无效数值: ' + (m ? m[0] : '')); }
      else if (cn !== '默认' && /undefined|\[object/.test(strip(txt))) { fail++; console.log('FAIL ' + l.id + ' ' + cn + ' 文本含 undefined/[object]'); }
    } catch (e) { fail++; console.log('ERR  ' + l.id + ' ' + cn + ': ' + e.message + (cn === '默认' ? '\n' + e.stack.split('\n').slice(1, 4).join('\n') : '')); }
  }
  if (l.talk) nTalk++;
  if (l.quiz) nQuiz += l.quiz.length;
  console.log('ok   ' + l.id.padEnd(9) + l.group + ' / ' + l.title + (l.talk ? '  [讲解]' : '') + (l.steps ? '  [计算]' : '') + (l.roles ? '  [作用表]' : '') + (l.quiz ? '  [思考题 ' + l.quiz.length + ']' : ''));
}
if (!flt.length) {
  const miss = (k, ok) => Lr.L.filter(l => !ok(l)).map(l => l.id);
  [['缺原理讲解', l => l.talk], ['缺计算过程', l => l.steps || l.noSteps], ['缺作用表', l => l.roles], ['缺思考题', l => l.quiz]].forEach(([k, ok]) => {
    const m = miss(k, ok); if (m.length) { console.log(k + ': ' + m.join(', ')); fail++; }
  });
  const ids = Lr.L.map(l => l.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i); if (dup.length) { console.log('重复 id: ' + dup.join(', ')); fail++; }
  // 课程间链接与先修必须指向存在的课程
  Lr.L.forEach(l => {
    const s = JSON.stringify(l) + Object.values(l).filter(x => typeof x === 'function').map(x => x.toString()).join('');
    const refs = (s.match(/link\('([^']+)'/g) || []).map(m => m.slice(6, -1)).concat((s.match(/data-go=\\?"([^"\\]+)/g) || []).map(m => m.replace(/data-go=\\?"/, '')), l.pre || []);
    refs.forEach(id => { if (!ids.includes(id)) { console.log('死链 ' + l.id + ' → ' + id); fail++; } });
  });
  const grp = [...new Set(Lr.L.map(l => l.group))].filter(g => !Lr.GROUPS.includes(g)); if (grp.length) { console.log('未登记的分组: ' + grp.join(', ')); fail++; }
}
console.log(`\n课程 ${Lr.L.length} 个，讲解 ${nTalk} 篇，计算步骤累计 ${nSteps} 条，作用表 ${nRoles} 行，思考题 ${nQuiz} 道，问题 ${fail} 项`);
process.exit(fail ? 1 : 0);
