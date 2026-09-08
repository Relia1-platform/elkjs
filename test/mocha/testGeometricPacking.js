/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const metrics = require('./geometryMetrics');
const ELK = require('../../lib/elk.bundled.js');
const fixtureDir = path.resolve(__dirname, '../../../elk/test/geometry');
const fixture = id => JSON.parse(fs.readFileSync(path.join(fixtureDir, id + '.json'), 'utf8'));

function separated(g, spacing) {
  for (let i = 0; i < g.children.length; i++) for (let j = i + 1; j < g.children.length; j++) {
    const a = g.children[i], b = g.children[j];
    const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width)), dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
    assert(Math.max(dx, dy) >= spacing - 1e-9, `${a.id} and ${b.id} keep ${spacing}`);
  }
}

describe('Geometric component packing', function () {
  this.timeout(30000);
  const elk = new ELK({ algorithms: ['geometric'] });
  const boxes = packing => ({ id: 'boxes', layoutOptions: { 'elk.algorithm': 'geometric', 'elk.spacing.componentComponent': '20', 'elk.geometric.packing': packing },
    children: [[40, 20], [60, 100], [50, 60], [40, 80], [30, 40], [70, 60], [40, 20]].map(([w, h], i) => ({ id: 'n' + i, width: w, height: h })), edges: [] });

  it('registers the packing option', async () => {
    const option = (await elk.knownLayoutOptions()).find(o => o.id === 'org.eclipse.elk.geometric.packing');
    assert(option && option.type === 'ENUM', 'packing option');
  });

  it('packs boxes by decreasing height with aligned tops, independent of input order', async () => {
    const g = await elk.layout(boxes('COMPACT'));
    separated(g, 20);
    const tallest = g.children.reduce((a, b) => b.height > a.height ? b : a);
    for (const n of g.children) assert(n.x >= tallest.x - 1e-9 && n.y >= tallest.y - 1e-9, `${n.id} after the tallest`);
    const tops = [...new Set(g.children.map(n => Math.round(n.y * 1000)))].sort((a, b) => a - b);
    assert(tops.length >= 2 && tops.length < g.children.length, 'several shelves');
    let previous = Infinity;
    for (const top of tops) {
      const height = Math.max(...g.children.filter(n => Math.round(n.y * 1000) === top).map(n => n.height));
      assert(height <= previous + 1e-9, 'shelves get shorter downward'); previous = height;
    }
    const shelf = await elk.layout(boxes('SHELF'));
    assert(g.width * g.height <= shelf.width * shelf.height + 1e-9, `compact ${g.width}x${g.height} vs shelf ${shelf.width}x${shelf.height}`);
    const reversed = boxes('COMPACT'); reversed.children.reverse();
    const again = await elk.layout(reversed);
    for (const n of g.children) { const m = again.children.find(o => o.id === n.id); metrics.near(m.x, n.x, 1e-9, n.id); metrics.near(m.y, n.y, 1e-9, n.id); }
  });

  it('packs the forest fixture denser than shelves and keeps the default unchanged', async () => {
    const input = fixture('forest-compact');
    const compact = await elk.layout(structuredClone(input));
    metrics.containment(compact); separated(compact, 24);
    const shelfInput = structuredClone(input); shelfInput.layoutOptions['elk.geometric.packing'] = 'SHELF';
    const shelf = await elk.layout(shelfInput);
    assert(compact.width * compact.height < shelf.width * shelf.height, `compact ${compact.width}x${compact.height} vs shelf ${shelf.width}x${shelf.height}`);
    const plainInput = structuredClone(input); delete plainInput.layoutOptions['elk.geometric.packing'];
    assert.deepStrictEqual(metrics.geometry(await elk.layout(plainInput)), metrics.geometry(shelf), 'SHELF is the default');
    const permuted = structuredClone(input); permuted.children.reverse(); permuted.edges.reverse();
    assert.deepStrictEqual(metrics.geometry(await elk.layout(permuted)), metrics.geometry(compact), 'STABLE_ID invariance');
  });
});
