/* SPDX-License-Identifier: EPL-2.0 OR GPL-3.0-or-later */
// node scripts/geometric-quality.cjs OUTPUT_DIRECTORY [BASELINE_BUNDLE]
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ELK = require('../lib/elk.bundled.js');
const metrics = require('../test/mocha/geometryMetrics');
const output = path.resolve(process.argv[2] || 'artifacts/geometric');
const baselinePath = process.argv[3] && path.resolve(process.argv[3]);
const Baseline = baselinePath ? require(baselinePath) : ELK;
const elk = new ELK({ algorithms: ['geometric'] });
const baseline = new Baseline();
const fixtureRoot = path.resolve(__dirname, '../../elk/test/geometry');
const clone = value => JSON.parse(JSON.stringify(value));

function flattenStages(log, rows = []) {
  if (!log) return rows;
  if (log.name && Number.isFinite(log.executionTime)) rows.push({name:log.name, milliseconds:log.executionTime*1000});
  for (const child of log.children || []) flattenStages(child, rows);
  return rows;
}

function cost(g) {
  let bends = 0, edgeLength = 0, edgeCount = (g.edges || []).length, nodeCount = 0;
  for (const child of g.children || []) {
    const nested=cost(child);bends+=nested.bends;edgeLength+=nested.edgeLength;
    edgeCount+=nested.edgeCount;nodeCount+=1+nested.nodeCount;
  }
  for (const e of g.edges || []) for (const section of e.sections || []) {
    bends += (section.bendPoints || []).length;
    const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
    for (let i = 1; i < points.length; i++) edgeLength += Math.hypot(points[i].x-points[i-1].x, points[i].y-points[i-1].y);
  }
  return {area:g.width*g.height, edgeLength, bends, edgeCount, nodeCount};
}

function generated(kind, count) {
  const graph = {id:`${kind}-${count}`,layoutOptions:{'elk.algorithm':'geometric','elk.spacing.nodeNode':'24'},children:[],edges:[]};
  if (kind==='nested') {
    // Several nested scopes plus edges between leaves exercise coordinate transfer and routing.
    for(let offset=0;offset<count;offset+=10) {
      const group={id:`group${offset}`,layoutOptions:{'elk.geometric.mode':'TREE','elk.spacing.nodeNode':'24'},children:[],edges:[]};
      for(let i=offset;i<Math.min(count,offset+10);i++) {
        group.children.push({id:`n${i}`,width:40,height:30});
        if(i>offset)group.edges.push({id:`e${i}`,sources:[`n${offset+Math.floor((i-offset-1)/2)}`],targets:[`n${i}`]});
      }
      const wrapper={id:`wrapper${offset}`,children:[group]};
      graph.children.push(wrapper);
      if(offset)graph.edges.push({id:`cross${offset}`,sources:[`n${offset-1}`],targets:[`n${offset}`]});
    }
    return graph;
  }
  if(kind==='mixed') {
    graph.layoutOptions['elk.geometric.mode']='CLUSTER';
    for(let i=0;i<count;i++)graph.children.push({id:`n${i}`,width:40,height:30});
    const add=(a,b)=>graph.edges.push({id:`e${graph.edges.length}`,sources:[`n${a}`],targets:[`n${b}`]});
    for(let offset=0;offset<count;offset+=10) {
      const size=Math.min(10,count-offset), ring=Math.min(6,size);
      for(let i=0;i<ring;i++)add(offset+i,offset+(i+1)%ring);
      for(let i=ring;i<size;i++)add(offset+i-1,offset+i);
      if(offset)add(offset-1,offset);
    }
    return graph;
  }
  for (let i=0;i<count;i++) {
    graph.children.push({id:`n${i}`,width:40,height:30});
    if (i) {
      const parent=kind==='star' ? 0 : kind==='tree' ? Math.floor((i-1)/2) : i-1;
      graph.edges.push({id:`e${i}`,sources:[`n${parent}`],targets:[`n${i}`]});
    }
  }
  if (kind==='ring' || kind==='chorded-ring') graph.edges.push({id:'close',sources:[`n${count-1}`],targets:['n0']});
  if (kind==='chorded-ring') {
    graph.layoutOptions['elk.geometric.mode']='RING';
    for(let i=0;i<Math.floor(count/4);i++) graph.edges.push({id:`chord${i}`,sources:[`n${i}`],targets:[`n${count-1-i}`]});
  }
  if(kind==='chain') graph.layoutOptions['elk.geometric.mode']='TREE';
  return graph;
}

