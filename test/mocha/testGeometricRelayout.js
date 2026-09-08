/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const metrics = require('./geometryMetrics');
const ELK = require('../../lib/elk.bundled.js');
const fixtureDir = path.resolve(__dirname, '../../../elk/test/geometry');
const fixture = id => JSON.parse(fs.readFileSync(path.join(fixtureDir, id + '.json'), 'utf8'));
const centers = g => Object.fromEntries(g.children.map(n => [n.id, [n.x + n.width / 2, n.y + n.height / 2]]));

/** The fixture again, carrying the positions of a laid-out result, with an interactive relayout requested. */
function relayoutInput(id, laidOut, interactive) {
  const input = fixture(id);
  const positions = Object.fromEntries(laidOut.children.map(n => [n.id, n]));
  for (const n of input.children) { n.x = positions[n.id].x; n.y = positions[n.id].y; }
  input.layoutOptions['elk.interactive'] = String(interactive);
  return input;
}

/** Mean displacement of shared nodes after removing the common translation. */
function meanDisplacement(before, after) {
  const a = centers(before), b = centers(after);
  const ids = Object.keys(a).filter(id => b[id]);
  const dx = ids.reduce((s, id) => s + b[id][0] - a[id][0], 0) / ids.length;
  const dy = ids.reduce((s, id) => s + b[id][1] - a[id][1], 0) / ids.length;
  return ids.reduce((s, id) => s + Math.hypot(b[id][0] - a[id][0] - dx, b[id][1] - a[id][1] - dy), 0) / ids.length;
}

describe('Geometric relayout', function () {
  this.timeout(30000);
  const elk = new ELK({ algorithms: ['geometric'] });

  it('removes stale junction points when a prior route is replaced', async () => {
    const graph = await elk.layout({ id: 'old', layoutOptions: { 'elk.algorithm': 'geometric' },
      children: [{ id: 'a', width: 40, height: 30 }, { id: 'b', width: 40, height: 30 }],
      edges: [{ id: 'ab', sources: ['a'], targets: ['b'], junctionPoints: [{ x: 100000, y: 100000 }] }] });
    assert(!graph.edges[0].junctionPoints || graph.edges[0].junctionPoints.length === 0);
  });

  it('reproduces an unchanged drawing exactly in interactive mode', async () => {
    for (const id of ['symmetric-tree', 'unequal-tree', 'star', 'radial-asymmetric', 'ring', 'two-rings']) {
      const first = await elk.layout(fixture(id));
      const again = await elk.layout(relayoutInput(id, first, true));
      assert.deepStrictEqual(metrics.geometry(again), metrics.geometry(first), id);
    }
  });

  it('keeps tree siblings and radial children where they were when the model order changes', async () => {
    for (const id of ['unequal-tree', 'radial-asymmetric']) {
      const first = await elk.layout(fixture(id));
      const shuffled = relayoutInput(id, first, true);
      shuffled.children.reverse(); shuffled.edges.reverse();
      assert(meanDisplacement(first, await elk.layout(shuffled)) < 1e-9, `${id} interactive`);
      const plain = relayoutInput(id, first, false);
      plain.children.reverse(); plain.edges.reverse();
      assert(meanDisplacement(first, await elk.layout(plain)) > 10, `${id} without interactive`);
    }
  });

  it('appends a new leaf and keeps the rest within a node width', async () => {
    const first = await elk.layout(fixture('symmetric-tree'));
    const grown = relayoutInput('symmetric-tree', first, true);
    grown.children.push({ id: 'a0', width: 40, height: 30 });
    grown.edges.push({ id: 'a-a0', sources: ['a'], targets: ['a0'] });
    const result = await elk.layout(grown);
    const now = centers(result), old = centers(first);
    assert(now.a0[0] > now.a2[0], 'the new leaf comes after the previous children');
    metrics.near(now.b2[0] - now.b1[0], old.b2[0] - old.b1[0], 1e-9, "b's subtree keeps its shape");
    assert(meanDisplacement(first, result) < 40, 'mean displacement under one node width');
  });

  it('fits the ring orientation to mirrored previous positions', async () => {
    const first = await elk.layout(fixture('ring'));
    const mirrored = relayoutInput('ring', first, true);
    for (const n of mirrored.children) n.x = first.width - n.x - n.width;
    const expected = centers({ children: mirrored.children });
    const result = await elk.layout(mirrored);
    const now = centers(result);
    const ids = Object.keys(expected);
    const dx = ids.reduce((s, id) => s + now[id][0] - expected[id][0], 0) / ids.length;
    const dy = ids.reduce((s, id) => s + now[id][1] - expected[id][1], 0) / ids.length;
    for (const id of ids) {
      metrics.near(now[id][0], expected[id][0] + dx, 1e-6, `${id} x`);
      metrics.near(now[id][1], expected[id][1] + dy, 1e-6, `${id} y`);
    }
  });
});
