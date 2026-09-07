/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
const assert=require('assert');
const ELK=require('../../lib/elk.bundled.js');
const {containment,near}=require('./geometryMetrics');

describe('Geometric constrained routing',function(){
  const elk=new ELK({algorithms:['geometric']});
  it('leaves a west-facing fixed port outward for a self-loop',async()=>{
    const g=await elk.layout({id:'loop',layoutOptions:{'elk.algorithm':'geometric'},
      children:[{id:'n',width:40,height:30,layoutOptions:{'elk.portConstraints':'FIXED_POS'},
        ports:[{id:'w',x:0,y:15,width:0,height:0,layoutOptions:{'elk.port.side':'WEST'}}]}],
      edges:[{id:'loop-edge',sources:['w'],targets:['w']}]});
    containment(g);
    const n=g.children[0],s=g.edges[0].sections[0];
    near(s.startPoint.x,n.x,1e-6,'loop start');near(s.endPoint.x,n.x,1e-6,'loop end');
    assert(s.bendPoints[0].x<n.x,'fixed west port must first route west');
  });

  it('preserves a fixed endpoint on the scope boundary',async()=>{
    const g=await elk.layout({id:'boundary',width:300,height:200,
      layoutOptions:{'elk.algorithm':'geometric','elk.portConstraints':'FIXED_POS'},
      ports:[{id:'in',x:0,y:100,width:0,height:0,layoutOptions:{'elk.port.side':'WEST'}}],
      children:[{id:'a',width:40,height:30}],edges:[{id:'input',sources:['in'],targets:['a']}]});
    const s=g.edges[0].sections[0],p=g.ports[0];
    near(s.startPoint.x,p.x+p.width/2,1e-6,'boundary x');near(s.startPoint.y,p.y+p.height/2,1e-6,'boundary y');
  });

  it('keeps multiple wide labels adjacent to their final route',async()=>{
    const g=await elk.layout({id:'labels',layoutOptions:{'elk.algorithm':'geometric','elk.geometric.mode':'TREE','elk.direction':'RIGHT'},
      children:[{id:'a',width:40,height:30},{id:'b',width:40,height:30}],
      edges:[{id:'ab',sources:['a'],targets:['b'],labels:[180,160,140].map((width,i)=>({id:`l${i}`,width,height:20,text:`label ${i}`}))}]});
    containment(g);
    const edge=g.edges[0];
    for(const label of edge.labels){
      const cx=label.x+label.width/2,cy=label.y+label.height/2;
      let adjacent=false;
      for(const s of edge.sections){const points=[s.startPoint,...(s.bendPoints||[]),s.endPoint];
        for(let i=1;i<points.length;i++){
          const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(!length)continue;
          const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,projection=(cx-a.x)*ux+(cy-a.y)*uy;
          const half=(Math.abs(ux)*label.width+Math.abs(uy)*label.height)/2;
          const normalHalf=(Math.abs(uy)*label.width+Math.abs(ux)*label.height)/2;
          if(projection>=half-1e-6&&projection<=length-half+1e-6&&Math.abs((cx-a.x)*uy-(cy-a.y)*ux)<=normalHalf+8)adjacent=true;
        }
      }
      assert(adjacent,`${label.id} lost its segment`);
    }
  });
});
