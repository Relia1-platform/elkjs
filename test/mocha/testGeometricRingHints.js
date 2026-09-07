/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const ELK=require('../../lib/elk.bundled.js');
const m=require('./geometryMetrics');
const elk=new ELK({algorithms:['geometric']});
function fixture(mode,connected){
  const children=[],edges=[];
  for(const prefix of ['a','b'])for(let i=0;i<5;i++){
    children.push({id:`${prefix}${i}`,width:40,height:30});
    edges.push({id:`${prefix}e${i}`,sources:[`${prefix}${i}`],targets:[`${prefix}${(i+1)%5}`]});
  }
  if(connected)edges.push({id:'bridge',sources:['a2'],targets:['b2']});
  return{id:'anchored',layoutOptions:{'elk.algorithm':'geometric','elk.geometric.mode':mode,
    'elk.geometric.ring.anchorId':'b3','elk.geometric.startAngle':'0'},children,edges};
}
describe('Ring hints in composed graphs',function(){
  for(const [mode,connected] of [['AUTO',false],['RING',false],['CLUSTER',true]])
    it(`applies the anchor to its ring in ${mode}`,async()=>{
      const graph=await elk.layout(fixture(mode,connected));
      const nodes=graph.children.filter(n=>n.id.startsWith('b'));
      const circle=m.circular(nodes,m.epsilon(graph)),anchor=m.center(nodes.find(n=>n.id==='b3'));
      m.near(anchor.x,circle.center.x+circle.radius,m.epsilon(graph),'anchor x');
      m.near(anchor.y,circle.center.y,m.epsilon(graph),'anchor y');
    });
});
