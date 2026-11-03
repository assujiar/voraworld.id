/** Public examples only: never imports live records, signatures, trust tokens or mail code. */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { documentSamples, sampleNotice } from '../src/content/document-samples'

async function main(){
  await mkdir('public/samples',{recursive:true})
  for(const locale of ['en','id'] as const)for(const sample of documentSamples){
    const pdf=await PDFDocument.create(),page=pdf.addPage([595.28,841.89])
    pdf.registerFontkit(fontkit)
    const regular=await pdf.embedFont(await readFile('public/static/fonts/archivo-regular.ttf'),{subset:true})
    const bold=await pdf.embedFont(await readFile('public/static/fonts/archivo-semibold.ttf'),{subset:true})
    const ink=rgb(.063,.09,.125),red=rgb(.68,.22,.18),gray=rgb(.33,.38,.40)
    const text=(s:string,x:number,y:number,size=10,color=ink,strong=false)=>page.drawText(s,{x,y,size,color,font:strong?bold:regular})
    const wrap=(s:string,width:number,size:number,strong=false)=>{const font=strong?bold:regular,lines:string[]=[];let line='';for(const word of s.split(/\s+/)){const candidate=line?line+' '+word:word;if(font.widthOfTextAtSize(candidate,size)>width&&line){lines.push(line);line=word}else line=candidate}if(line)lines.push(line);return lines}
    pdf.setTitle(`${locale==='en'?'SAMPLE':'CONTOH'} - ${sample[locale].title}`)
    pdf.setAuthor('VORA');pdf.setSubject(sampleNotice[locale]);pdf.setCreationDate(new Date('2026-01-01T00:00:00Z'));pdf.setModificationDate(new Date('2026-01-01T00:00:00Z'))
    page.drawRectangle({x:0,y:739,width:596,height:103,color:ink})
    const logo=await pdf.embedPng(await readFile('public/static/assets/vora-reverse.png'))
    page.drawImage(logo,{x:42,y:773,width:142,height:142*logo.height/logo.width})
    text('FREIGHT & LOGISTICS',43,759,8,rgb(.85,.87,.89))
    text(locale==='en'?'SAMPLE DOCUMENT':'CONTOH DOKUMEN',350,789,10,rgb(1,.79,.75),true)
    text(sample[locale].title,42,700,23,ink,true)
    let y=669
    for(const line of wrap(sample[locale].purpose,505,10.5)){text(line,42,y,10.5,gray);y-=16}
    y-=22
    page.drawText(locale==='en'?'SAMPLE':'CONTOH',{x:110,y:290,size:70,font:bold,color:gray,opacity:.075,rotate:degrees(35)})
    for(const [heading,body] of sample[locale].sections){
      page.drawLine({start:{x:42,y:y+8},end:{x:553,y:y+8},thickness:.6,color:rgb(.83,.85,.83)})
      text(heading,42,y-9,10.5,red,true);y-=30
      for(const line of wrap(body,505,10)){text(line,42,y,10,gray);y-=15}
      y-=24
    }
    if(y<110)throw Error(`Sample overflows: ${sample.key}/${locale}, y=${y}`)
    page.drawRectangle({x:42,y:51,width:511,height:54,color:rgb(.95,.94,.91)})
    for(const [i,line] of wrap(sampleNotice[locale],480,9,true).entries())text(line,55,83-i*14,9,red,true)
    text(locale==='en'?'Reference example - no commercial or delivery status.':'Contoh rujukan - tanpa status komersial atau pengantaran.',42,31,8,gray)
    text('1 / 1',533,31,8,gray)
    await writeFile(`public/samples/${sample.key}-${locale}.pdf`,await pdf.save())
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
