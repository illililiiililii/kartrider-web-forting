// Original 5136 rankBoard.xml and ranklist_*Spot.xml images/atlas rectangles.
const numbers=value=>value.split(' ').map(Number);
export function spriteRect(panel,text){
  const a=panel.attributes,[w,h]=numbers(a.fontSize),index=a.fontStr.indexOf(String(text));
  if(index<0)throw new Error('Unsupported rank glyph');
  const columns=Math.floor(panel.size[0]/w);
  return {w,h,x:index%columns*w,y:Math.floor(index/columns)*h};
}
export function createRankBoard(root){
  let data,pending,signature;
  function sprite(panel,text){
    const span=document.createElement('span');span.className='original-rank-sprite';
    const r=text===undefined?{w:panel.size[0],h:panel.size[1],x:0,y:0}:spriteRect(panel,text);
    Object.assign(span.style,{width:r.w+'px',height:r.h+'px',backgroundImage:`url(${JSON.stringify('./assets/ui/'+panel.image)})`,backgroundPosition:`-${r.x}px -${r.y}px`});return span;
  }
  function update(rows,self){
    pending=[rows,self];if(!data)return;
    const next=JSON.stringify(pending);if(signature===next)return;signature=next;
    const own=rows.find(p=>p.id===self)??rows[0];if(!own)return;
    root.replaceChildren();root.setAttribute('aria-label',`${own.rank}위 / ${rows.length}명`);
    const header=document.createElement('div');header.className='original-rank-header';root.append(header);
    for(const [key,text,position] of [['myrank',own.rank,[24,2]],['st',own.rank<=3?own.rank:0,[83,54]],['divider',undefined,[115,55]],['riderCount',rows.length,[135,46]]]){
      const panel=sprite(data.header[key],text);panel.style.left=position[0]+'px';panel.style.top=position[1]+'px';header.append(panel);
    }
    for(const p of [...rows].sort((a,b)=>a.rank-b.rank)){
      const original=data.slots[p.id===self?'self':'other'],panels=original.panels;
      const row=document.createElement('div');row.className='original-rank-row';row.setAttribute('aria-label',`${p.rank}위 ${p.nickname}`);
      for(const key of ['riderBG_0','spot','riderBG_line0'])if(panels[key]){
        const panel=sprite(panels[key]);panel.style.left=(key==='spot'?24:24)+'px';row.append(panel);
      }
      const rank=sprite(panels.rankStr,p.rank);rank.style.left='28px';rank.style.top='4px';row.append(rank);
      const label=document.createElement('strong');label.className='original-rank-name';label.textContent=p.nickname;
      if(p.id===self)label.id='race-rider-name';row.append(label);root.append(row);
    }
  }
  const ready=fetch('./assets/ui/rank-board.json').then(r=>{if(!r.ok)throw new Error('원본 순위표 준비 필요');return r.json();}).then(value=>{data=value;if(pending)update(...pending);});
  return {update,ready};
}
