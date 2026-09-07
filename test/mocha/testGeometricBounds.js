const { expect } = require('chai')
const ELK = require('../../lib/elk.bundled.js')
const elk = new ELK()

function assertContained(graph) {
  for (const n of graph.children) {
    expect(n.x, `${n.id} left`).to.be.at.least(-1e-6)
    expect(n.y, `${n.id} top`).to.be.at.least(-1e-6)
    expect(n.x + n.width, `${n.id} right`).to.be.at.most(graph.width + 1e-6)
    expect(n.y + n.height, `${n.id} bottom`).to.be.at.most(graph.height + 1e-6)
  }
}

describe('Geometric bounds', function () {
  it('MrTree contains unequal node sizes in every direction', async function () {
    for (const direction of ['DOWN', 'UP', 'LEFT', 'RIGHT']) {
      const graph = {
        id: 'g',
        layoutOptions: { 'elk.algorithm': 'mrtree', 'elk.direction': direction },
        children: [
          { id: 'root', width: 40, height: 40 },
          { id: 'small', width: 20, height: 20 },
          { id: 'large', width: 100, height: 80 }
        ],
        edges: ['small', 'large'].map(id => ({ id: `e-${id}`, sources: ['root'], targets: [id] }))
      }
      assertContained(await elk.layout(graph))
    }
  })

  it('radial centers the root without clipping asymmetric branches', async function () {
    const graph = {
      id: 'g',
      layoutOptions: { 'elk.algorithm': 'radial', 'elk.radial.centerOnRoot': 'true', 'elk.spacing.nodeNode': '40' },
      children: [{ id: 'root', width: 48, height: 48 }], edges: []
    }
    for (const [i, count] of [1, 2, 4].entries()) {
      const branch = `b${i}`
      graph.children.push({ id: branch, width: 48, height: 48 })
      graph.edges.push({ id: `root-${branch}`, sources: ['root'], targets: [branch] })
      for (let j = 0; j < count; j++) {
        const id = `${branch}-${j}`
        graph.children.push({ id, width: 48, height: 48 })
        graph.edges.push({ id: `e-${id}`, sources: [branch], targets: [id] })
      }
    }
    const result = await elk.layout(graph)
    assertContained(result)
    const root = result.children[0]
    expect(root.x + root.width / 2).to.be.closeTo(result.width / 2, 1e-6)
    expect(root.y + root.height / 2).to.be.closeTo(result.height / 2, 1e-6)
  })
})
