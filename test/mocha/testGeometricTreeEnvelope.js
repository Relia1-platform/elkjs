/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert=require('assert');
const ELK=require('../../lib/elk.bundled.js');
const m=require('./geometryMetrics');
const elk=new ELK({algorithms:['geometric']});

describe('Balanced tree visible envelopes',function(){
  for(const direction of ['DOWN','UP','LEFT','RIGHT'])it(`centers every parent over unequal descendant footprints in ${direction}`,async()=>{
    const children=Array.from({length:13},(_,i)=>({id:`n${i}`,width:20+i%4*30,height:10+i%3*20}));
    children[8].labels=[{id:'outside-label',text:'wide',x:-40,y:-18,width:150,height:14}];
    children[11].ports=[{id:'outside-port',x:100,y:15,width:12,height:12,
      labels:[{id:'port-label',text:'port',x:8,y:-20,width:45,height:12}]}];
    const parents=[0,0,0,1,1,2,2,3,4,4,5,9];
    const edges=parents.map((p,i)=>({id:`e${i}`,sources:[`n${p}`],targets:[`n${i+1}`]}));
    const graph=await elk.layout({id:'envelopes',layoutOptions:{'elk.algorithm':'geometric','elk.geometric.mode':'TREE',
      'elk.direction':direction,'elk.spacing.nodeNode':'24','elk.omitNodeMicroLayout':'true'},children,edges});
    const horizontal=direction==='LEFT'||direction==='RIGHT',axis=horizontal?'y':'x',extent=horizontal?'height':'width';
    const byId=Object.fromEntries(graph.children.map(n=>[n.id,n]));
    for(const parent of graph.children){
      const queue=edges.filter(e=>e.sources[0]===parent.id).map(e=>e.targets[0]);
      if(!queue.length)continue;
      const points=[];
      for(let i=0;i<queue.length;i++){
        const node=byId[queue[i]],origin=node[axis];
        points.push(origin,origin+node[extent]);
        for(const label of node.labels||[])points.push(origin+label[axis],origin+label[axis]+label[extent]);
        for(const port of node.ports||[]){
          points.push(origin+port[axis],origin+port[axis]+port[extent]);
          for(const label of port.labels||[])points.push(origin+port[axis]+label[axis],origin+port[axis]+label[axis]+label[extent]);
        }
        queue.push(...edges.filter(e=>e.sources[0]===node.id).map(e=>e.targets[0]));
      }
      m.near(m.center(parent)[axis],(Math.min(...points)+Math.max(...points))/2,m.epsilon(graph),parent.id);
    }
    m.containment(graph);m.clearance(graph,24);
    assert.equal(graph.edges.length,edges.length);
  });
});
