# 读取 LTspice 二进制 .raw（瞬态），打印若干节点在指定时刻的值
# python test/rawread.py test/spice/sw_2.raw "V(vs),V(cmp),V(u0v),V(e0v)" t1,t2,...
import sys, struct, re
sys.stdout.reconfigure(encoding='utf-8')
def read(path):
    b = open(path, 'rb').read()
    k = b.find('Binary:\n'.encode('utf-16-le'))
    hdr = b[:k].decode('utf-16-le')
    nv = int(re.search(r'No\. Variables:\s*(\d+)', hdr).group(1)); npnt = int(re.search(r'No\. Points:\s*(\d+)', hdr).group(1))
    names = re.findall(r'^\t\d+\t(\S+)\t\S+', hdr.split('\nVariables:')[1], re.M)
    data = b[k + len('Binary:\n'.encode('utf-16-le')):]
    dbl = 'double' in hdr.split('Flags:')[1].split('\n')[0]
    rec = 8 * nv if dbl else 8 + 4 * (nv - 1)
    cols = {n: [] for n in names}
    for i in range(npnt):
        r = data[i * rec:(i + 1) * rec]
        if dbl: vals = struct.unpack('<%dd' % nv, r)
        else: vals = (abs(struct.unpack('<d', r[:8])[0]),) + struct.unpack('<%df' % (nv - 1), r[8:])
        for n, v in zip(names, vals): cols[n].append(v)
    return cols
if __name__ == '__main__':
    c = read(sys.argv[1]); want = sys.argv[2].split(','); ts = [float(x) for x in sys.argv[3].split(',')]
    t = c['time']; import bisect
    print('t'.ljust(12) + ''.join(w.ljust(14) for w in want))
    for tt in ts:
        i = min(bisect.bisect_left(t, tt), len(t) - 1)
        print(f'{t[i]:<12.5g}' + ''.join(f'{c[w][i]:<14.6g}' for w in want))
