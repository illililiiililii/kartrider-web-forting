// Remaining shortest centreline distance, respecting original graph branches.
// This ranking policy is web code; lap/checkpoint validity remains native C.
export function courseDistances(nodes,first,last=nodes.length-1){
  const remaining=nodes.map(()=>Infinity);
  for(let pass=0;pass<nodes.length;pass++){
    let changed=false;
    nodes.forEach((node,i)=>{
      const tail=i===last&&!node.next.length?0:Math.min(...node.next.map(n=>n===first?0:remaining[n]));
      const distance=node.length+tail;
      if(distance<remaining[i]){remaining[i]=distance;changed=true;}
    });
    if(!changed)break;
  }
  if(!Number.isFinite(remaining[first])||remaining[first]<=0)throw new Error('COURSE_RANK_UNAVAILABLE');
  return (advance,node,distance)=>{
    const value=advance-(remaining[node]-distance)/remaining[first];
    if(!Number.isFinite(value))throw new Error('COURSE_RANK_UNAVAILABLE');
    return value;
  };
}
export function rankPlayers(states,members){
  const order=[...states].sort((a,b)=>{
    const pa=members.get(a.id),pb=members.get(b.id);
    if(pa.finished!==pb.finished)return pa.finished?-1:1;
    return (pa.finished?pa.time-pb.time:(b.progress??0)-(a.progress??0))||pa.slot-pb.slot;
  });
  return order.map((p,i)=>({...p,rank:i+1}));
}
