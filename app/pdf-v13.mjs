// Browser and Node compatible, dependency-free A4 PDF renderer (WinAnsi Helvetica).
const BLACK='0.06 0.06 0.06', GOLD='0.68 0.51 0.20', GRAY='0.40 0.40 0.40';
const normalize=s=>String(s??'').replace(/[—–−•]/g,'-').replace(/\u00a0/g,' ').replace(/[^\x20-\xFF]/g,'?');
const escape=s=>normalize(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const width=(s,size)=>[...normalize(s)].reduce((n,c)=>n+(/[ilI.,:;!'| ]/.test(c)?0.3:/[MWmw@%]/.test(c)?1:/[A-ZÀ-Ý]/.test(c)?0.76:0.62)*size,0);
export function wrapText(value,max,size=9){
 const lines=[];let line='';
 for(const word of normalize(value).split(/\s+/)){
  if(width(line+(line?' ':'')+word,size)<=max){line+=(line?' ':'')+word;continue;}
  if(line){lines.push(line);line='';}
  for(const c of word){if(width(line+c,size)>max&&line){lines.push(line);line='';}line+=c;}
 }
 lines.push(line);return lines;
}
export function buildPDF(title,report){
 // The old public entry point accepted lines; silently treating that array as
 // a structured report used to create a PDF with only a header and a footer.
 if(Array.isArray(report))report={sections:[{title:'Registros',columns:['Descrição'],rows:report.map(line=>[line])}]};
 if(!report||!Array.isArray(report.sections))throw Error('Conteúdo do relatório inválido. Gere novamente o relatório.');
 if(!report.sections.length)report={...report,sections:[{title:'Registros',columns:['Descrição'],rows:[]}]};
 const pages=[];let commands=[],y=0,pageBodyTop=0;
 const text=(s,x,top,size=9,color=BLACK,bold=false)=>commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x} ${top} Tm (${escape(s)}) Tj ET`);
 const rect=(x,top,w,h,color)=>commands.push(`${color} rg ${x} ${top-h} ${w} ${h} re f`);
 const line=(x,top,w,color=GOLD)=>commands.push(`${color} RG 0.5 w ${x} ${top} m ${x+w} ${top} l S`);
 const newPage=()=>{
  if(commands.length)pages.push(commands.join('\n'));
  commands=[];rect(0,842,595,132,BLACK);rect(36,806,4,23,GOLD);
  text('OURO CERTO',50,792,16,'1 1 1',true);text('GESTÃO FINANCEIRA / V13',50,773,8,'0.85 0.72 0.43');
  wrapText(title,510,19).slice(0,2).forEach((t,i)=>text(t,36,744-i*23,19,'1 1 1',true));y=687;
  for(const item of [report.subtitle,report.scope,report.issued,report.note].filter(Boolean))for(const t of wrapText(item,523,8)){text(t,36,y,8,GRAY);y-=12;}
  y-=12;pageBodyTop=y;
 };
 const room=h=>{if(y-h<62)newPage();};
 newPage();
 if(report.stats?.length){
  for(let offset=0;offset<report.stats.length;offset+=4){room(65);const cards=report.stats.slice(offset,offset+4),w=124;
   cards.forEach((c,i)=>{const x=36+i*133;rect(x,y,w,55,'0.97 0.96 0.93');rect(x,y,w,3,GOLD);text(c.label,x+9,y-18,8,GRAY);text(c.value,x+9,y-39,Math.min(12,106/width(c.value,1)),BLACK,true);});y-=69;
  }
 }
 for(const section of report.sections||[]){
  const cols=section.columns||['Descrição'],weights=section.widths||cols.map(()=>1),sum=weights.reduce((a,b)=>a+b,0),widths=weights.map(w=>523*w/sum);
  const headerCells=cols.map((c,i)=>wrapText(c,widths[i]-14,8)),headerHeight=Math.max(...headerCells.map(c=>c.length))*11+13;
  const titleLines=wrapText(section.title,523,12);room(25+headerHeight+titleLines.length*17+4);for(const t of titleLines){text(t,36,y,12,BLACK,true);y-=17;}y-=4;
  const header=()=>{room(headerHeight+25);rect(36,y,523,headerHeight,BLACK);let x=36;headerCells.forEach((cell,i)=>{cell.forEach((c,j)=>text(c,x+7,y-15-j*11,8,'1 1 1',true));x+=widths[i];});y-=headerHeight;};header();
  const continuationLines=wrapText(section.title+' (continuação)',523,11);
  const continuation=()=>{newPage();for(const t of continuationLines){text(t,36,y,11,BLACK,true);y-=17;}y-=4;header();};
  const rows=section.rows||[];
  if(!rows.length){room(30);rect(36,y,523,28,'0.97 0.97 0.97');text('Nenhuma conta ou registro corresponde aos filtros selecionados.',43,y-18,9,BLACK);y-=28;}
  rows.forEach((row,index)=>{
   const cells=cols.map((_,i)=>wrapText(row[i]??'',widths[i]-14,9)),count=Math.max(...cells.map(c=>c.length));let offset=0;
   // Keep ordinary rows intact and the final subtotal beside the last row.
   // Only a row taller than a fresh page is split into continuation fragments.
   const rowHeight=count*13+12,requiredHeight=rowHeight+(index===rows.length-1&&section.total?32:0);
   const freshRowSpace=pageBodyTop-continuationLines.length*17-4-headerHeight-62;
   if(requiredHeight<=freshRowSpace&&y-requiredHeight<62)continuation();
   else if(rowHeight<=freshRowSpace&&y-rowHeight<62)continuation();
   while(offset<count){
    if(y-25<62)continuation();
    const fit=Math.max(1,Math.floor((y-62-12)/13)),take=Math.min(count-offset,fit),h=take*13+12;
    if(index%2===0)rect(36,y,523,h,'0.97 0.97 0.97');
    let x=36;cells.forEach((cell,i)=>{cell.slice(offset,offset+take).forEach((t,j)=>text(t,x+7,y-15-j*13,9));x+=widths[i];});y-=h;line(36,y,523,'0.88 0.88 0.88');offset+=take;
   }
  });
  if(section.total){const totalLines=wrapText(section.total,507,10),height=totalLines.length*14+13;room(height+5);rect(36,y,523,height,'0.96 0.93 0.86');totalLines.forEach((t,i)=>text(t,44,y-18-i*14,10,BLACK,true));y-=height;}y-=24;
 }
 pages.push(commands.join('\n'));
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'],kids=[];
 pages.forEach((stream,i)=>{
  stream+=`\n${GOLD} RG 0.5 w 36 46 m 559 46 l S\nBT /F1 8 Tf ${GRAY} rg 1 0 0 1 36 30 Tm (OURO CERTO | Relatório financeiro) Tj ET\nBT /F1 8 Tf ${GRAY} rg 1 0 0 1 480 30 Tm (Página ${i+1} de ${pages.length}) Tj ET`;
  const p=objects.length,c=p+1;kids.push(`${p} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${c} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
 });
 objects[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
 let result='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=result.length;result+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=result.length;result+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return Uint8Array.from(result,c=>c.charCodeAt(0)&255);
}
export function downloadPDF(title,report){
 const url=URL.createObjectURL(new Blob([buildPDF(title,report)],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download='Ouro_Certo_V13_'+title.replace(/[^\wÀ-ÿ -]/g,'')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
