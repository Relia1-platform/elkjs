/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
// Robustness sweep of the geometric provider: random trees, stars, rings, forests and meshes through
// feature combinations, checking containment, spacing, labels, finite orthogonal routes, and timing.
// node scripts/geometric-sweep.cjs [seed] [runs] [overlap]   (overlap: FIXED positions may overlap)
const {performance}=require('perf_hooks');
const path=require('path');
const ELK=require('../lib/elk.bundled.js');
const metrics=require('../test/mocha/geometryMetrics');
let seed=+process.argv[2]||1;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
function graph(kind,n,labels,opts){const g={id:`${kind}-${n}`,layoutOptions:Object.assign({'elk.algorithm':'geometric','elk.spacing.nodeNode':String(ri(12,40))},opts),children:[],edges:[]};
  for(let i=0;i<n;i++)g.children.push({id:'n'+i,width:ri(20,90),height:ri(16,50)});
  const add=(a,b)=>{const e={id:`e${g.edges.length}`,sources:['n'+a],targets:['n'+b]};if(labels&&rnd()<0.7)e.labels=[{id:e.id+'-l',text:'l',width:ri(10,90),height:ri(10,18)}];g.edges.push(e);};
  if(kind==='tree')for(let i=1;i<n;i++)add(ri(0,i-1),i);
  if(kind==='star')for(let i=1;i<n;i++)add(0,i);
  if(kind==='ring'){for(let i=1;i<n;i++)add(i-1,i);add(n-1,0);}
  if(kind==='forest'){for(let i=1;i<n;i++)if(rnd()<0.8)add(ri(Math.max(0,i-4),i-1),i);}
  if(kind==='mesh'){for(let i=1;i<n;i++)add(ri(0,i-1),i);for(let k=0;k<n/3;k++)add(ri(0,n-1),ri(0,n-1));}
  return g;}
const combos=[{},{'elk.geometric.routing':'ORTHOGONAL'},{'elk.geometric.refine':'true'},{'elk.geometric.tree.hanging':'4'},{'elk.geometric.tree.routing':'BUS','elk.geometric.tree.hanging':'3','elk.geometric.refine':'true'},
  {'elk.geometric.routing':'ORTHOGONAL','elk.geometric.refine':'true','elk.geometric.tree.hanging':'5'},{'elk.geometric.packing':'COMPACT','elk.geometric.refine':'true'},{'elk.geometric.mode':'FIXED','elk.geometric.refine':'true','elk.geometric.routing':'ORTHOGONAL'},
  {'elk.direction':'RIGHT','elk.geometric.tree.hanging':'3','elk.geometric.routing':'ORTHOGONAL'},{'elk.geometric.order':'STABLE_ID','elk.geometric.refine':'true','elk.geometric.tree.hanging':'4','elk.interactive':'true'}];
(async()=>{const elk=new ELK({algorithms:['geometric']});let runs=0,failures=0,slow=[];
  for(let t=0;t<+(process.argv[3]||60);t++){const kind=['tree','star','ring','forest','mesh'][ri(0,4)];const n=ri(3,60);const labels=rnd()<0.6;const opts=combos[ri(0,combos.length-1)];
    const g=graph(kind,n,labels,opts);const id=`${g.id} ${labels?'labels ':''}${JSON.stringify(opts)}`;
    const overlapping=opts['elk.geometric.mode']==='FIXED'&&process.argv[4]==='overlap';
    if(opts['elk.geometric.mode']==='FIXED'){const cols=Math.ceil(Math.sqrt(n));g.children.forEach((c,i)=>{if(overlapping){c.x=ri(0,600);c.y=ri(0,600);}else{c.x=(i%cols)*140+ri(0,30);c.y=Math.floor(i/cols)*100+ri(0,30);}});}
    try{const t0=performance.now();const r=await elk.layout(JSON.parse(JSON.stringify(g)));const ms=performance.now()-t0;runs++;
      metrics.containment(r);const spacing=+g.layoutOptions['elk.spacing.nodeNode'];if(opts['elk.geometric.mode']!=='FIXED')metrics.clearance(r,spacing);if(labels&&opts['elk.geometric.mode']!=='FIXED')metrics.labels(r);
      for(const e of r.edges){if(!e.sections||e.sections.length!==1)throw new Error(e.id+' sections');for(const p of [e.sections[0].startPoint,e.sections[0].endPoint,...(e.sections[0].bendPoints||[])])if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error(e.id+' non-finite');}
      if(opts['elk.geometric.routing']==='ORTHOGONAL'&&opts['elk.geometric.mode']!=='FIXED')for(const e of r.edges){const p=[e.sections[0].startPoint,...(e.sections[0].bendPoints||[]),e.sections[0].endPoint];for(let i=1;i<p.length;i++)if(Math.abs(p[i].x-p[i-1].x)>1e-9&&Math.abs(p[i].y-p[i-1].y)>1e-9)throw new Error(e.id+' not orthogonal');}
      if(ms>500){slow.push(`${id} ${ms.toFixed(0)}ms`);if(process.env.SWEEP_DUMP)require('fs').writeFileSync(path.join(process.env.SWEEP_DUMP,`slow-${g.id}-${t}.json`),JSON.stringify(g));}}
    catch(e){failures++;console.log('FAIL',id,'::',String(e.message).slice(0,160));if(process.env.SWEEP_DUMP)require('fs').writeFileSync(path.join(process.env.SWEEP_DUMP,`fail-${g.id}-${t}.json`),JSON.stringify(g));}}
  console.log(`runs=${runs} failures=${failures}`);for(const s of slow)console.log('SLOW',s);process.exit(failures?1:0);})();
