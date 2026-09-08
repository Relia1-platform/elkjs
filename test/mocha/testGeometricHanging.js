/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const metrics = require('./geometryMetrics');
const ELK = require('../../lib/elk.bundled.js');
const fixtureDir = path.resolve(__dirname, '../../../elk/test/geometry');
const fixture = id => JSON.parse(fs.readFileSync(path.join(fixtureDir, id + '.json'), 'utf8'));
const points = e => [e.sections[0].startPoint, ...(e.sections[0].bendPoints || []), e.sections[0].endPoint];
const orthogonal = e => points(e).slice(1).every((p, i) => Math.abs(p.x - points(e)[i].x) < 1e-9 || Math.abs(p.y - points(e)[i].y) < 1e-9);
const distinct = (nodes, key) => new Set(nodes.map(n => Math.round(n[key] * 1000))).size;

function labelOnStub(e, leaf, horizontalStub) {
  const p = points(e), a = p[p.length - 2], b = p[p.length - 1];
  for (const l of e.labels || []) {
    const cx = l.x + l.width / 2, cy = l.y + l.height / 2;
    if (horizontalStub) {
      assert(cx > Math.min(a.x, b.x) - 1e-9 && cx < Math.max(a.x, b.x) + 1e-9, `${e.id} label between trunk and leaf`);
      assert(Math.abs(cy - a.y) - l.height / 2 <= leaf.height, `${e.id} label beside the stub`);
    } else {
      assert(cy > Math.min(a.y, b.y) - 1e-9 && cy < Math.max(a.y, b.y) + 1e-9, `${e.id} label between trunk and leaf`);
      assert(Math.abs(cx - a.x) - l.width / 2 <= leaf.width, `${e.id} label beside the stub`);
    }
  }
}

describe('Geometric hanging leaves', function () {
  this.timeout(30000);
  const elk = new ELK({ algorithms: ['geometric'] });

  it('registers the tree.hanging option', async () => {
    const option = (await elk.knownLayoutOptions()).find(o => o.id === 'org.eclipse.elk.geometric.tree.hanging');
    assert(option && option.type === 'INT', 'tree.hanging option');
  });

  it('hangs the leaves of a labeled star in columns with labels on the stubs', async () => {
    const input = fixture('hub-hanging-labels');
    const g = await elk.layout(structuredClone(input));
    metrics.containment(g); metrics.clearance(g, 24); metrics.labels(g);
    const nodes = Object.fromEntries(g.children.map(n => [n.id, n]));
    const leaves = g.children.filter(n => n.id.startsWith('d'));
    assert.strictEqual(distinct(leaves, 'x'), 4, 'four leaf columns');
    assert.strictEqual(distinct(leaves, 'y'), 6, 'six leaf rows');
    let bus;
    for (const e of g.edges) {
      assert(orthogonal(e), `${e.id} orthogonal`);
      const p = points(e);
      assert(p.length === 4 || p.length === 5, `${e.id} has 4 or 5 points`);
      bus = bus === undefined ? p[1].y : bus;
      metrics.near(p[1].y, bus, 1e-9, `${e.id} shares the bus`);
      const leaf = nodes[e.targets[0]];
      metrics.near(p[p.length - 1].y, leaf.y + leaf.height / 2, 1e-9, `${e.id} enters at the row center`);
      labelOnStub(e, leaf, true);
      assert(e.junctionPoints && e.junctionPoints.length >= 1, `${e.id} junctions`);
    }
    const radialInput = structuredClone(input);
    delete radialInput.layoutOptions['elk.geometric.tree.hanging'];
    const radial = await elk.layout(radialInput);
    assert(radial.width * radial.height > 4 * g.width * g.height, `radial ${radial.width}x${radial.height} vs hanging ${g.width}x${g.height}`);
    const permuted = structuredClone(input);
    permuted.children.reverse(); permuted.edges.reverse();
    assert.deepStrictEqual(metrics.geometry(await elk.layout(permuted)), metrics.geometry(g), 'STABLE_ID invariance');
  });

  it('packs a hanging block between the row children on a shared bus', async () => {
    const g = await elk.layout(fixture('tree-hanging-bus'));
    metrics.containment(g); metrics.clearance(g, 24); metrics.labels(g);
    const nodes = Object.fromEntries(g.children.map(n => [n.id, n]));
    const hanging = g.children.filter(n => n.id.startsWith('l'));
    const left = Math.min(...hanging.map(n => n.x)), right = Math.max(...hanging.map(n => n.x + n.width));
    assert(nodes.a.x + nodes.a.width <= left + 1e-9, 'a left of the block');
    assert(nodes.b.x >= right - 1e-9, 'b right of the block');
    metrics.near(nodes.a.y, hanging[0].y, 1e-9, 'first row shares the level');
    assert.strictEqual(distinct(hanging, 'x'), 2, 'one trunk, two columns');
    assert.strictEqual(distinct(hanging, 'y'), 5, 'five rows make the squarest block for ten leaves');
    let bus;
    for (const e of g.edges.filter(e => e.sources[0] === 'r')) {
      assert(orthogonal(e), `${e.id} orthogonal`);
      const p = points(e);
      if (p.length > 3) { bus = bus === undefined ? p[1].y : bus; metrics.near(p[1].y, bus, 1e-9, `${e.id} shares the bus`); }
      if (e.targets[0] === 'a' || e.targets[0] === 'b') assert.strictEqual(p.length, 4, `${e.id} bus drop`);
      else {
        assert.strictEqual(p.length, 3, `${e.id} runs straight down the root's axis`);
        metrics.near(p[1].x, nodes.r.x + nodes.r.width / 2, 1e-9, `${e.id} trunk under the root`);
        labelOnStub(e, nodes[e.targets[0]], true);
      }
    }
  });

  it('hangs leaves in rows with vertical stubs for horizontal trees', async () => {
    const input = fixture('hub-hanging-labels');
    input.layoutOptions['elk.direction'] = 'RIGHT';
    const g = await elk.layout(input);
    metrics.containment(g); metrics.clearance(g, 24); metrics.labels(g);
    const nodes = Object.fromEntries(g.children.map(n => [n.id, n]));
    const leaves = g.children.filter(n => n.id.startsWith('d'));
    const rows = distinct(leaves, 'y'), columns = distinct(leaves, 'x');
    assert.strictEqual(rows % 2, 0, 'two leaf rows per horizontal trunk');
    assert(rows * columns >= 24 && rows <= 8, `rows ${rows} x columns ${columns} hold 24 leaves`);
    for (const e of g.edges) {
      assert(orthogonal(e), `${e.id} orthogonal`);
      const leaf = nodes[e.targets[0]], end = points(e)[points(e).length - 1];
      metrics.near(end.x, leaf.x + leaf.width / 2, 1e-9, `${e.id} enters at the column center`);
      labelOnStub(e, leaf, false);
    }
  });

  it('keeps the radial star when the threshold is not exceeded', async () => {
    const input = fixture('hub-hanging-labels');
    input.layoutOptions['elk.geometric.tree.hanging'] = '30';
    const high = await elk.layout(structuredClone(input));
    delete input.layoutOptions['elk.geometric.tree.hanging'];
    assert.deepStrictEqual(metrics.geometry(high), metrics.geometry(await elk.layout(input)));
  });
});