function quantile(values, q) { const sorted=[...values].sort((a,b)=>a-b); return sorted[Math.ceil(q*sorted.length)-1]; }

async function main() {
  fs.mkdirSync(output,{recursive:true});
  const comparisons=[];
  for(const name of fs.readdirSync(fixtureRoot).filter(n=>n.endsWith('.json')).sort()) {
    const input=JSON.parse(fs.readFileSync(path.join(fixtureRoot,name),'utf8'));
    const legacy=clone(input);
    const oldAlgorithm=input.id.includes('tree')?'mrtree':input.id==='star'||input.id==='radial-asymmetric'?'radial':input.id==='ring'||input.id==='ring-unequal'?'stress':'layered';
    legacy.layoutOptions['elk.algorithm']=oldAlgorithm;
    if(oldAlgorithm==='radial') legacy.layoutOptions['elk.radial.centerOnRoot']='true';
    const before=await baseline.layout(legacy);
    metrics.containment(before); // A comparison is invalid if the baseline omitted any edge routes.
    const after=await elk.layout(clone(input),{logging:true,measureExecutionTime:true});
    metrics.containment(after); metrics.clearance(after,24);
    comparisons.push({id:input.id,oldAlgorithm,before,after,beforeCost:cost(before),afterCost:cost(after)});
  }
  fs.writeFileSync(path.join(output,'comparisons.json'),JSON.stringify(comparisons,null,2));
  const benchmarks=[];
  for(const kind of ['tree','star','ring','chain','chorded-ring','mixed','nested']) for(const count of [10,100,1000]) {
    const input=generated(kind,count), durations=[], heaps=[], stages={};
    let result;
    await elk.layout(clone(input)); // Warm up this topology before sampling.
    for(let sample=0;sample<5;sample++) {
      const heap=process.memoryUsage().heapUsed, start=performance.now();
      result=await elk.layout(clone(input),{logging:true,measureExecutionTime:true});
      durations.push(performance.now()-start); heaps.push(process.memoryUsage().heapUsed-heap);
      for(const stage of flattenStages(result.logging)) (stages[stage.name] ||= []).push(stage.milliseconds);
    }
    metrics.containment(result); metrics.clearance(result,24);
    const row={kind,nodes:count,edges:cost(input).edgeCount,p50Ms:quantile(durations,.5),p95Ms:quantile(durations,.95),
      maxHeapDeltaBytes:Math.max(...heaps),...cost(result),stages:Object.fromEntries(Object.entries(stages)
        .map(([name,values])=>[name,{p50Ms:quantile(values,.5),p95Ms:quantile(values,.95)}]))};
    benchmarks.push(row); console.log(`${kind} ${count}: p50=${row.p50Ms.toFixed(1)}ms p95=${row.p95Ms.toFixed(1)}ms`);
  }
  fs.writeFileSync(path.join(output,'benchmark.json'),JSON.stringify({runtime:process.version,samples:5,
    memoryMeasurement:'Heap delta per run; includes GC effects and is not peak memory.',benchmarks},null,2));
  const serialized=JSON.stringify(comparisons).replace(/</g,'\\u003c');
  const html=fs.readFileSync(path.join(__dirname,'geometric-gallery.html'),'utf8').replace('/* COMPARISON_DATA */ []',serialized);
  fs.writeFileSync(path.join(output,'gallery.html'),html);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
