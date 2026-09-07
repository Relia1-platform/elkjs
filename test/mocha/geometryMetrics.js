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
      .map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height,
        children: n.children && n.children.length ? geometry(n) : undefined })),
    edges: [...(graph.edges || [])].sort((a, b) => a.id.localeCompare(b.id))
      .map(e => ({ id: e.id, sources: e.sources, targets: e.targets,
        points: (e.sections || []).map(s => [s.startPoint, ...(s.bendPoints || []), s.endPoint]),
        labels: (e.labels || []).map(l => ({ id: l.id, x: l.x, y: l.y })) }))
  };
}

// Liang–Barsky clipping against the open interior of a box.
function crosses(a, b, box) {
  const e = 1e-6, lo = [box.x + e, box.y + e], hi = [box.x + box.width - e, box.y + box.height - e];
  let enter = 0, leave = 1;
  for (const [index, key] of ['x', 'y'].entries()) {
    const delta = b[key] - a[key];
    if (Math.abs(delta) < 1e-12) { if (a[key] <= lo[index] || a[key] >= hi[index]) return false; }
    else { const p = (lo[index] - a[key]) / delta, q = (hi[index] - a[key]) / delta;
      enter = Math.max(enter, Math.min(p, q)); leave = Math.min(leave, Math.max(p, q)); }
  }
  return enter < leave;
}

function gap(a, b) {
  const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  if (overlap) return -1;
  const dx = Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width);
  const dy = Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height);
  return Math.hypot(dx, dy);
}

// Absolute node boxes (nested included) and routes with absolute points and label boxes.
function absolute(graph) {
  const nodes = [], parent = {}, owner = {}, routes = {};
  (function walkNodes(g, ox, oy, parentId) {
    for (const n of g.children || []) {
      const x = ox + n.x, y = oy + n.y;
      nodes.push({ id: n.id, x, y, width: n.width, height: n.height });
      parent[n.id] = parentId;
      for (const p of n.ports || []) owner[p.id] = n.id;
      walkNodes(n, x, y, n.id);
    }
  })(graph, 0, 0, null);
  (function walkEdges(g, ox, oy) {
    for (const e of g.edges || []) {
      const points = [];
      for (const s of e.sections || []) for (const p of [s.startPoint, ...(s.bendPoints || []), s.endPoint]) points.push({ x: ox + p.x, y: oy + p.y });
      const labels = (e.labels || []).map(l => ({ id: l.id, x: ox + l.x, y: oy + l.y, width: l.width, height: l.height }));
      const ancestors = new Set();
      for (const end of [...e.sources, ...e.targets]) {
        for (let id = parent[owner[end] || end]; id; id = parent[id]) ancestors.add(id);
      }
      routes[e.id] = { id: e.id, points, labels, ancestors };
    }
    for (const n of g.children || []) walkEdges(n, ox + n.x, oy + n.y);
  })(graph, 0, 0);
  return { nodes, routes };
}

function routeStats(route) {
  let length = 0, bends = 0;
  const p = route.points;
  for (let i = 1; i < p.length; i++) length += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1];
    const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), ac = Math.hypot(c.x - a.x, c.y - a.y);
    if (Math.abs(ab + bc - ac) > 1e-6) bends++;
  }
  const direct = p.length ? Math.hypot(p[p.length - 1].x - p[0].x, p[p.length - 1].y - p[0].y) : 0;
  return { length, direct, bends, rawBends: Math.max(0, p.length - 2), detour: length / Math.max(1e-9, direct) };
}

function adjacent(label, route, edgeLabel) {
  const cx = label.x + label.width / 2, cy = label.y + label.height / 2, p = route.points;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length, projection = (cx - a.x) * ux + (cy - a.y) * uy;
    const half = (Math.abs(ux) * label.width + Math.abs(uy) * label.height) / 2;
    const normalHalf = (Math.abs(uy) * label.width + Math.abs(ux) * label.height) / 2;
    const distance = Math.abs((cx - a.x) * uy - (cy - a.y) * ux);
    if (projection >= half - 1e-6 && projection <= length - half + 1e-6 && distance <= normalHalf + edgeLabel + 8 + 1e-6) return true;
  }
  return false;
}

// Every edge label is adjacent to its own edge, clear of nodes and other labels, and uncrossed by other edges.
function labels(graph, { labelNode = 5, edgeLabel = 2 } = {}) {
  const { nodes, routes } = absolute(graph);
  const all = Object.values(routes).flatMap(r => r.labels);
  let count = 0;
  for (const route of Object.values(routes)) {
    for (const label of route.labels) {
      count++;
      assert(Number.isFinite(label.x) && Number.isFinite(label.y), `${label.id}: finite`);
      for (const node of nodes) {
        if (route.ancestors.has(node.id)) continue;
        assert(gap(label, node) + 1e-6 >= labelNode, `${label.id} overlaps node ${node.id}`);
      }
      for (const other of all) if (other !== label) assert(gap(label, other) >= -1e-6, `${label.id} overlaps label ${other.id}`);
      assert(adjacent(label, route, edgeLabel), `${label.id} is not adjacent to its edge ${route.id}`);
      for (const other of Object.values(routes)) {
        if (other === route) continue;
        for (let i = 1; i < other.points.length; i++) assert(!crosses(other.points[i - 1], other.points[i], label), `${other.id} crosses label ${label.id}`);
      }
    }
  }
  return count;
}

module.exports = { center, epsilon, near, containment, clearance, circular, geometry, crosses, gap, absolute, routeStats, labels };
