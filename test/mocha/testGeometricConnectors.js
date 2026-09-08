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

describe('Geometric connectors', function () {
  this.timeout(30000);
  const elk = new ELK({ algorithms: ['geometric'] });

  it('registers the tree routing option and the FIXED mode', async () => {
    const options = await elk.knownLayoutOptions();
    const routing = options.find(o => o.id === 'org.eclipse.elk.geometric.tree.routing');
    assert(routing, 'tree.routing option');
    assert.strictEqual(routing.type, 'ENUM');
    const g = await elk.layout({ id: 'fixed', layoutOptions: { 'elk.algorithm': 'geometric', 'elk.geometric.mode': 'FIXED' },
      children: [{ id: 'a', x: 0, y: 0, width: 40, height: 30 }, { id: 'b', x: 200, y: 0, width: 40, height: 30 }],
      edges: [{ id: 'ab', sources: ['a'], targets: ['b'] }] });
    metrics.near(g.children[1].x - g.children[0].x, 200, 1e-9, 'FIXED mode keeps the distance');
  });

  it('routes BUS trees as org charts with shared buses and junction points', async () => {
    const g = await elk.layout(fixture('symmetric-tree-bus-labels'));
    metrics.containment(g); metrics.clearance(g, 24); metrics.labels(g);
    const nodes = Object.fromEntries(g.children.map(n => [n.id, n]));
    const buses = {};
    for (const e of g.edges) {
      assert(orthogonal(e), `${e.id} is orthogonal`);
      const p = points(e), bends = metrics.routeStats({ points: p }).bends;
      assert(bends === 0 || bends === 2, `${e.id}: ${bends} bends`);
      const parent = nodes[e.sources[0]], child = nodes[e.targets[0]];
      metrics.near(p[0].x, parent.x + parent.width / 2, 1e-9, `${e.id} leaves the bottom center`);
      metrics.near(p[p.length - 1].y, child.y, 1e-9, `${e.id} enters the top`);
      if (bends === 2) {
        (buses[e.sources[0]] ||= []).push(p[1].y);
        assert(e.junctionPoints && e.junctionPoints.length === 1, `${e.id} junction`);
        metrics.near(e.junctionPoints[0].y, p[1].y, 1e-9, 'junction on the bus');
      }
    }
    for (const [parent, ys] of Object.entries(buses)) ys.forEach(y => metrics.near(y, ys[0], 1e-9, `${parent} shares one bus`));
    assert.strictEqual(Object.keys(buses).length, 3);
  });

  it('keeps DIRECT trees unchanged by default', async () => {
    const g = await elk.layout(fixture('symmetric-tree-labels'));
    for (const e of g.edges) {
      assert.strictEqual((e.sections[0].bendPoints || []).length, 0, `${e.id} straight`);
      assert(!e.junctionPoints, `${e.id} has no junction points`);
    }
  });

  it('routes horizontal BUS trees with vertical buses', async () => {
    const g = await elk.layout(fixture('unequal-tree-bus'));
    metrics.containment(g); metrics.labels(g);
    const nodes = Object.fromEntries(g.children.map(n => [n.id, n]));
    let buses = 0;
    for (const e of g.edges) {
      if (e.id.startsWith('x')) continue;
      assert(orthogonal(e), `${e.id} is orthogonal`);
      const p = points(e), parent = nodes[e.sources[0]];
      metrics.near(p[0].x, parent.x + parent.width, 1e-9, `${e.id} leaves the east side`);
      if (p.length === 4) { metrics.near(p[1].x, p[2].x, 1e-9, 'vertical bus'); buses++; }
    }
    assert(buses >= 3);
  });

  it('FIXED keeps relative positions and routes around obstacles', async () => {
    const input = fixture('fixed-routing-labels');
    const g = await elk.layout(structuredClone(input));
    metrics.containment(g); metrics.labels(g);
    const before = Object.fromEntries(input.children.map(n => [n.id, n]));
    const shift = { x: g.children[0].x - before[g.children[0].id].x, y: g.children[0].y - before[g.children[0].id].y };
    for (const n of g.children) {
      metrics.near(n.x, before[n.id].x + shift.x, 1e-9, `${n.id} x kept`);
      metrics.near(n.y, before[n.id].y + shift.y, 1e-9, `${n.id} y kept`);
    }
    for (const e of g.edges) for (const n of g.children) {
      if (e.sources.includes(n.id) || e.targets.includes(n.id)) continue;
      const p = points(e);
      for (let i = 1; i < p.length; i++) assert(!metrics.crosses(p[i - 1], p[i], n), `${e.id} crosses ${n.id}`);
    }
    assert((g.edges.find(e => e.id === 'ab').sections[0].bendPoints || []).length >= 2, 'ab detours around c');
  });

  for (const name of fs.readdirSync(fixtureDir).filter(n => n.includes('orthogonal')).sort()) {
    it(`draws ${name.replace('.json', '')} with axis-aligned, separated, labeled connectors`, async () => {
      const input = fixture(name.replace('.json', ''));
      const g = await elk.layout(structuredClone(input));
      metrics.containment(g); metrics.labels(g);
      const { nodes, routes } = metrics.absolute(g);
      const interior = [];
      for (const route of Object.values(routes)) {
        const p = route.points;
        for (let i = 1; i < p.length; i++) {
          assert(Math.abs(p[i].x - p[i - 1].x) < 1e-9 || Math.abs(p[i].y - p[i - 1].y) < 1e-9, `${route.id} segment ${i} is axis-aligned`);
          for (const n of nodes) {
            if (route.ancestors.has(n.id) || route.ends.has(n.id)) continue;
            assert(!metrics.crosses(p[i - 1], p[i], n), `${route.id} crosses ${n.id}`);
          }
          if (i >= 2 && i <= p.length - 2) interior.push([route.id, p[i - 1], p[i]]);
        }
      }
      for (let i = 0; i < interior.length; i++) for (let j = i + 1; j < interior.length; j++) {
        if (interior[i][0] === interior[j][0]) continue;
        const [, a, b] = interior[i], [, c, d] = interior[j];
        const h1 = Math.abs(a.y - b.y) < 1e-9, h2 = Math.abs(c.y - d.y) < 1e-9;
        if (h1 !== h2) continue;
        const same = h1 ? Math.abs(a.y - c.y) < 1e-6 : Math.abs(a.x - c.x) < 1e-6;
        const overlap = h1 ? Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
          : Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
        assert(!(same && overlap > 1e-6), `${interior[i][0]} and ${interior[j][0]} share a channel`);
      }
      assert.deepStrictEqual(metrics.geometry(await elk.layout(structuredClone(input))), metrics.geometry(g), 'determinism');
    });
  }

  it('keeps orthogonal star routes invariant under STABLE_ID permutation', async () => {
    const input = fixture('star-orthogonal-labels');
    const reference = metrics.geometry(await elk.layout(structuredClone(input)));
    const permuted = structuredClone(input);
    permuted.children.reverse(); permuted.edges.reverse();
    assert.deepStrictEqual(metrics.geometry(await elk.layout(permuted)), reference);
  });

  it('FIXED falls back to a direct connector when an endpoint is enclosed', async () => {
    const g = await elk.layout({ id: 'enclosed', layoutOptions: { 'elk.algorithm': 'geometric', 'elk.geometric.mode': 'FIXED' },
      children: [{ id: 'big', x: 0, y: 0, width: 200, height: 200 }, { id: 'inner', x: 90, y: 90, width: 20, height: 20 },
        { id: 'outside', x: 300, y: 85, width: 40, height: 30 }],
      edges: [{ id: 'escape', sources: ['inner'], targets: ['outside'], labels: [{ id: 'l', text: 'l', width: 50, height: 14 }] }] });
    assert.strictEqual(g.edges[0].sections.length, 1);
    assert.strictEqual((g.edges[0].sections[0].bendPoints || []).length, 0);
    assert(Number.isFinite(g.edges[0].labels[0].x));
  });
});
