/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert = require('assert');

const center = n => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });
const epsilon = g => 1e-6 * Math.max(1, g.width, g.height);
const near = (a, b, e, message) => assert(Math.abs(a - b) <= e, `${message}: ${a} != ${b}`);

function containment(graph) {
  const e = epsilon(graph);
  function point(x, y, id) {
    assert(Number.isFinite(x) && Number.isFinite(y), `${id}: finite`);
    assert(x >= -e && y >= -e && x <= graph.width + e && y <= graph.height + e,
      `${id}: (${x}, ${y}) outside ${graph.width} x ${graph.height}`);
  }
  for (const n of graph.children || []) {
    point(n.x, n.y, n.id); point(n.x + n.width, n.y + n.height, n.id);
    for (const label of n.labels || []) {
      point(n.x + label.x, n.y + label.y, `${n.id}:label`);
      point(n.x + label.x + label.width, n.y + label.y + label.height, `${n.id}:label`);
    }
    for (const port of n.ports || []) {
      point(n.x + port.x, n.y + port.y, port.id);
      point(n.x + port.x + port.width, n.y + port.y + port.height, port.id);
    }
    if (n.children && n.children.length) containment(n);
  }
  for (const edge of graph.edges || []) {
    assert(edge.sections && edge.sections.length, `${edge.id}: missing route`);
    for (const section of edge.sections) {
      for (const p of [section.startPoint, ...(section.bendPoints || []), section.endPoint]) point(p.x, p.y, edge.id);
    }
    for (const label of edge.labels || []) {
      point(label.x, label.y, `${edge.id}:label`);
      point(label.x + label.width, label.y + label.height, `${edge.id}:label`);
    }
  }
}

function clearance(graph, spacing = 0) {
  const e = epsilon(graph);
  const nodes = graph.children || [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    const dx = Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width);
    const dy = Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height);
    const intersects = a.x < b.x + b.width - e && a.x + a.width > b.x + e
      && a.y < b.y + b.height - e && a.y + a.height > b.y + e;
    assert(!intersects && Math.hypot(dx, dy) + e >= spacing, `${a.id}/${b.id}: clearance ${Math.hypot(dx, dy)}`);
  }
}

function circular(nodes, e, expectedCenter, clockwise = true) {
  const c = expectedCenter || nodes.reduce((a, n) => {
    const p = center(n); return { x: a.x + p.x / nodes.length, y: a.y + p.y / nodes.length };
  }, { x: 0, y: 0 });
  const radii = nodes.map(n => Math.hypot(center(n).x - c.x, center(n).y - c.y));
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  radii.forEach(r => near(r, mean, e, 'radius'));
  const angles = nodes.map(n => Math.atan2(center(n).y - c.y, center(n).x - c.x));
  for (let i = 0; i < angles.length; i++) {
    const delta = ((clockwise ? 1 : -1) * (angles[(i + 1) % angles.length] - angles[i]) + 4 * Math.PI) % (2 * Math.PI);
    near(delta, 2 * Math.PI / nodes.length, 1e-6, 'angular gap');
  }
  return { center: c, radius: mean };
}

function geometry(graph) {
  return {
    width: graph.width, height: graph.height,
    nodes: [...(graph.children || [])].sort((a, b) => a.id.localeCompare(b.id))
      .map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })),
    edges: [...(graph.edges || [])].sort((a, b) => a.id.localeCompare(b.id))
      .map(e => ({ id: e.id, sources: e.sources, targets: e.targets,
        points: (e.sections || []).map(s => [s.startPoint, ...(s.bendPoints || []), s.endPoint]) }))
  };
}

module.exports = { center, epsilon, near, containment, clearance, circular, geometry };
