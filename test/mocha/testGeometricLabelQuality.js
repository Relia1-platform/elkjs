/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const metrics = require('./geometryMetrics');
const ELK = require('../../lib/elk.bundled.js');
const fixtureDir = path.resolve(__dirname, '../../../elk/test/geometry');
const fixtures = fs.readdirSync(fixtureDir).filter(n => n.endsWith('labels.json')).sort()
  .map(n => JSON.parse(fs.readFileSync(path.join(fixtureDir, n), 'utf8')));
const fixture = id => structuredClone(fixtures.find(g => g.id === id));

// Identifiers, endpoints, ports, hierarchy and label sizes, independent of geometry.
function structure(g) {
  return {
    children: (g.children || []).map(n => ({ id: n.id, ports: (n.ports || []).map(p => p.id), nested: structure(n) })),
    edges: (g.edges || []).map(e => ({ id: e.id, sources: e.sources, targets: e.targets,
      labels: (e.labels || []).map(l => [l.id, l.width, l.height]) }))
  };
}

function stripLabels(g) {
  for (const e of g.edges || []) delete e.labels;
  for (const n of g.children || []) stripLabels(n);
  return g;
}

function ports(g, out = {}) {
  for (const n of g.children || []) { for (const p of n.ports || []) out[p.id] = [p.x + 0, p.y + 0]; ports(n, out); }
  return out;
}

describe('Geometric label routing quality', function () {
  this.timeout(60000);
  const elk = new ELK({ algorithms: ['geometric'] });
  assert(fixtures.length >= 8, 'shared label fixtures are required');

  for (const input of fixtures) it(`keeps every label readable in ${input.id}`, async () => {
    const graph = await elk.layout(structuredClone(input));
    metrics.containment(graph);
    assert.deepStrictEqual(structure(graph), structure(input), 'structure');
    assert.deepStrictEqual(ports(graph), ports(input), 'fixed port coordinates');
    const count = metrics.labels(graph);
    assert(count > 0, 'labels present');
    const again = await elk.layout(structuredClone(input));
    assert.deepStrictEqual(metrics.geometry(graph), metrics.geometry(again), 'determinism');
  });

  for (const id of ['symmetric-tree-labels', 'star-labels', 'ring-labels']) it(`adds at most one bend per labeled edge in ${id}`, async () => {
    const labeled = metrics.absolute(await elk.layout(fixture(id))).routes;
    const plain = metrics.absolute(await elk.layout(stripLabels(fixture(id)))).routes;
    let added = 0, labeledEdges = 0;
    for (const [edgeId, route] of Object.entries(labeled)) {
      const a = metrics.routeStats(route), b = metrics.routeStats(plain[edgeId]);
      if (route.labels.length) labeledEdges++;
      added += a.bends - b.bends;
      // Room reserved for labels may scale the drawing, so the detour factor is compared, not raw length.
      assert(a.detour / b.detour <= 1.5 + 1e-9, `${id}: ${edgeId} detour ratio ${a.detour / b.detour}`);
    }
    assert(added <= labeledEdges, `${id}: ${added} added bends for ${labeledEdges} labeled edges`);
  });

  it('routes the six-leaf labeled star with at most six bends', async () => {
    const routes = metrics.absolute(await elk.layout(fixture('star-labels'))).routes;
    const bends = Object.values(routes).reduce((sum, r) => sum + metrics.routeStats(r).bends, 0);
    assert(bends <= 6, `star bends ${bends}`);
  });

  it('is invariant to input order under STABLE_ID', async () => {
    const input = fixture('star-labels');
    assert.strictEqual(input.layoutOptions['elk.geometric.order'], 'STABLE_ID');
    const reference = metrics.geometry(await elk.layout(structuredClone(input)));
    const permuted = structuredClone(input);
    permuted.children.reverse(); permuted.edges.reverse();
    for (const e of permuted.edges) if (e.labels) e.labels.reverse();
    assert.deepStrictEqual(metrics.geometry(await elk.layout(permuted)), reference);
  });

  it('centers inline labels on their segment', async () => {
    const input = fixture('symmetric-tree-labels');
    input.layoutOptions['elk.edgeLabels.inline'] = 'true';
    const graph = await elk.layout(input);
    metrics.containment(graph);
    const { routes } = metrics.absolute(graph);
    for (const route of Object.values(routes)) for (const label of route.labels) {
      const cx = label.x + label.width / 2, cy = label.y + label.height / 2;
      let on = false;
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1], b = route.points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
        if (!length) continue;
        const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
        const projection = (cx - a.x) * ux + (cy - a.y) * uy, distance = Math.abs((cx - a.x) * uy - (cy - a.y) * ux);
        if (projection >= -1e-6 && projection <= length + 1e-6 && distance <= 1e-6) on = true;
      }
      assert(on, `${label.id} is not on its edge`);
    }
  });

  for (const worker of ['elk-worker.js', 'elk-worker.min.js']) it(`places labels identically in ${worker}`, async () => {
    const Main = require('../../lib/main.js');
    const workerElk = new Main({ algorithms: ['geometric'], workerUrl: `./lib/${worker}` });
    try {
      for (const id of ['star-labels', 'hierarchy-labels']) {
        const expected = metrics.geometry(await elk.layout(fixture(id)));
        const actual = await workerElk.layout(fixture(id));
        metrics.labels(actual);
        assert.deepStrictEqual(metrics.geometry(actual), expected, id);
      }
    } finally { workerElk.terminateWorker(); }
  });
});
