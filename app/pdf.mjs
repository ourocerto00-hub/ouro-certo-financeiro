// A small, dependency-free, paginated PDF writer using the built-in Helvetica font.
export function downloadPDF(title,lines){
 const clean=s=>String(s).replace(/[—–•]/g,'-').replace(/[^\x20-\xFF]/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 const wrapped=lines.flatMap(s=>{const a=[];let t=String(s);while(t.length>100){let at=t.lastIndexOf(' ',100);if(at<20)at=100;a.push(t.slice(0,at));t=t.slice(at).trim();}a.push(t);return a;});
 const chunks=[];for(let i=0;i<wrapped.length||i===0;i+=43)chunks.push(wrapped.slice(i,i+43));
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
 const kids=[];
 chunks.forEach((chunk,i)=>{const p=objects.length,c=p+1;kids.push(p+' 0 R');objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${c} 0 R >>`);const stream=`BT /F1 19 Tf 42 791 Td (${clean('OURO | '+title)}) Tj /F1 10 Tf 0 -34 Td 16 TL ${chunk.map(l=>`(${clean(l)}) Tj T*`).join('\n')} ET BT /F1 9 Tf 42 30 Td (${i+1} / ${chunks.length}) Tj ET`;objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);});
 objects[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
 let result='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=result.length;result+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const start=result.length;result+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 const blob=new Blob([Uint8Array.from(result,c=>c.charCodeAt(0)&255)],{type:'application/pdf'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=title.replace(/[^\wÀ-ÿ -]/g,'')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
