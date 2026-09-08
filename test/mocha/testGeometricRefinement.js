/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const metrics = require('./geometryMetrics');
const ELK = require('../../lib/elk.bundled.js');
const fixtureDir = path.resolve(__dirname, '../../../elk/test/geometry');
const fixture = id => JSON.parse(fs.readFileSync(path.join(fixtureDir, id + '.json'), 'utf8'));
const center = n => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });
const TOLERANCE = 6; // max(4, spacing.nodeNode / 4) for the fixtures' spacing of 24

function classify(g) {
  const nodes = Object.fromEntries(g.children.map(n => [n.id, n]));
  let straight = 0, nearly = 0;
  for (const e of g.edges) {
    const a = center(nodes[e.sources[0]]), b = center(nodes[e.targets[0]]);
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (dx < 1e-9 || dy < 1e-9) straight++; else if (dx <= TOLERANCE || dy <= TOLERANCE) nearly++;
  }
  return { straight, nearly };
}

function minimumSeparation(g) {
  let minimum = Infinity;
  for (let i = 0; i < g.children.length; i++) for (let j = i + 1; j < g.children.length; j++) {
    const a = g.children[i], b = g.children[j];
    const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
    const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
    minimum = Math.min(minimum, Math.max(dx, dy));
  }
  return minimum;
}

describe('Geometric refinement', function () {
  this.timeout(30000);
  const elk = new ELK({ algorithms: ['geometric'] });

  it('registers the refine options with their defaults', async () => {
    const options = await elk.knownLayoutOptions();
    const refine = options.find(o => o.id === 'org.eclipse.elk.geometric.refine');
    const grid = options.find(o => o.id === 'org.eclipse.elk.geometric.refineGrid');
    assert(refine && refine.type === 'BOOLEAN', 'refine option');
    assert(grid && grid.type === 'DOUBLE', 'refineGrid option');
  });

  it('straightens nearly straight connectors of FIXED positions and keeps spacing, order and labels', async () => {
    const input = fixture('fixed-refine-labels');
    const unrefinedInput = structuredClone(input);
    unrefinedInput.layoutOptions['elk.geometric.refine'] = 'false';
    const unrefined = await elk.layout(unrefinedInput);
    const refined = await elk.layout(structuredClone(input));
    metrics.containment(refined); metrics.labels(refined);
    const before = classify(unrefined), after = classify(refined);
    assert(before.nearly >= 2, `fixture offers nearly straight connectors (${before.nearly})`);
    assert.strictEqual(after.nearly, 0, 'no nearly straight connector remains');
    assert(after.straight >= before.straight + before.nearly, `straight ${before.straight} -> ${after.straight}`);
    assert(minimumSeparation(refined) >= 24 - 1e-9, 'spacing kept');
    const originals = Object.fromEntries(unrefined.children.map(n => [n.id, n]));
    const shift = { x: refined.children[0].x - originals[refined.children[0].id].x, y: refined.children[0].y - originals[refined.children[0].id].y };
    for (const n of refined.children) {
      const o = originals[n.id];
      assert(Math.hypot(n.x - o.x - shift.x, n.y - o.y - shift.y) <= 3 * TOLERANCE + 1e-9, `${n.id} stays near its position`);
      metrics.near(n.x, Math.round(n.x), 1e-6, `${n.id} x on the pixel grid`);
      metrics.near(n.y, Math.round(n.y), 1e-6, `${n.id} y on the pixel grid`);
      for (const m of refined.children) {
        if (m === n) continue;
        const p = originals[m.id];
        if (o.x + o.width + TOLERANCE <= p.x) assert(n.x + n.width <= m.x + 1e-9, `${n.id} stays left of ${m.id}`);
        if (o.y + o.height + TOLERANCE <= p.y) assert(n.y + n.height <= m.y + 1e-9, `${n.id} stays above ${m.id}`);
      }
    }
  });

  it('refines the CLUSTER kernel output onto the grid, deterministically and independent of input order', async () => {
    const input = fixture('mixed-refine-labels');
    const refined = await elk.layout(structuredClone(input));
    metrics.containment(refined); metrics.labels(refined);
    assert(minimumSeparation(refined) >= 24 - 1e-9, 'spacing kept');
    for (const n of refined.children) {
      metrics.near(n.x, Math.round(n.x), 1e-6, `${n.id} x on the pixel grid`);
      metrics.near(n.y, Math.round(n.y), 1e-6, `${n.id} y on the pixel grid`);
    }
    const permuted = structuredClone(input);
    permuted.children.reverse(); permuted.edges.reverse();
    assert.deepStrictEqual(metrics.geometry(await elk.layout(permuted)), metrics.geometry(refined), 'STABLE_ID invariance');
    const unrefinedInput = structuredClone(input);
    delete unrefinedInput.layoutOptions['elk.geometric.refine'];
    const unrefined = await elk.layout(unrefinedInput);
    assert(unrefined.children.some(n => Math.abs(n.x - Math.round(n.x)) > 1e-6 || Math.abs(n.y - Math.round(n.y)) > 1e-6),
      'without refinement the kernel leaves positions off the pixel grid');
  });

  it('equalizes nearly equal gaps and refuses moves that would break spacing', async () => {
    const row = await elk.layout({ id: 'row', layoutOptions: { 'elk.algorithm': 'geometric', 'elk.geometric.mode': 'FIXED', 'elk.geometric.refine': 'true', 'elk.spacing.nodeNode': '24' },
      children: [{ id: 'a', x: 0, y: 0, width: 40, height: 30 }, { id: 'b', x: 64, y: 0, width: 40, height: 30 },
        { id: 'c', x: 134, y: 0, width: 40, height: 30 }, { id: 'd', x: 204, y: 0, width: 40, height: 30 }], edges: [] });
    const [a, b, c, d] = row.children;
    const gaps = [b.x - a.x - 40, c.x - b.x - 40, d.x - c.x - 40];
    metrics.near(gaps[0], gaps[1], 1e-9, 'equal gaps'); metrics.near(gaps[1], gaps[2], 1e-9, 'equal gaps');
    metrics.near(d.x - a.x, 204, 1e-9, 'row extent kept');
    const tight = await elk.layout({ id: 'tight', layoutOptions: { 'elk.algorithm': 'geometric', 'elk.geometric.mode': 'FIXED', 'elk.geometric.refine': 'true', 'elk.geometric.refineGrid': '8', 'elk.spacing.nodeNode': '24' },
      children: [{ id: 'p', x: 0, y: 0, width: 40, height: 30 }, { id: 'q', x: 65, y: 0, width: 40, height: 30 }], edges: [] });
    assert(tight.children[1].x - tight.children[0].x - 40 >= 24 - 1e-9, 'spacing kept on a coarse grid');
  });
});
