const PS = require('./load')(), C = PS.C;
const P = PS.preset(3);
const R = PS.design(P);
console.log('cp', JSON.stringify(R.rz.cpReal), 'fam', P.family, R.kd.type);
const S = PS.simulate(R);
console.log('T1', S.T1, 'Vpre', S.Vpre, 'up', S.up);
const i0 = S.av.t.findIndex(t => t >= S.T1 - 10e-6);
for (let i = i0; i < i0 + 60 && i < S.av.t.length; i += 2) {
  const tt = S.av.t[i]; let k = 0; while (k < S.pred.t.length - 1 && S.pred.t[k] < tt) k++;
  console.log(PS.fmt(tt - S.T1, 's').padEnd(9), (S.av.v[i] * 1e3).toFixed(2), (S.pred.v[k] * 1e3).toFixed(2));
}
const j = S.av.t.findIndex(t => t >= S.T1 + 100e-6);
console.log('后期', S.av.v.slice(j, j + 10).map(v => (v * 1e3).toFixed(2)).join(' '));
