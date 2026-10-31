const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./read-B6UolWEr.js","./jszip.min-CIfjWNhB.js","./index-BhuFcrYD.js","./index-Cv0Zik2D.css","./setup-Ptbp7UAi.js","./model-Dd_qmVyc.js","./model-DKkUpSKi.css","./qr-DMsnu8Tf.js","./setup-FRyVZR5Y.css","./write-B1YsuFR8.js","./sheet-D6P9QUtY.js","./table-D5Hkgf6S.js","./csv-CmkhPz-z.js","./xlsx-C9AIIeBO.js","./chartdata-CTdZY3ya.js"])))=>i.map(i=>d[i]);
import{t as n,a as S,L as si,j as e,R as li,I as Ce,B as k,G as A,D as R,M as I,C as Pn,c as je,N as Ge,g as X,d as Ze,u as ci,_ as ke,e as ui}from"./index-BhuFcrYD.js";import{i as me,s as Ae,m as Qt,l as Zt,a as mr,f as ln,b as Xt,c as cn,d as un,u as re,B as di,e as pt,N as mi,n as pi,C as fi,g as In,h as hi,j as gi,P as bi,R as xi,k as yi,o as vi,p as Ci,q as $n,r as On,t as qn,v as ji,S as ki,w as wi,x as Si,y as Ke,z as en,A as pr,D as Fi,E as Ai,F as fr,G as tn,H as Ni,I as Vt,J as _t,K as Ei,L as Ti,M as Mi,O as Bn,Q as Li,T as Jt,U as ft,V as Di,W as zn,X as Vn,Y as Ri,Z as Ht,_ as _n,$ as Pi,a0 as Ii,a1 as $i,a2 as Oi,a3 as qi,a4 as Bi,a5 as Jn,a6 as zi,a7 as Vi,a8 as We,a9 as Hn,aa as _i,ab as Ji}from"./setup-Ptbp7UAi.js";import{l as hr,i as gr,t as se,k as Hi,n as Ui}from"./live-CzD5c3vl.js";import{m as nn,w as Un,C as Wi,u as Gi,a as Ki,F as Yi}from"./Copilot-D2U3JlaS.js";import{d as dn,F as Qi,i as Ye,p as br,P as ne,c as Zi,a as Ut,b as xr,W as Xi,M as Wn,e as Gn,L as ea,S as ta,f as wt,g as na,u as ra,s as Kn,h as ia}from"./model-Dd_qmVyc.js";import{q as aa}from"./qr-DMsnu8Tf.js";function St(t){const{$from:a}=t.state.selection;for(let o=a.depth;o>0;o--){const i=a.node(o);if(i.type.name==="table")return{node:i,pos:a.before(o)}}return null}function Wt(t,a){let o=null;return t.descendants((i,l)=>o?!1:i.type.name==="table"&&i.attrs.link===a?(o={node:i,pos:l},!1):!0),o}function ve(t){const a=[];let o=!1;return t.forEach((i,l,f)=>{const b=[];i.forEach(c=>{const d=[];c.forEach(m=>d.push(m.textContent));let p=c.type.name==="tableHeader";if(!p){let m=c.textContent.length>0;c.descendants(w=>{w.isText&&!w.marks.some(v=>v.type.name==="bold")&&(m=!1)}),p=m}c.type.name==="tableHeader"&&f===0&&(o=!0),b.push({text:d.join(`
`),...c.attrs.formula?{formula:c.attrs.formula}:{},...p?{bold:!0}:{}});for(let m=c.attrs.colspan??1;m>1;m--)b.push({text:""})}),a.push(b)}),{rows:a,header:o}}function mn(t,a={}){const o=Math.max(1,...t.rows.map(i=>i.length));return{type:"table",attrs:a,content:t.rows.map((i,l)=>({type:"tableRow",content:Array.from({length:o},(f,b)=>{const c=i[b]??{text:""},d=/^[-+(]?[$€£¥]?\s?[\d.,\s  ]+\s?[%$€£¥]?\)?$/.test(c.text.trim())&&/\d/.test(c.text),p=t.header&&l===0,m=c.text.split(`
`);return{type:p?"tableHeader":"tableCell",attrs:c.formula?{formula:c.formula}:{},content:m.map(w=>({type:"paragraph",attrs:d&&!p?{textAlign:"right"}:{},content:w?[{type:"text",text:w,...c.bold&&!p?{marks:[{type:"bold"}]}:{}}]:[]}))}})}))}}function rn(t,a,o){const i=mn(o,{...a.node.attrs}),l=t.schema.nodeFromJSON(i);t.view.dispatch(t.state.tr.replaceWith(a.pos,a.pos+a.node.nodeSize,l))}const oa=["all","quotes","spaces","empty","emptyAll","tabs","trailing","frenchSpaces","dashes","ellipsis","apostrophes","doubleWords","sentenceStart","spaceAfterPunct","hyphens","invisible","emoji","highlights","links","colors","fonts"];function sa(t,a,o){const{state:i}=t,l=i.tr;let f=0;const b=o.startsWith("fr"),[c,d]=b?["« "," »"]:o.startsWith("de")?["„","“"]:o.startsWith("es")||o.startsWith("pt")?["«","»"]:["“","”"],p=v=>{let C=v;const x=y=>a===y||a==="all";return x("spaces")&&(C=C.replace(/ {2,}/g," ").replace(/ +([,.;:!?)])/g,(y,E)=>b&&/[;:!?]/.test(E)?` ${E}`:E)),x("quotes")&&(C=C.replace(/(^|[\s([{])"/g,`$1${c}`).replace(/"/g,d).replace(new RegExp("(\\p{L})'(\\p{L})","gu"),"$1’$2").replace(/(^|[\s([{])'/g,"$1‘").replace(/'/g,"’").replace(/--/g,"–").replace(/\.\.\./g,"…")),a==="tabs"&&(C=C.replace(/\t+/g," ")),a==="trailing"&&(C=C.replace(/^[ \t\u00a0]+|[ \t\u00a0]+$/g,"")),a==="frenchSpaces"&&(C=C.replace(/[ \u00a0]?([;:!?»])/g," $1").replace(/«[ \u00a0]?/g,"« ")),a==="dashes"&&(C=C.replace(/--/g,"–").replace(/ - /g," – ")),a==="ellipsis"&&(C=C.replace(/\.{3}/g,"…")),a==="apostrophes"&&(C=C.replace(new RegExp("(\\p{L})'(\\p{L})","gu"),"$1’$2")),a==="doubleWords"&&(C=C.replace(new RegExp("\\b(\\p{L}+)\\s+\\1\\b","giu"),"$1")),a==="sentenceStart"&&(C=C.replace(new RegExp("([.!?]\\s+)(\\p{Ll})","gu"),(y,E,$)=>E+$.toUpperCase())),a==="spaceAfterPunct"&&(C=C.replace(new RegExp("([,;:!?])(?=\\p{L})","gu"),"$1 ").replace(new RegExp("\\.(?=\\p{Lu}\\p{Ll})","gu"),". ")),a==="hyphens"&&(C=C.replace(new RegExp("(\\p{Ll})- (\\p{Ll})","gu"),"$1$2")),a==="invisible"&&(C=C.replace(/[\u200b-\u200d\ufeff\u00ad]/g,"")),a==="emoji"&&(C=C.replace(new RegExp("\\p{Extended_Pictographic}\\ufe0f?","gu"),"").replace(/ {2,}/g," ")),C},m=i.schema.marks,w=(v,C)=>{i.doc.descendants((x,y)=>{if(x.isText)for(const E of x.marks){if(E.type.name!==v)continue;l.removeMark(y,y+x.nodeSize,E);const $=C==null?void 0:C(E.attrs);$&&Object.values($).some(F=>F!=null)&&l.addMark(y,y+x.nodeSize,E.type.create($)),f++}})};if(a==="highlights"&&m.highlight&&w("highlight"),a==="links"&&m.link&&w("link"),a==="colors"&&w("textStyle",v=>({...v,color:null})),a==="fonts"&&w("textStyle",v=>({...v,fontFamily:null,fontSize:null})),i.doc.descendants((v,C)=>{if(!v.isText||!v.text)return;const x=p(v.text);if(x!==v.text){const y=l.mapping.map(C),E=l.mapping.map(C+v.text.length);l.replaceWith(y,E,i.schema.text(x,v.marks)),f++}}),a==="empty"||a==="all"||a==="emptyAll"){const v=[];let C=!1;i.doc.forEach((x,y)=>{const E=x.type.name==="paragraph"&&x.childCount===0;E&&(C||a==="emptyAll")&&v.push(y),C=E});for(const x of v.reverse()){const y=l.mapping.map(x);l.delete(y,y+2),f++}}return f&&t.view.dispatch(l),f}function la(t,a,o){const{state:i}=t,{from:l,to:f,$from:b}=i.selection;for(let w=b.depth;w>0;w--){const v=b.node(w);if(v.type.name==="bulletList"||v.type.name==="orderedList"){const C=[];v.forEach(y=>C.push(y)),C.sort((y,E)=>y.textContent.localeCompare(E.textContent,o,{numeric:!0})*a);const x=b.before(w);return t.view.dispatch(i.tr.replaceWith(x,x+v.nodeSize,v.type.create(v.attrs,C))),!0}}const c=[];if(i.doc.forEach((w,v)=>{v+w.nodeSize>l&&v<f&&w.isTextblock&&c.push({node:w,pos:v})}),c.length<2)return!1;const d=c[0].pos,p=c[c.length-1].pos+c[c.length-1].node.nodeSize,m=[...c].sort((w,v)=>w.node.textContent.localeCompare(v.node.textContent,o,{numeric:!0})*a).map(w=>w.node);return t.view.dispatch(i.tr.replaceWith(d,p,m)),!0}function ca(t){const{state:a}=t,{from:o,to:i}=a.selection,l=[];if(a.doc.forEach((m,w)=>{w+m.nodeSize>o&&w<i&&m.type.name==="paragraph"&&l.push({node:m,pos:w})}),!l.length)return!1;const f=l.map(m=>m.node.textContent),b=f.some(m=>m.includes("	"))?"	":f.some(m=>m.includes(";"))?";":",",c=f.map(m=>m.split(b).map(w=>({text:w.trim()}))),d=l[0].pos,p=l[l.length-1].pos+l[l.length-1].node.nodeSize;return t.chain().insertContentAt({from:d,to:p},mn({rows:c})).run(),!0}function ua(t){const a=St(t);if(!a)return!1;const i=ve(a.node).rows.map(l=>({type:"paragraph",content:l.some(f=>f.text)?[{type:"text",text:l.map(f=>f.text.replace(/\n/g," ")).join("	")}]:[]}));return t.chain().insertContentAt({from:a.pos,to:a.pos+a.node.nodeSize},i).run(),!0}function da(t,a,o){const i=[];if(t.state.doc.descendants((f,b)=>(f.type.name==="heading"&&f.attrs.level<=3&&f.textContent.trim()&&i.push({level:f.attrs.level,text:f.textContent.trim(),page:a(b+1)}),f.type.name!=="table")),!i.length)return null;const l=56;return[{type:"paragraph",attrs:{styleId:"title"},content:[{type:"text",text:n("letter.toc.title")}]},{type:"table",attrs:{borders:"none"},content:i.map(f=>({type:"tableRow",content:[{type:"tableCell",attrs:{colwidth:[Math.round(o-l)]},content:[{type:"paragraph",attrs:{indentLeft:(f.level-1)*14||null,spaceAfter:2},content:[{type:"text",text:f.text,...f.level===1?{marks:[{type:"bold"}]}:{}}]}]},{type:"tableCell",attrs:{colwidth:[l]},content:[{type:"paragraph",attrs:{textAlign:"right",spaceAfter:2},content:f.page?[{type:"text",text:String(f.page)}]:[]}]}]}))},{type:"paragraph"}]}const Ft={note:{light:"#EAF2FC",dark:"#16263A",line:"#4472C4",icon:"ℹ"},tip:{light:"#EAF7F1",dark:"#14302A",line:"#2E9E6A",icon:"✦"},warning:{light:"#FFF4E5",dark:"#3A2A12",line:"#E08A1E",icon:"⚠"},success:{light:"#EDF7E7",dark:"#1F3318",line:"#5A9E2E",icon:"✓"},gold:{light:"#FBF3DD",dark:"#2A2312",line:"#D4A843",icon:"★"},danger:{light:"#FDECEC",dark:"#3A1616",line:"#C62828",icon:"⛔"},important:{light:"#F3ECFB",dark:"#2A1C3A",line:"#7B3FC4",icon:"❗"},question:{light:"#E8F6F8",dark:"#132E33",line:"#1F8A9E",icon:"?"},idea:{light:"#FFF9DB",dark:"#33300F",line:"#C9A400",icon:"💡"},example:{light:"#EEF1F4",dark:"#1D232A",line:"#5B6B7C",icon:"✎"},definition:{light:"#ECEEFB",dark:"#1B1F3A",line:"#3F51B5",icon:"📖"},quote:{light:"#F4F4F4",dark:"#242424",line:"#8C8C8C",icon:"❝"},todo:{light:"#E9F1FF",dark:"#15223A",line:"#2962FF",icon:"☐"},summary:{light:"#EFF4EF",dark:"#1C261C",line:"#4F7A4F",icon:"Σ"},objective:{light:"#FFEFE8",dark:"#3A2016",line:"#E0561E",icon:"◎"},deadline:{light:"#FCEAF0",dark:"#3A1624",line:"#B0174A",icon:"⏰"},contact:{light:"#E6F7FB",dark:"#12303A",line:"#0097A7",icon:"☎"},security:{light:"#F7E9E9",dark:"#331616",line:"#8E1B1B",icon:"🔒"},legal:{light:"#F5EFE8",dark:"#2E241A",line:"#7A5230",icon:"⚖"},nota:{light:"#F1F3E6",dark:"#262A16",line:"#6B7A1E",icon:"✱"}},ma=Object.keys(Ft);function pa(t,a){const o=Ft[t];return{type:"paragraph",attrs:{background:a?o.dark:o.light,borders:{left:{w:4.5,color:o.line,space:10},top:{w:.5,color:a?o.dark:o.light,space:6},bottom:{w:.5,color:a?o.dark:o.light,space:6},right:{w:.5,color:a?o.dark:o.light,space:10}},spaceBefore:6,spaceAfter:10},content:[{type:"text",marks:[{type:"bold"},{type:"textStyle",attrs:{color:o.line}}],text:`${o.icon} ${n(`letter.callout.${t}`)}: `}]}}function fa(t,a){const o=(f,b)=>f.split(`
`).map(c=>({type:"paragraph",attrs:{spaceAfter:0,...b?{textAlign:b}:{}},content:c?[{type:"text",text:c}]:[]})),i=new Date().toLocaleDateString(a||void 0,{dateStyle:"long"}),l=[{type:"paragraph"},...o(n("letter.tpl.closing")),{type:"paragraph"},{type:"paragraph"},{type:"paragraph",attrs:{borders:{top:{w:.75,color:"#7F7F7F",space:1}},indentRight:260,spaceAfter:0},content:[{type:"text",text:n("letter.tpl.signature")}]}];return t==="closing"?l:[...o(n("letter.tpl.sender")),{type:"paragraph"},...o(i,"right"),{type:"paragraph"},...o(n("letter.tpl.recipient")),{type:"paragraph"},{type:"paragraph",content:[{type:"text",marks:[{type:"bold"}],text:n("letter.tpl.subject")}]},{type:"paragraph"},{type:"paragraph",content:[{type:"text",text:n("letter.tpl.greeting")}]},{type:"paragraph",content:[{type:"text",text:n("letter.tpl.body")}]},...l]}function yr(t){var i;const a=((i=t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu))==null?void 0:i.length)??0,o=Math.max(a?1:0,t.split(/[.!?…]+(\s|$)/).filter(l=>new RegExp("\\p{L}","u").test(l)).length);return{words:a,sentences:o,perSentence:o?Math.round(a/o*10)/10:0,readMinutes:Math.max(a?1:0,Math.round(a/238)),speakMinutes:Math.max(a?1:0,Math.round(a/150))}}const an={grid:{head:null,band:null,borders:null},gold:{head:"#E9CF8A",band:"#FBF3DD",borders:null},blue:{head:"#BDD7EE",band:"#EAF2FA",borders:null},green:{head:"#C6E0B4",band:"#EDF6E8",borders:null},rose:{head:"#F4C7C3",band:"#FCEDEB",borders:null},gray:{head:"#D9D9D9",band:"#F2F2F2",borders:null},clean:{head:"#F2F2F2",band:null,borders:"none"}};function ha(t,a){const o=St(t);if(!o)return!1;const i=an[a],l=t.state.tr;return l.setNodeMarkup(o.pos,void 0,{...o.node.attrs,borders:i.borders}),o.node.forEach((f,b,c)=>{f.forEach((d,p)=>{const m=o.pos+1+b+1+p,w=c===0?i.head:c%2===0?i.band:null;l.setNodeMarkup(m,void 0,{...d.attrs,background:w})})}),t.view.dispatch(l),!0}function ye(t){const a=new Map;return t.state.doc.descendants((o,i)=>o.type.name==="table"?(gr(o.attrs.link)&&a.set(o.attrs.link,{node:o,pos:i}),!1):!0),a}function we(t,a,o){const i=ye(t).get(a);if(!i)return;const l=t.view.nodeDOM(i.pos),f=(l==null?void 0:l.tagName)==="TABLE"?l:l==null?void 0:l.querySelector("table");f&&(f.dataset.link!==a&&(f.dataset.link=a),f.dataset.live!==o&&(f.dataset.live=o))}function ga(t,a){S.useEffect(()=>{if(!t)return;const o=hr(),i=new Map,l=new Map;let f=0;const b=m=>{i.has(m)||(i.set(m,o.watch(m,w=>{l.set(m,w.table);const v=ye(t).get(m);!v||!w.table||(se(ve(v.node))!==se(w.table)&&rn(t,v,w.table),we(t,m,"synced"))})),o.read(m).then(w=>{l.set(m,w.table);const v=ye(t).get(m);if(v){if(!w.table){o.ensure(m,{kind:"table",title:a,table:ve(v.node)},"letter","letter"),we(t,m,"synced");return}o.addPlace(m,"letter"),se(ve(v.node))!==se(w.table)&&rn(t,v,w.table),we(t,m,"synced")}}))},c=()=>{for(const[m,w]of ye(t)){b(m);const v=ve(w.node),C=l.get(m);if(C&&se(C)===se(v)){we(t,m,"synced");continue}if(!C)continue;we(t,m,"pending");const x=Hi(C,v);l.set(m,x),o.write(m,{kind:"table",title:a,table:x}).then(()=>o.read(m)).then(y=>{var E;return we(t,m,se(y.table)===se(ve(((E=ye(t).get(m))==null?void 0:E.node)??w.node))?"synced":"different")})}},d=()=>{window.clearTimeout(f),f=window.setTimeout(c,250)},p=()=>{for(const m of ye(t).keys()){const w=l.get(m),v=ye(t).get(m);w&&v&&we(t,m,se(w)===se(ve(v.node))?"synced":"pending")}};for(const m of ye(t).keys())b(m);return t.on("update",d),t.on("transaction",p),()=>{t.off("update",d),t.off("transaction",p),window.clearTimeout(f);for(const m of i.values())m()}},[t,a])}const ht="￼";function ba(t,a,o){const i=[];return t.nodesBetween(a,o,(l,f)=>l.isTextblock?(l.textContent.trim()&&i.push({pos:f,node:l}),!1):!0),i}const Yn=t=>t.match(/\s+|[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]/gu)??[];function xa(t,a){const o=Yn(t),i=Yn(a),l=o.length,f=i.length,b=Array.from({length:l+1},()=>new Uint16Array(f+1));for(let C=l-1;C>=0;C--)for(let x=f-1;x>=0;x--)b[C][x]=o[C]===i[x]?b[C+1][x+1]+1:Math.max(b[C+1][x],b[C][x+1]);const c=[];let d=0,p=0,m=0,w=null;const v=()=>{w&&(w.to>w.from||w.text)&&c.push(w),w=null};for(;d<l||p<f;)d<l&&p<f&&o[d]===i[p]?(v(),m+=o[d].length,d++,p++):p<f&&(d===l||b[d][p+1]>=b[d+1][p])?(w??(w={from:m,to:m,text:""}),w.text+=i[p],p++):(w??(w={from:m,to:m,text:""}),m+=o[d].length,w.to=m,d++);return v(),c}const ya={type:"object",properties:{paragraphs:{type:"array",items:{type:"string"}}},required:["paragraphs"],additionalProperties:!1};async function va(t,a,o,i){const l=ba(t.state.doc,o.from,o.to);if(!l.length)return n("ai.letter.nothing");const f=l.map(C=>C.node.textBetween(0,C.node.content.size,void 0,ht)),b=await a.ask({system:"You are a meticulous proofreader inside Office Letter, a word processor. You fix spelling, grammar, agreement, punctuation and typography mistakes in the language each paragraph is written in. You never change the meaning, the tone, the wording that is already correct, names, numbers or the language. Keep every ￼ character exactly where it is: it stands for a picture or a field. Return the same number of paragraphs, in the same order.",messages:[{role:"user",content:`Correct these ${f.length} paragraphs. Return them all, corrected, as JSON.

${JSON.stringify({paragraphs:f})}`}],schema:ya,effort:"low",signal:i});let c;try{c=JSON.parse(b).paragraphs}catch{return n("ai.err.other",{msg:"JSON"})}if(c.length!==f.length)return n("ai.err.other",{msg:`${c.length} / ${f.length}`});const d=t.state.doc,p=[];for(let C=l.length-1;C>=0;C--){const{pos:x}=l[C],y=d.nodeAt(x);if(!(y!=null&&y.isTextblock)||y.textBetween(0,y.content.size,void 0,ht)!==f[C])continue;const E=xa(f[C],c[C]);for(let $=E.length-1;$>=0;$--){const F=E[$];f[C].slice(F.from,F.to).includes(ht)||F.text.includes(ht)||p.push({from:x+1+F.from,to:x+1+F.to,text:F.text})}}const m=p.length;if(!m)return n("ai.letter.noMistakes");const w=me(t);w||Ae(t,!0);const v=t.state.tr;for(const C of p)C.text?v.insertText(C.text,C.from,C.to):v.delete(C.from,C.to);return t.view.dispatch(v),w||Ae(t,!1),m===1?n("ai.letter.oneFix"):n("ai.letter.fixes",{n:m})}const Ca=`Write it in this line markup, one paragraph per line:
"# " heading 1 (titles like MEMORANDUM), "## " heading 2, "! " a bold line (subject line, To/From), "> " a right-aligned line (date),
"- " a bullet, a line with only "---" puts a signature line above the next line, an empty line is an empty paragraph.
Write {date} for today's date. Put every detail you do not know in [square brackets], like [First and last name] or [file number],
so the user can fill it in. No Markdown other than this, no ** or code fences, no comments before or after.`;async function ja(t,a,o,i,l){const f=await a.ask({system:`You write administrative, government, military and personal letters, memos, reports and CVs inside Office Letter. You follow the conventions of the genre (block letter, military memorandum with file number and numbered paragraphs, SITREP, five-paragraph order, CV sections) and the official style of the country the user names, or Canada by default. Write in the language of the request (${i==="fr"?"French":"English"} if unclear). ${Ca}`,messages:[{role:"user",content:o}],signal:l}),b=Qt(f.replace(/^```\w*\n?|```\s*$/g,"").trim(),Zt(i==="fr"?"fr-CA":"en-CA"));mr(t)?t.commands.setContent({type:"doc",content:b}):t.chain().focus().insertContent(b).run();const c=ln(t.state.doc).length;return c&&Xt(t),c?n("ai.letter.docWritten",{n:c}):n("ai.letter.docWrittenDone")}const ka={type:"object",properties:{values:{type:"array",items:{type:"object",properties:{field:{type:"string"},value:{type:"string"}},required:["field","value"],additionalProperties:!1}}},required:["values"],additionalProperties:!1};async function wa(t,a,o,i){const l=cn(t.state.doc).map(p=>p.label);if(!l.length)return n("ai.letter.noFields");const f=await a.ask({system:"You fill in the [bracketed] fields of a letter or CV in Office Letter from the details the user gives. For each field you can answer from the details (or write well from them, for fields that ask for a sentence or a paragraph), return its exact label and the text that replaces it, in the language of the letter. Leave out fields you cannot answer: never invent names, numbers, dates or addresses.",messages:[{role:"user",content:`The letter:
<letter>
${t.getText({blockSeparator:`
`})}
</letter>

Fields: ${JSON.stringify(l)}

Details from the user: ${o}`}],schema:ka,signal:i});let b;try{b=JSON.parse(f).values}catch{return n("ai.err.other",{msg:"JSON"})}const c=un(t,Object.fromEntries(b.filter(p=>l.includes(p.field)).map(p=>[p.field,p.value]))),d=ln(t.state.doc).length;return n("ai.letter.filledN",{n:c,left:d})}function Sa(t,a,o="en"){const i=()=>{const{from:b,to:c,empty:d}=t.state.selection;if(!d){const m=t.state.doc.textBetween(b,c,`

`," ");if(m.trim())return{label:n("ai.letter.selection",{n:Un(m)}),text:m,at:{from:b,to:c,whole:!1}}}const p=t.getText({blockSeparator:`

`});return p.trim()?{label:n("ai.letter.whole",{n:Un(p)}),text:p,at:{from:0,to:t.state.doc.content.size,whole:!0}}:null},l=(b,c,d)=>{const p=c,m=nn(b),w=me(t);d&&!w&&Ae(t,!0);const v=t.chain().focus();p&&!p.whole?v.insertContentAt({from:Math.min(p.from,t.state.doc.content.size),to:Math.min(p.to,t.state.doc.content.size)},m).run():p!=null&&p.whole?v.selectAll().insertContent(m).run():v.insertContent(m).run(),d&&!w&&Ae(t,!1)},f=si.map(b=>({label:b.name,prompt:`Translate the context into ${b.name}. Keep the paragraphs, lists and headings. Reply with only the translation.`}));return{app:"Office Letter",role:`Office Letter is a word processor like Word. The open letter is "${a}". Answers you write as content can be put into the letter with formatting (paragraphs, headings with #, lists, **bold**).`,context:i,actions:[{id:"correct",icon:"spell",label:n("ai.letter.correct"),needsContext:!0,run:(b,c,d)=>va(t,b,c.at,d)},{id:"rewrite",icon:"pen",label:n("ai.letter.rewrite"),needsContext:!0,choices:[{label:n("ai.letter.clearer"),prompt:"Rewrite the context so it is clearer and easier to read. Keep the meaning and the language."},{label:n("ai.letter.formal"),prompt:"Rewrite the context in a more formal, professional tone. Keep the meaning and the language."},{label:n("ai.letter.friendly"),prompt:"Rewrite the context in a warmer, friendlier tone. Keep the meaning and the language."},{label:n("ai.letter.shorter"),prompt:"Rewrite the context about half as long, keeping every important point. Keep the language."},{label:n("ai.letter.longer"),prompt:"Develop the context a little more, with useful detail but no filler. Keep the language."}]},{id:"summary",icon:"outline",label:n("ai.letter.summarize"),needsContext:!0,prompt:"Summarize the context in a few bullet points, in the language of the context."},{id:"translate",icon:"language",label:n("ai.letter.translate"),needsContext:!0,choices:f},{id:"continue",icon:"next",label:n("ai.letter.continue"),needsContext:!0,prompt:"Continue writing after the context with one or two paragraphs in the same voice and language. Reply with only the new paragraphs."},{id:"write",icon:"sparkle",label:n("ai.letter.write"),fill:n("ai.letter.writeFill")},{id:"docWrite",icon:"envelope",label:n("ai.letter.docWrite"),fill:n("ai.letter.docWriteFill"),ask:(b,c,d,p)=>ja(t,b,c,o,p)},{id:"fillAi",icon:"fill",label:n("ai.letter.fillAi"),fill:n("ai.letter.fillAiFill"),ask:(b,c,d,p)=>wa(t,b,c,p)}],applies:[{id:"replace",icon:"replace",label:n("ai.apply.replace"),run:(b,c,d)=>l(c,d,!1)},{id:"track",icon:"track",label:n("ai.apply.track"),run:(b,c,d)=>l(c,d,!0)},{id:"insert",icon:"paste",label:n("ai.apply.insert"),run:(b,c)=>{t.chain().focus().insertContent(nn(c)).run()}}]}}function vr(t){return t.replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a])}function Fa(t){return t.split(/\n{2,}/).map(a=>`<p>${vr(a).replace(/\n/g,"<br>")}</p>`).join("")}function Aa(t){const a=new DOMParser().parseFromString(t,"text/html");return a.querySelectorAll("script, style, iframe, object, embed").forEach(o=>o.remove()),a.body.innerHTML}function Na(t,a,o="",i=null){return`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${vr(t)}</title>
<style>body{margin:0;background:${i??"#fff"}}.doc-text{max-width:46rem;margin:3rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}img{max-width:100%;height:auto}
${o}</style>
</head><body><div class="doc-text">
${a}
</div></body></html>`}const Qn=["sentence","lower","upper","title","toggle","capitalize","noAccents","frenchSpaces","camel","pascal","snake","kebab","constant","dot","alternating","reverse","fullwidth","smallCaps","superscript","trimSpaces"],Ea=Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((t,a)=>[t,"ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ"[a]])),Ta=Object.fromEntries([..."0123456789+-=()abcdefghijklmnoprstuvwxyz"].map((t,a)=>[t,"⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ"[a]])),Ma=t=>t.normalize("NFD").replace(/[̀-ͯ]/g,"").split(/[^\p{L}\p{N}]+/u).filter(Boolean),Ie=(t,a,o)=>{const i=t.match(/^\s*/)[0],l=t.match(/\s*$/)[0];return i+Ma(t).map(o).join(a)+l};function La(t,a,o=!0){const i=f=>f.toLowerCase(),l=f=>f.charAt(0).toUpperCase()+f.slice(1).toLowerCase();switch(a){case"lower":return t.toLowerCase();case"upper":return t.toUpperCase();case"toggle":return[...t].map(f=>f===f.toUpperCase()?f.toLowerCase():f.toUpperCase()).join("");case"title":return t.toLowerCase().replace(new RegExp(`(^|[\\s(“"'-])(\\p{L})`,"gu"),(f,b,c)=>b+c.toUpperCase());case"capitalize":return t.replace(new RegExp(`(^|[\\s(“"'-])(\\p{L})`,"gu"),(f,b,c)=>b+c.toUpperCase());case"noAccents":return t.normalize("NFD").replace(/[̀-ͯ]/g,"").normalize("NFC");case"frenchSpaces":return t.replace(/\s*([;:!?»])/g," $1").replace(/«\s*/g,"« ");case"camel":return Ie(t,"",(f,b)=>b?l(f):i(f));case"pascal":return Ie(t,"",l);case"snake":return Ie(t,"_",i);case"kebab":return Ie(t,"-",i);case"constant":return Ie(t,"_",f=>f.toUpperCase());case"dot":return Ie(t,".",i);case"alternating":{let f=0;return[...t].map(b=>new RegExp("\\p{L}","u").test(b)?f++%2?b.toUpperCase():b.toLowerCase():b).join("")}case"reverse":return[...t].reverse().join("");case"fullwidth":return[...t].map(f=>f>="!"&&f<="~"?String.fromCharCode(f.charCodeAt(0)+65248):f===" "?"　":f).join("");case"smallCaps":return[...t.toLowerCase()].map(f=>Ea[f]??f).join("");case"superscript":return[...t.toLowerCase()].map(f=>Ta[f]??f).join("");case"trimSpaces":return t.replace(/[ \t ]{2,}/g," ");case"sentence":default:{const f=t.toLowerCase().replace(new RegExp("(^|[.!?]\\s+)(\\p{L})","gu"),(b,c,d)=>c+d.toUpperCase());return o?f.replace(new RegExp("\\p{L}","u"),b=>b.toUpperCase()):f}}}function Zn(t,a){const{from:o,to:i}=t.state.selection;if(o===i)return;const l=[];let f=!0;if(t.state.doc.nodesBetween(o,i,(c,d)=>{if(!c.isText||!c.text)return;const p=Math.max(o,d),m=Math.min(i,d+c.text.length),w=c.text.slice(p-d,m-d),v=La(w,a,f);f=!1,v!==w&&l.push({start:p,end:m,text:v,marks:c.marks})}),!l.length)return;const b=t.state.tr;for(const c of l.reverse())b.replaceWith(c.start,c.end,t.state.schema.text(c.text,c.marks));t.view.dispatch(b)}const Da=["keep","text","joinLines","clean","bullets","numbers","table","quote","code","heading","upper","lower","link","aiCorrect","aiTranslateFr","aiTranslateEn","aiSummary","aiFormal","aiPoints","aiTable"],de=t=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),Xn=t=>t.split(/\n{2,}/).map(a=>a.trim()).filter(Boolean),er=t=>t.split(/\r?\n/).map(a=>a.replace(/^\s*(?:[-*•▪◦–]|\d+[.)])\s+/,"").trim()).filter(Boolean);function Ra(t){const a=t.split(/\r?\n/).filter(i=>i.trim()),o=a.some(i=>i.includes("	"))?/\t/:a.every(i=>i.includes(";"))?/;/:a.every(i=>i.includes(","))?/,/:/ {2,}/;return a.map(i=>i.split(o).map(l=>l.trim().replace(/^"(.*)"$/,"$1")))}function Pa(t,a){const o=i=>Xn(i).map(l=>`<p>${de(l).replace(/\n/g,"<br>")}</p>`).join("");switch(t){case"text":return o(a);case"joinLines":return Xn(a.replace(/\r/g,"").replace(new RegExp("(\\p{L})-\\n(\\p{Ll})","gu"),"$1$2")).map(i=>`<p>${de(i.replace(/\s*\n\s*/g," "))}</p>`).join("");case"clean":return o(a.replace(/[ \t ]{2,}/g," ").replace(/ +([,.)])/g,"$1").replace(/^[ \t]+|[ \t]+$/gm,""));case"bullets":return`<ul>${er(a).map(i=>`<li><p>${de(i)}</p></li>`).join("")}</ul>`;case"numbers":return`<ol>${er(a).map(i=>`<li><p>${de(i)}</p></li>`).join("")}</ol>`;case"table":return`<table><tbody>${Ra(a).map(i=>`<tr>${i.map(l=>`<td><p>${de(l)}</p></td>`).join("")}</tr>`).join("")}</tbody></table>`;case"quote":return`<blockquote>${o(a)}</blockquote>`;case"code":return`<pre><code>${de(a)}</code></pre>`;case"heading":return`<h2>${de(a.replace(/\s+/g," ").trim())}</h2>`;case"upper":return o(a.toUpperCase());case"lower":return o(a.toLowerCase());case"link":{const i=a.trim();return/^(https?:\/\/|mailto:|www\.)\S+$/i.test(i)?`<p><a href="${de(i.startsWith("www.")?`https://${i}`:i)}">${de(i)}</a></p>`:o(a)}default:return null}}const Ia={aiCorrect:"Correct the spelling, grammar and punctuation of this text without changing its meaning, tone or language.",aiTranslateFr:"Translate this text into French. Keep the paragraphs and lists.",aiTranslateEn:"Translate this text into English. Keep the paragraphs and lists.",aiSummary:"Summarize this text in one short paragraph, in its language.",aiFormal:"Rewrite this text in a formal, professional tone, in its language, keeping every point.",aiPoints:"Turn this text into a short list of key points (Markdown bullets), in its language.",aiTable:"Organize the information in this text as a Markdown table with clear column headers, in its language."},$a=["full","closing","sender","recipient","date","placeDate","reference","subject","greetingFormal","greetingFriendly","closingFormal","closingCordial","signatureTitle","enclosures","copies","ps","confidential","registered","withoutPrejudice","byEmail"],Oa={full:`[Prénom Nom]
[Adresse]
[Ville, province, code postal]

> [Ville], le {date}

[Nom du destinataire]
[Organisme]
[Adresse du destinataire]

! Objet : [objet]

[Madame, Monsieur],

[Votre texte.]

Veuillez agréer, [Madame, Monsieur], l'expression de mes salutations distinguées.



---
[Prénom Nom]`,closing:`Veuillez agréer, [Madame, Monsieur], l'expression de mes salutations distinguées.



---
[Prénom Nom]`,sender:`[Prénom Nom]
[Adresse]
[Ville, province, code postal]
[Téléphone] · [Courriel]`,recipient:`[Nom du destinataire]
[Fonction]
[Organisme]
[Adresse du destinataire]`,date:"> {date}",placeDate:"> [Ville], le {date}",reference:`V/Réf. : [votre référence]
N/Réf. : [notre référence]`,subject:"! Objet : [objet]",greetingFormal:"[Madame, Monsieur],",greetingFriendly:"[Cher / Chère] [Prénom],",closingFormal:"Je vous prie d'agréer, [Madame, Monsieur], l'assurance de ma considération distinguée.",closingCordial:"Cordialement,",signatureTitle:`


---
[Prénom Nom]
[Fonction]
[Organisme]`,enclosures:`P. j. : [nombre]
- [Document 1]
- [Document 2]`,copies:"c. c. : [Nom, fonction]",ps:"P.-S. : [votre post-scriptum]",confidential:"! CONFIDENTIEL",registered:"! Lettre recommandée avec accusé de réception",withoutPrejudice:"! Sous toutes réserves",byEmail:"! Envoyé par courriel à [adresse]"},qa={full:`[First and last name]
[Address]
[City, province, postal code]

> {date}

[Recipient's name]
[Organization]
[Recipient's address]

! Subject: [subject]

Dear [Mr./Ms. Last name],

[Your text.]

Yours sincerely,



---
[First and last name]`,closing:`Yours sincerely,



---
[First and last name]`,sender:`[First and last name]
[Address]
[City, province, postal code]
[Phone] · [Email]`,recipient:`[Recipient's name]
[Title]
[Organization]
[Recipient's address]`,date:"> {date}",placeDate:"> [City], {date}",reference:`Your ref.: [your reference]
Our ref.: [our reference]`,subject:"! Subject: [subject]",greetingFormal:"Dear [Mr./Ms. Last name],",greetingFriendly:"Hi [First name],",closingFormal:"Yours faithfully,",closingCordial:"Kind regards,",signatureTitle:`


---
[First and last name]
[Title]
[Organization]`,enclosures:`Enclosures: [number]
- [Document 1]
- [Document 2]`,copies:"cc: [Name, title]",ps:"P.S. [your postscript]",confidential:"! CONFIDENTIAL",registered:"! Registered mail, acknowledgement of receipt requested",withoutPrejudice:"! Without prejudice",byEmail:"! Sent by email to [address]"};function Ba(t,a){return(a==="fr"?Oa:qa)[t]}function H(t,a,o,i,l,f={},b=!1){const c=dn(),d={...c};d.normal={...c.normal,...i};for(const[p,m]of["h1","h2","h3","h4","h5","h6"].entries())d[m]={...c[m],...l,size:[18,14,12,11,11,11][p]??11,...f[m]??{}};return d.title={...c.title,...l,size:30,...f.title??{}},d.subtitle={...c.subtitle,...f.subtitle??{}},d.quote={...c.quote,...f.quote??{}},{id:t,name:a,page:o,styles:d,dark:b}}const Qe=[{id:"office",name:"letter.theme.office",page:null,styles:dn()},H("scene","letter.theme.scene","#0E0E13",{font:"DM Sans",color:"#F0EDE6",size:11,lineHeight:1.4,after:9},{font:"Playfair Display",color:"#D4A843",bold:!0,before:18,after:6},{title:{color:"#F2D78B",letterSpacing:-.5,size:32},subtitle:{font:"DM Sans",color:"#C9A961",caps:!0,letterSpacing:2.4,size:10,after:14},h2:{color:"#F2D78B"},h3:{font:"DM Sans",color:"#D4A843",caps:!0,letterSpacing:1.2,size:10.5},quote:{font:"Playfair Display",italic:!0,color:"#C9C3B6",size:13}},!0),H("classic","letter.theme.classic",null,{font:"Georgia",size:11,lineHeight:1.3},{font:"Georgia",color:"#1F3864",bold:!0},{title:{color:"#1F3864",align:"center"},subtitle:{align:"center",italic:!0,color:"#595959"}}),H("modern","letter.theme.modern",null,{font:"Segoe UI",size:10.5,lineHeight:1.35,color:"#262626"},{font:"Segoe UI",color:"#0F7C80",bold:!0},{title:{caps:!0,letterSpacing:3,size:26,color:"#0F7C80"},subtitle:{caps:!0,letterSpacing:1.5,color:"#707070",size:10}}),H("elegant","letter.theme.elegant","#FBF8F1",{font:"Garamond",size:12,lineHeight:1.3,color:"#2B2B2B"},{font:"Garamond",color:"#7A1F3D",bold:!1},{title:{italic:!0,size:34},h1:{italic:!0},subtitle:{italic:!0,color:"#7E6150"}}),H("ocean","letter.theme.ocean","#0B1E33",{font:"Calibri",color:"#E6EEF5",size:11,lineHeight:1.3},{font:"Calibri Light",color:"#5FB8E8"},{title:{color:"#9FD8F5"},subtitle:{color:"#7FA7C8"},quote:{color:"#B9CBDB"}},!0),H("forest","letter.theme.forest","#F4F1E8",{font:"Cambria",size:11,color:"#28302A",lineHeight:1.3},{font:"Cambria",color:"#2E5E3A",bold:!0},{subtitle:{color:"#55674A"}}),H("mono","letter.theme.mono",null,{font:"Consolas",size:10,lineHeight:1.45,color:"#1A1A1A"},{font:"Consolas",color:"#000000",bold:!0},{title:{caps:!0,letterSpacing:2,size:22},subtitle:{color:"#666666"}}),H("corporate","letter.theme.corporate",null,{font:"Calibri",size:11,lineHeight:1.15,color:"#262626"},{font:"Calibri",color:"#1F4E79",bold:!0},{title:{color:"#1F4E79",size:28},subtitle:{color:"#5B9BD5"}}),H("academic","letter.theme.academic",null,{font:"Times New Roman",size:12,lineHeight:2,color:"#000000"},{font:"Times New Roman",color:"#000000",bold:!0},{title:{align:"center",size:16},subtitle:{align:"center",italic:!0,color:"#000000"}}),H("official","letter.theme.official",null,{font:"Arial",size:11,lineHeight:1.2,color:"#333333"},{font:"Arial",color:"#26374A",bold:!0},{title:{color:"#26374A",size:24},subtitle:{color:"#AF3C43",caps:!0,letterSpacing:1,size:10}}),H("military","letter.theme.military","#F7F6F0",{font:"Arial",size:11,lineHeight:1.15,color:"#1F2216"},{font:"Arial",color:"#4B5320",bold:!0},{title:{caps:!0,letterSpacing:2,size:22,color:"#3A4019"},h1:{caps:!0},subtitle:{color:"#6B7A3A",caps:!0,size:10}}),H("sunset","letter.theme.sunset","#FFF8F0",{font:"Georgia",size:11,lineHeight:1.35,color:"#3B2A22"},{font:"Georgia",color:"#C0504D",bold:!0},{title:{color:"#D9733F"},subtitle:{color:"#B07A5A",italic:!0}}),H("lavender","letter.theme.lavender","#F8F5FC",{font:"EB Garamond",size:12,lineHeight:1.35,color:"#2E2638"},{font:"EB Garamond",color:"#6A4C93",bold:!1},{title:{italic:!0,size:32},subtitle:{color:"#9A86B8",italic:!0}}),H("slate","letter.theme.slate",null,{font:"Inter",size:10.5,lineHeight:1.4,color:"#263238"},{font:"Inter",color:"#37474F",bold:!0},{title:{size:28,letterSpacing:-.5},subtitle:{color:"#78909C"}}),H("newspaper","letter.theme.newspaper","#FBFAF6",{font:"Merriweather",size:10.5,lineHeight:1.45,color:"#1A1A1A"},{font:"Playfair Display",color:"#000000",bold:!0},{title:{caps:!0,align:"center",letterSpacing:1,size:34},subtitle:{align:"center",caps:!0,letterSpacing:3,size:9,color:"#555555"}}),H("handwritten","letter.theme.handwritten","#FFFDF7",{font:"Caveat",size:15,lineHeight:1.3,color:"#2B2B4A"},{font:"Dancing Script",color:"#3B3B7A",bold:!0},{title:{size:36},subtitle:{font:"Caveat",color:"#6A6A9A"}}),H("midnight","letter.theme.midnight","#121826",{font:"Inter",color:"#E3E8F2",size:11,lineHeight:1.4},{font:"Inter",color:"#8AB4F8",bold:!0},{title:{color:"#AECBFA"},subtitle:{color:"#8C9BB5"},quote:{color:"#B8C4D9"}},!0),H("emerald","letter.theme.emerald",null,{font:"Montserrat",size:10.5,lineHeight:1.35,color:"#1E2B26"},{font:"Montserrat",color:"#0B6E4F",bold:!0},{title:{caps:!0,letterSpacing:2,size:26},subtitle:{color:"#3E9A7A",caps:!0,size:10}}),H("royal","letter.theme.royal","#FDFBF5",{font:"Lora",size:11.5,lineHeight:1.35,color:"#1C2340"},{font:"Playfair Display",color:"#1B2A6B",bold:!0},{title:{size:34,align:"center"},subtitle:{color:"#B08D2E",align:"center",caps:!0,letterSpacing:2,size:10}})],$e={none:{after:0,lineHeight:1},tight:{after:2,lineHeight:1},compact:{after:4,lineHeight:1},snug:{after:6,lineHeight:1.08},word2003:{after:0,lineHeight:1.15},word2007:{after:10,lineHeight:1.15},normal:{after:8,lineHeight:1.15},report:{after:6,lineHeight:1.2},book:{after:0,lineHeight:1.3},open:{after:10,lineHeight:1.25},comfortable:{after:12,lineHeight:1.3},screen:{after:12,lineHeight:1.4},presentation:{after:14,lineHeight:1.35},relaxed:{after:12,lineHeight:1.5},oneHalf:{after:8,lineHeight:1.5},airy:{after:16,lineHeight:1.5},loose:{after:18,lineHeight:1.6},double:{after:8,lineHeight:2},academic:{after:0,lineHeight:2},triple:{after:8,lineHeight:3}},za=`[Prénom Nom]
[Adresse]
[Ville, province, code postal]
[Téléphone] · [Courriel]`,Va=`[First and last name]
[Address]
[City, province, postal code]
[Phone] · [Email]`,_a=`Veuillez agréer, [Madame, Monsieur], l'expression de mes salutations distinguées.



---
[Prénom Nom]`,Ja=`Yours sincerely,



---
[First and last name]`,jt=`


---
[Prénom Nom]
[Grade]
[Poste]
[Téléphone] · [Courriel]`,kt=`


---
[First and last name]
[Rank]
[Position]
[Phone] · [Email]`,Cr=(t,a,o,i,l,f="{date}")=>`${t}

> ${f}

${a}

! ${o}

${i}

${l}`,K=(t,a,o)=>Cr(za,t,`Objet : ${a}`,o,_a,"[Ville], le {date}"),Y=(t,a,o)=>Cr(Va,t,`Subject: ${a}`,o,Ja),ie=`[Nom du destinataire]
[Fonction]
[Organisme]
[Adresse du destinataire]`,ae=`[Recipient's name]
[Title]
[Organization]
[Recipient's address]`,Se=(t,a,o)=>`# MÉMORANDUM

[Numéro de dossier]
> {date}

! Destinataire : [Destinataire]
! Expéditeur : [Grade Prénom Nom], [Unité]

! OBJET : ${t.toUpperCase()}

Références : ${a}

${o}
${jt}

Distribution : [Liste de distribution]`,Fe=(t,a,o)=>`# MEMORANDUM

[File number]
> {date}

! To: [Addressee]
! From: [Rank First and last name], [Unit]

! SUBJECT: ${t.toUpperCase()}

References: ${a}

${o}
${kt}

Distribution: [Distribution list]`,pn=[{id:"job",cat:"admin",title:{en:"Job application",fr:"Lettre de motivation",es:"Carta de presentación",pt:"Carta de candidatura",de:"Bewerbungsschreiben"},fr:K(ie,"Candidature au poste de [intitulé du poste]",`[Madame, Monsieur],

Votre offre pour le poste de [intitulé du poste], parue sur [source de l'offre], a retenu toute mon attention. Fort(e) de [nombre] années d'expérience en [domaine], je souhaite mettre mes compétences au service de [nom de l'organisme].

Au cours de mon parcours chez [employeur actuel ou précédent], j'ai [réalisation principale, avec un chiffre si possible]. Cette expérience m'a permis de développer [compétence 1], [compétence 2] et [compétence 3], qui correspondent aux exigences du poste.

Je serais heureux(se) de vous exposer mes motivations lors d'un entretien. Vous trouverez ci-joint mon curriculum vitæ.`),en:Y(ae,"Application for the position of [job title]",`Dear [Mr./Ms. Last name],

I am writing to apply for the position of [job title] advertised on [source]. With [number] years of experience in [field], I would welcome the chance to bring my skills to [organization].

At [current or previous employer], I [main achievement, with a figure if possible]. This work strengthened my [skill 1], [skill 2] and [skill 3], which match what the role requires.

I would be glad to discuss how I can contribute to your team. My résumé is attached.`)},{id:"resign",cat:"admin",title:{en:"Resignation",fr:"Démission",es:"Renuncia",pt:"Pedido de demissão",de:"Kündigung"},fr:K(ie,"Démission",`[Madame, Monsieur],

Par la présente, je vous informe de ma décision de démissionner de mon poste de [intitulé du poste], que j'occupe depuis le [date d'embauche].

Conformément à mon contrat, mon préavis de [durée du préavis] débutera à la réception de cette lettre ; mon dernier jour de travail sera donc le [date du dernier jour].

Je tiens à vous remercier pour la confiance que vous m'avez accordée et je m'engage à faciliter la transition de mes dossiers.`),en:Y(ae,"Resignation",`Dear [Mr./Ms. Last name],

Please accept this letter as formal notice of my resignation from my position as [job title], which I have held since [start date].

In line with my contract, my [length of notice] notice period begins today, and my last working day will be [last day].

Thank you for the trust you have placed in me. I will do everything I can to make the handover smooth.`)},{id:"leave",cat:"admin",title:{en:"Leave request",fr:"Demande de congé",es:"Solicitud de permiso",pt:"Pedido de licença",de:"Urlaubsantrag"},fr:K(ie,"Demande de congé du [date de début] au [date de fin]",`[Madame, Monsieur],

Je vous prie de bien vouloir m'accorder un congé [type de congé : annuel, sans solde, parental…] du [date de début] au [date de fin] inclus, soit [nombre] jours ouvrables.

Afin d'assurer la continuité du service, [nom du collègue] a accepté de me remplacer pour [tâches], et mes dossiers en cours seront à jour avant mon départ.

Je reste à votre disposition pour en discuter.`),en:Y(ae,"Leave request from [start date] to [end date]",`Dear [Mr./Ms. Last name],

I would like to request [type of leave: annual, unpaid, parental…] leave from [start date] to [end date] inclusive, that is [number] working days.

To keep things running, [colleague's name] has agreed to cover [tasks], and my current files will be up to date before I leave.

I am happy to discuss this at your convenience.`)},{id:"complaint",cat:"admin",title:{en:"Complaint",fr:"Réclamation",es:"Reclamación",pt:"Reclamação",de:"Beschwerde"},fr:K(ie,"Réclamation – [numéro de client ou de commande]",`[Madame, Monsieur],

Le [date], j'ai [acheté / souscrit / reçu] [produit ou service] (référence [numéro]). Or, [description précise du problème].

Malgré [mes démarches précédentes : appel du…, courriel du…], la situation n'a pas été réglée. Je vous demande donc de [solution attendue : remplacement, remboursement, intervention] dans un délai de [nombre] jours.

Vous trouverez ci-joint une copie de [facture, bon de commande, photos].`),en:Y(ae,"Complaint – [customer or order number]",`Dear Sir or Madam,

On [date], I [bought / subscribed to / received] [product or service] (reference [number]). However, [precise description of the problem].

Despite [previous steps: call on…, email on…], the matter has not been resolved. I therefore ask you to [expected solution: replacement, refund, repair] within [number] days.

Please find attached a copy of [invoice, order, photos].`)},{id:"cancel",cat:"admin",title:{en:"Cancel a contract",fr:"Résiliation de contrat",es:"Rescisión de contrato",pt:"Rescisão de contrato",de:"Vertragskündigung"},fr:K(ie,"Résiliation du contrat n° [numéro de contrat]",`[Madame, Monsieur],

Je vous informe par la présente de ma décision de résilier mon contrat [type de contrat : abonnement, assurance, téléphonie…] n° [numéro de contrat], à compter du [date d'effet].

Je vous remercie de bien vouloir m'envoyer une confirmation écrite de cette résiliation ainsi que le solde de tout compte, et de cesser tout prélèvement après cette date.`),en:Y(ae,"Cancellation of contract no. [contract number]",`Dear Sir or Madam,

I am writing to cancel my [type of contract: subscription, insurance, phone plan…] contract no. [contract number], effective [effective date].

Please send me written confirmation of the cancellation and a final statement, and stop all payments after that date.`)},{id:"certificate",cat:"admin",title:{en:"Request a certificate",fr:"Demande d'attestation",es:"Solicitud de certificado",pt:"Pedido de declaração",de:"Bescheinigung anfordern"},fr:K(ie,"Demande d'attestation [d'emploi / de scolarité / de salaire]",`[Madame, Monsieur],

J'ai l'honneur de vous demander de bien vouloir m'établir une attestation [d'emploi / de scolarité / de salaire] couvrant la période du [date de début] au [date de fin].

Ce document m'est demandé par [organisme] dans le cadre de [motif]. Je vous serais reconnaissant(e) de me le faire parvenir avant le [date limite].`),en:Y(ae,"Request for a certificate of [employment / enrolment / salary]",`Dear [Mr./Ms. Last name],

Could you please issue a certificate of [employment / enrolment / salary] covering the period from [start date] to [end date]?

[Organization] has asked for this document as part of [reason]. I would be grateful to receive it by [deadline].`)},{id:"address",cat:"admin",title:{en:"Change of address",fr:"Changement d'adresse",es:"Cambio de dirección",pt:"Mudança de morada",de:"Adressänderung"},fr:K(ie,"Changement d'adresse – dossier n° [numéro]",`[Madame, Monsieur],

Je vous informe que, depuis le [date du déménagement], ma nouvelle adresse est :

! [Nouvelle adresse complète]

Je vous remercie de mettre à jour mon dossier n° [numéro] et d'envoyer désormais tout courrier à cette adresse.`),en:Y(ae,"Change of address – file no. [number]",`Dear Sir or Madam,

Please note that since [moving date], my new address is:

! [Full new address]

Please update file no. [number] and send all future mail to this address.`)},{id:"refund",cat:"admin",title:{en:"Refund request",fr:"Demande de remboursement",es:"Solicitud de reembolso",pt:"Pedido de reembolso",de:"Rückerstattung"},fr:K(ie,"Demande de remboursement – [référence]",`[Madame, Monsieur],

Le [date], j'ai réglé la somme de [montant] pour [objet du paiement]. [Raison du remboursement : annulation, double paiement, produit défectueux].

Je vous saurais gré de procéder au remboursement de cette somme par [mode de remboursement] dans les meilleurs délais. Vous trouverez ci-joint [justificatif].`),en:Y(ae,"Refund request – [reference]",`Dear Sir or Madam,

On [date], I paid [amount] for [what the payment was for]. [Reason for the refund: cancellation, double payment, faulty product].

Please refund this amount by [refund method] as soon as possible. Proof of payment is attached.`)},{id:"reference",cat:"admin",title:{en:"Letter of recommendation",fr:"Lettre de recommandation",es:"Carta de recomendación",pt:"Carta de recomendação",de:"Empfehlungsschreiben"},fr:K("À qui de droit","Recommandation pour [Prénom Nom du candidat]",`[Madame, Monsieur],

J'ai eu le plaisir de travailler avec [Prénom Nom du candidat] pendant [durée] au sein de [organisme], où il/elle occupait le poste de [poste].

[Prénom du candidat] s'est distingué(e) par [qualité 1] et [qualité 2]. Je retiens notamment [exemple concret de réalisation].

C'est sans réserve que je recommande [Prénom du candidat] pour [poste ou programme visé]. Je reste disponible au [téléphone] pour tout renseignement.`),en:Y("To whom it may concern","Recommendation for [candidate's name]",`Dear Sir or Madam,

I had the pleasure of working with [candidate's name] for [length of time] at [organization], where they served as [position].

[Candidate's first name] stood out for [quality 1] and [quality 2]. One example: [concrete achievement].

I recommend [candidate's first name] without reservation for [position or program]. I am happy to answer any questions at [phone].`)},{id:"proxy",cat:"admin",title:{en:"Power of attorney",fr:"Procuration",es:"Poder",pt:"Procuração",de:"Vollmacht"},fr:`# PROCURATION

Je soussigné(e), [Prénom Nom], né(e) le [date de naissance] à [lieu de naissance], demeurant au [adresse],

donne pouvoir à [Prénom Nom du mandataire], né(e) le [date de naissance du mandataire], demeurant au [adresse du mandataire],

pour [objet précis de la procuration : retirer un colis, signer un document, me représenter à…] en mon nom, le [date] / du [date de début] au [date de fin].

Fait à [Ville], le {date}, pour servir et valoir ce que de droit.



---
Signature du mandant, précédée de « Bon pour pouvoir »



---
Signature du mandataire, précédée de « Bon pour acceptation »`,en:`# POWER OF ATTORNEY

I, the undersigned, [First and last name], born on [date of birth] in [place of birth], residing at [address],

authorize [attorney's name], born on [attorney's date of birth], residing at [attorney's address],

to [precise purpose: collect a parcel, sign a document, represent me at…] on my behalf, on [date] / from [start date] to [end date].

Signed in [City] on {date}.



---
Signature of the person giving authority



---
Signature of the authorized person`},{id:"honour",cat:"admin",title:{en:"Sworn statement",fr:"Attestation sur l'honneur",es:"Declaración jurada",pt:"Declaração sob compromisso de honra",de:"Eidesstattliche Erklärung"},fr:`# ATTESTATION SUR L'HONNEUR

Je soussigné(e), [Prénom Nom], né(e) le [date de naissance] à [lieu de naissance], demeurant au [adresse],

atteste sur l'honneur que [objet de l'attestation, énoncé de façon précise].

Je suis informé(e) qu'une fausse déclaration m'expose à des sanctions prévues par la loi.

Fait à [Ville], le {date}.



---
[Prénom Nom]`,en:`# SWORN STATEMENT

I, the undersigned, [First and last name], born on [date of birth] in [place of birth], residing at [address],

solemnly declare that [what is declared, stated precisely].

I understand that a false statement may expose me to penalties under the law.

Signed in [City] on {date}.



---
[First and last name]`},{id:"notice",cat:"admin",title:{en:"Formal notice",fr:"Mise en demeure",es:"Requerimiento formal",pt:"Notificação formal",de:"Mahnung"},fr:K(ie,"Mise en demeure – [objet du litige]",`[Madame, Monsieur],

Malgré [mes relances du (dates)], vous n'avez pas [obligation non respectée : payer la somme de…, livrer…, effectuer les travaux…], comme convenu le [date de l'accord].

Par la présente, je vous mets en demeure de [action exigée] dans un délai de [nombre] jours à compter de la réception de cette lettre.

À défaut, je me verrai contraint(e) d'engager les recours prévus par la loi, sans autre avis.

Cette lettre vous est envoyée par courrier recommandé.`),en:Y(ae,"Formal notice – [subject of the dispute]",`Dear [Mr./Ms. Last name],

Despite [my reminders of (dates)], you have not [obligation not met: paid the sum of…, delivered…, carried out the work…] as agreed on [date of the agreement].

I hereby formally demand that you [required action] within [number] days of receiving this letter.

Failing that, I will take the legal action available to me without further notice.

This letter is sent by registered mail.`)},{id:"appeal",cat:"admin",title:{en:"Appeal a decision or fine",fr:"Contestation d'une décision ou d'une amende",es:"Recurso contra una decisión o multa",pt:"Contestação de decisão ou multa",de:"Widerspruch gegen Bescheid oder Bußgeld"},fr:K(ie,"Contestation de [la décision / l'avis de contravention] n° [numéro]",`[Madame, Monsieur],

Je conteste [la décision / l'avis] n° [numéro] du [date], qui [résumé de la décision ou de l'infraction reprochée].

En effet, [arguments précis : faits, dates, témoins, erreurs constatées]. Je joins à la présente [pièces justificatives].

Je vous demande donc de bien vouloir [annuler / réexaminer] cette décision.`),en:Y(ae,"Appeal of [decision / ticket] no. [number]",`Dear Sir or Madam,

I am appealing [decision / ticket] no. [number] dated [date], which [summary of the decision or alleged offence].

[Precise arguments: facts, dates, witnesses, errors found]. Supporting documents are attached.

I therefore ask you to [cancel / review] this decision.`)},{id:"meeting",cat:"admin",title:{en:"Request a meeting",fr:"Demande de rendez-vous",es:"Solicitud de cita",pt:"Pedido de reunião",de:"Terminanfrage"},fr:K(ie,"Demande de rendez-vous",`[Madame, Monsieur],

Je souhaiterais vous rencontrer afin d'échanger au sujet de [objet du rendez-vous].

Je suis disponible [disponibilités : jours et heures], en personne ou en visioconférence, pour une durée d'environ [durée].

Je vous remercie par avance de votre réponse.`),en:Y(ae,"Meeting request",`Dear [Mr./Ms. Last name],

I would like to meet with you to discuss [purpose of the meeting].

I am available [availability: days and times], in person or by video call, for about [length].

Thank you in advance for your reply.`)},{id:"civil",cat:"gov",title:{en:"Request an official document",fr:"Demande de document officiel",es:"Solicitud de documento oficial",pt:"Pedido de documento oficial",de:"Amtliche Urkunde anfordern"},fr:K(`[Service de l'état civil / Bureau des passeports]
[Adresse du service]`,"Demande de [acte de naissance / certificat / passeport]",`[Madame, Monsieur],

Je vous prie de bien vouloir me délivrer [nombre] copie(s) de [type de document] au nom de [Prénom Nom], né(e) le [date de naissance] à [lieu de naissance].

Ce document est nécessaire pour [motif]. Vous trouverez ci-joint [pièce d'identité, paiement des frais de (montant), enveloppe-réponse].`),en:Y(`[Vital Statistics / Passport Office]
[Office address]`,"Request for [birth certificate / certificate / passport]",`Dear Sir or Madam,

Please issue [number] copy/copies of [type of document] for [First and last name], born on [date of birth] in [place of birth].

I need this document for [reason]. Enclosed are [ID, payment of the fee of (amount), return envelope].`)},{id:"tax",cat:"gov",title:{en:"Tax agency: payment plan",fr:"Impôts : délai de paiement",es:"Hacienda: plan de pagos",pt:"Finanças: plano de pagamento",de:"Finanzamt: Ratenzahlung"},fr:K(`[Agence du revenu / Centre des impôts]
[Adresse]`,"Demande d'entente de paiement – numéro d'assurance sociale / fiscal [numéro]",`[Madame, Monsieur],

J'ai bien reçu l'avis de cotisation du [date] indiquant un solde de [montant]. En raison de [motif : perte d'emploi, maladie, baisse de revenus], je ne suis pas en mesure de régler cette somme en une seule fois.

Je vous propose de verser [montant] par [mois / quinzaine] à compter du [date], jusqu'au règlement complet. Je joins [justificatifs de revenus et de dépenses].

Je vous remercie de l'attention portée à ma demande.`),en:Y(`[Revenue Agency / Tax Office]
[Address]`,"Payment arrangement request – social insurance / tax number [number]",`Dear Sir or Madam,

I have received the notice of assessment dated [date] showing a balance of [amount]. Because of [reason: job loss, illness, lower income], I cannot pay this amount at once.

I propose to pay [amount] every [month / two weeks] starting [date] until the balance is paid in full. Proof of income and expenses is enclosed.

Thank you for considering my request.`)},{id:"mp",cat:"gov",title:{en:"Letter to an elected official",fr:"Lettre à un élu",es:"Carta a un representante electo",pt:"Carta a um eleito",de:"Brief an Abgeordnete"},fr:K(`[Titre : Monsieur le Député / Madame la Mairesse…]
[Prénom Nom de l'élu]
[Adresse du bureau]`,"[Sujet de la démarche]",`[Monsieur le Député / Madame la Députée],

En tant que citoyen(ne) de votre circonscription de [nom de la circonscription], je souhaite attirer votre attention sur [sujet].

[Exposé de la situation et de son impact, avec un exemple concret.]

Je vous demande de [action souhaitée : intervenir auprès de…, soutenir…, m'accorder un rendez-vous]. Je vous remercie de l'attention que vous porterez à cette lettre.`),en:Y(`[Title: The Honourable / Mayor…]
[Official's name]
[Office address]`,"[Topic]",`Dear [Mr./Ms. Last name],

As a constituent of [riding or district], I am writing to bring [topic] to your attention.

[What the situation is and how it affects people, with a concrete example.]

I ask you to [desired action: raise the matter with…, support…, meet with me]. Thank you for your attention to this letter.`)},{id:"benefit",cat:"gov",title:{en:"Apply for a benefit",fr:"Demande de prestation ou d'aide",es:"Solicitud de prestación",pt:"Pedido de apoio social",de:"Antrag auf Leistungen"},fr:K(`[Ministère / Service concerné]
[Adresse]`,"Demande de [nom de la prestation ou de l'aide]",`[Madame, Monsieur],

Je sollicite le bénéfice de [nom de la prestation] à compter du [date]. Ma situation est la suivante : [situation familiale, revenus, emploi, santé].

Je remplis les conditions d'admissibilité, notamment [condition 1] et [condition 2]. Vous trouverez ci-joint [formulaire rempli et pièces justificatives].

Je reste à votre disposition pour tout complément d'information.`),en:Y(`[Department / Service]
[Address]`,"Application for [name of the benefit]",`Dear Sir or Madam,

I am applying for [name of the benefit] starting [date]. My situation is as follows: [family, income, employment, health].

I meet the eligibility requirements, including [requirement 1] and [requirement 2]. The completed form and supporting documents are enclosed.

Please let me know if you need anything else.`)},{id:"support",cat:"gov",title:{en:"Letter of support (immigration)",fr:"Lettre d'appui (immigration)",es:"Carta de apoyo (inmigración)",pt:"Carta de apoio (imigração)",de:"Unterstützungsschreiben (Einwanderung)"},fr:K(`[Ministère de l'Immigration / Ambassade]
[Adresse]`,"Lettre d'appui – dossier de [Prénom Nom du demandeur], n° [numéro de dossier]",`[Madame, Monsieur],

Je soussigné(e), [Prénom Nom], [citoyen(ne) / résident(e) permanent(e)] du [pays], appuie la demande de [type de demande : résidence permanente, visa, citoyenneté] de [Prénom Nom du demandeur].

Je connais [Prénom du demandeur] depuis [durée] en tant que [lien : ami, employeur, membre de la famille]. [Faits concrets montrant son intégration, son sérieux ou le lien familial.]

Je confirme l'exactitude de ces informations et reste joignable au [téléphone].`),en:Y(`[Immigration Department / Embassy]
[Address]`,"Letter of support – application of [applicant's name], file no. [file number]",`Dear Sir or Madam,

I, [First and last name], a [citizen / permanent resident] of [country], support the [type: permanent residence, visa, citizenship] application of [applicant's name].

I have known [applicant's first name] for [length of time] as their [relationship: friend, employer, relative]. [Concrete facts showing integration, reliability or family ties.]

I confirm that this information is true and can be reached at [phone].`)},{id:"atip",cat:"gov",title:{en:"Access to information request",fr:"Demande d'accès à l'information",es:"Solicitud de acceso a la información",pt:"Pedido de acesso à informação",de:"Antrag auf Akteneinsicht"},fr:K(`[Coordonnateur de l'accès à l'information]
[Organisme public]
[Adresse]`,"Demande d'accès à l'information",`[Madame, Monsieur],

En vertu de [loi applicable sur l'accès à l'information], je demande à obtenir copie des documents suivants : [description précise des documents, période visée].

Je souhaite recevoir ces documents sous forme [électronique / papier] à l'adresse [courriel ou postale]. Je joins [frais de demande, s'il y a lieu].`),en:Y(`[Access to Information Coordinator]
[Public body]
[Address]`,"Access to information request",`Dear Sir or Madam,

Under [applicable access to information act], I request copies of the following records: [precise description of the records and period].

I would like to receive them in [electronic / paper] form at [email or postal address]. [The application fee is enclosed, if any.]`)},{id:"memo",cat:"mil",title:{en:"Memorandum",fr:"Note de service (mémorandum)",es:"Memorándum",pt:"Memorando",de:"Dienstliche Mitteilung"},fr:Se("[Objet]","[A. Référence / aucune]",`1. [Contexte : pourquoi cette note.]

2. [Information ou demande principale.]

3. [Action attendue, responsable et échéance.]`),en:Fe("[Subject]","[A. Reference / none]",`1. [Background: why this memo.]

2. [Main information or request.]

3. [Action required, by whom and by when.]`)},{id:"milLeave",cat:"mil",title:{en:"Leave request (military)",fr:"Demande de congé (militaire)",es:"Solicitud de permiso (militar)",pt:"Pedido de licença (militar)",de:"Urlaubsgesuch (militärisch)"},fr:Se("Demande de congé annuel – [Grade Nom]","A. [Directive sur les congés]",`1. Je demande respectueusement [nombre] jours de congé [annuel / spécial] du [date de début] au [date de fin] inclusivement.

2. Pendant mon absence, je serai joignable au [téléphone] et à l'adresse suivante : [adresse pendant le congé].

3. Mes tâches seront assurées par [Grade Nom du remplaçant], qui a été informé(e) des dossiers en cours.

4. Solde de congés actuel : [nombre] jours.`),en:Fe("Annual leave request – [Rank Name]","A. [Leave policy]",`1. I respectfully request [number] days of [annual / special] leave from [start date] to [end date] inclusive.

2. During my absence I can be reached at [phone] and at the following address: [leave address].

3. My duties will be covered by [Rank Name of replacement], who has been briefed on current files.

4. Current leave balance: [number] days.`)},{id:"posting",cat:"mil",title:{en:"Posting request",fr:"Demande de mutation",es:"Solicitud de traslado",pt:"Pedido de transferência",de:"Versetzungsgesuch"},fr:Se("Demande de mutation – [Grade Nom]","A. [Directive sur les affectations]",`1. Je demande respectueusement à être muté(e) à [unité ou base souhaitée] à compter de la période d'affectation [année].

2. Cette demande est motivée par [motifs : familiaux, professionnels, formation, conjoint militaire].

3. Mon expérience en [domaine] et mes qualifications [qualifications] correspondent aux besoins de [unité souhaitée].

4. Je suis disponible pour une entrevue avec le gestionnaire de carrière à sa convenance.`),en:Fe("Posting request – [Rank Name]","A. [Posting policy]",`1. I respectfully request a posting to [desired unit or base] for the [year] posting season.

2. The request is based on [reasons: family, career, training, military spouse].

3. My experience in [field] and my qualifications [qualifications] match the needs of [desired unit].

4. I am available to meet the career manager at their convenience.`)},{id:"incident",cat:"mil",title:{en:"Incident report",fr:"Rapport d'incident",es:"Informe de incidente",pt:"Relatório de incidente",de:"Vorfallsbericht"},fr:Se("Rapport d'incident – [nature de l'incident]","A. [Ordre permanent applicable]",`1. Date, heure et lieu : [date], [heure], [lieu précis].

2. Personnes impliquées : [grades, noms, unités].

3. Déroulement des faits : [récit chronologique, factuel et précis].

4. Blessures et dommages : [description / aucun].

5. Mesures prises : [premiers soins, sécurisation, autorités avisées et heure].

6. Recommandations : [mesures pour éviter que cela se reproduise].`),en:Fe("Incident report – [type of incident]","A. [Applicable standing order]",`1. Date, time and place: [date], [time], [exact location].

2. Persons involved: [ranks, names, units].

3. Sequence of events: [factual, precise, in order].

4. Injuries and damage: [description / none].

5. Actions taken: [first aid, securing the area, authorities notified and when].

6. Recommendations: [measures to prevent it happening again].`)},{id:"release",cat:"mil",title:{en:"Release / retirement request",fr:"Demande de libération",es:"Solicitud de baja",pt:"Pedido de passagem à reserva",de:"Antrag auf Entlassung"},fr:Se("Demande de libération volontaire – [Grade Nom], [matricule]","A. [Directive sur les libérations]",`1. Je demande respectueusement ma libération volontaire des Forces, avec une date de libération souhaitée au [date].

2. Cette décision fait suite à [motif : retraite, nouvelle carrière, raisons familiales].

3. Je souhaite bénéficier de [congé de fin de service, programme de transition, cours de préparation à la retraite].

4. Je remercie la chaîne de commandement pour le soutien reçu durant mes [nombre] années de service.`),en:Fe("Voluntary release request – [Rank Name], [service number]","A. [Release policy]",`1. I respectfully request a voluntary release from the Forces, with a requested release date of [date].

2. This decision follows [reason: retirement, new career, family reasons].

3. I would like to use [retirement leave, the transition program, the second career assistance course].

4. I thank the chain of command for the support I received over my [number] years of service.`)},{id:"milReference",cat:"mil",title:{en:"Letter of appreciation",fr:"Lettre d'appréciation",es:"Carta de reconocimiento",pt:"Carta de louvor",de:"Anerkennungsschreiben"},fr:Se("Lettre d'appréciation – [Grade Nom]","aucune",`1. Je tiens à souligner le travail remarquable de [Grade Nom] lors de [opération, exercice ou tâche], du [date de début] au [date de fin].

2. [Grade Nom] a [réalisations concrètes : responsabilités, résultats, initiative].

3. Son professionnalisme et son dévouement reflètent les plus hautes traditions de [unité ou Forces]. Je lui adresse mes plus sincères félicitations.`),en:Fe("Letter of appreciation – [Rank Name]","none",`1. I wish to recognize the outstanding work of [Rank Name] during [operation, exercise or task], from [start date] to [end date].

2. [Rank Name] [concrete achievements: responsibilities, results, initiative].

3. Their professionalism and dedication reflect the highest traditions of [unit or Forces]. Please accept my sincere congratulations.`)},{id:"sitrep",cat:"mil",title:{en:"Situation report (SITREP)",fr:"Compte rendu de situation (SITREP)",es:"Informe de situación (SITREP)",pt:"Relatório de situação (SITREP)",de:"Lagebericht (SITREP)"},fr:`# COMPTE RENDU DE SITUATION (SITREP) N° [numéro]

! De : [Grade Nom], [Unité]
! À : [Destinataire]
! Groupe date-heure : [GDH]
! Période couverte : du [GDH de début] au [GDH de fin]

## 1. Situation générale
[Résumé en deux ou trois phrases.]

## 2. Activités amies
[Ce que l'unité a accompli.]

## 3. Activités adverses / environnement
[Observations, menaces, météo, population.]

## 4. Personnel
[Effectif, pertes, blessés, moral.]

## 5. Logistique
[Carburant, munitions, vivres, matériel, besoins.]

## 6. Intentions
[Prochaines actions prévues.]

## 7. Demandes au commandement
[Soutien demandé / aucune.]
${jt}`,en:`# SITUATION REPORT (SITREP) NO. [number]

! From: [Rank Name], [Unit]
! To: [Addressee]
! Date-time group: [DTG]
! Period covered: from [start DTG] to [end DTG]

## 1. General situation
[Two or three sentence summary.]

## 2. Own activities
[What the unit achieved.]

## 3. Enemy activity / environment
[Observations, threats, weather, population.]

## 4. Personnel
[Strength, casualties, morale.]

## 5. Logistics
[Fuel, ammunition, rations, equipment, needs.]

## 6. Intentions
[Next planned actions.]

## 7. Requests to higher
[Support requested / none.]
${kt}`},{id:"order",cat:"mil",title:{en:"Five-paragraph order (SMEAC)",fr:"Ordre en cinq paragraphes (SMEAC)",es:"Orden de cinco párrafos",pt:"Ordem em cinco parágrafos",de:"Befehl in fünf Absätzen"},fr:`# ORDRE D'OPÉRATION [nom de l'opération]

! Groupe date-heure : [GDH] · Référence carte : [carte, échelle]
! Fuseau horaire : [fuseau]

## 1. Situation
a. Forces adverses : [description].
b. Forces amies : [unités voisines, appuis].
c. Rattachements et détachements : [s'il y a lieu].

## 2. Mission
[Qui, quoi, où, quand, pourquoi : une seule phrase.]

## 3. Exécution
a. Intention du commandant : [but, effet final recherché].
b. Concept de l'opération : [phases].
c. Tâches aux sous-unités : [unité : tâche].
d. Instructions de coordination : [horaires, mesures de contrôle].

## 4. Soutien
[Logistique, ravitaillement, soins médicaux, transport.]

## 5. Commandement et transmissions
[Emplacement du commandant, chaîne de commandement, fréquences, mots de passe.]

Accusé de réception : [moyen].
${jt}`,en:`# OPERATION ORDER [operation name]

! Date-time group: [DTG] · Map reference: [map, scale]
! Time zone: [time zone]

## 1. Situation
a. Enemy forces: [description].
b. Friendly forces: [neighbouring units, support].
c. Attachments and detachments: [if any].

## 2. Mission
[Who, what, where, when, why, in one sentence.]

## 3. Execution
a. Commander's intent: [purpose, end state].
b. Concept of operations: [phases].
c. Tasks to sub-units: [unit: task].
d. Coordinating instructions: [timings, control measures].

## 4. Service support
[Logistics, resupply, medical, transport.]

## 5. Command and signal
[Commander's location, chain of command, frequencies, passwords.]

Acknowledge: [means].
${kt}`},{id:"course",cat:"mil",title:{en:"Training / course request",fr:"Demande de cours ou de formation",es:"Solicitud de curso",pt:"Pedido de formação",de:"Lehrgangsantrag"},fr:Se("Demande de cours – [nom du cours], [Grade Nom]","A. [Calendrier des cours / message de sélection]",`1. Je demande respectueusement à être inscrit(e) au cours [nom et numéro du cours] prévu du [date de début] au [date de fin] à [lieu].

2. Ce cours est requis pour [qualification, promotion, poste visé] et contribuera directement à [bénéfice pour l'unité].

3. Je satisfais aux préalables : [préalables]. Mon superviseur, [Grade Nom], appuie cette demande.`),en:Fe("Course request – [course name], [Rank Name]","A. [Course calendar / selection message]",`1. I respectfully request a seat on [course name and number], scheduled from [start date] to [end date] at [location].

2. The course is required for [qualification, promotion, target position] and will directly benefit [the unit, how].

3. I meet the prerequisites: [prerequisites]. My supervisor, [Rank Name], supports this request.`)},{id:"unitThanks",cat:"mil",title:{en:"Unit thank-you letter",fr:"Lettre de remerciement d'unité",es:"Carta de agradecimiento de unidad",pt:"Carta de agradecimento da unidade",de:"Dankschreiben der Einheit"},fr:`[Insigne ou nom de l'unité]
[Adresse de l'unité]

> {date}

[Nom du destinataire]
[Organisme]
[Adresse]

! Objet : Remerciements de [nom de l'unité]

[Madame, Monsieur],

Au nom de tous les membres de [nom de l'unité], je tiens à vous remercier chaleureusement pour [aide, accueil, soutien apporté] lors de [événement ou opération].

Votre contribution a permis de [résultat concret]. Elle témoigne du lien précieux qui unit [la communauté / votre organisme] et nos militaires.

Veuillez agréer, [Madame, Monsieur], l'expression de ma haute considération.
${jt}`,en:`[Unit badge or name]
[Unit address]

> {date}

[Recipient's name]
[Organization]
[Address]

! Subject: Thank you from [unit name]

Dear [Mr./Ms. Last name],

On behalf of every member of [unit name], I want to thank you warmly for [help, welcome, support] during [event or operation].

Your contribution made it possible to [concrete result]. It shows the strong bond between [the community / your organization] and our soldiers.

Yours sincerely,
${kt}`},{id:"thanks",cat:"perso",title:{en:"Thank-you letter",fr:"Lettre de remerciement",es:"Carta de agradecimiento",pt:"Carta de agradecimento",de:"Dankesbrief"},fr:`> [Ville], le {date}

[Cher / Chère] [Prénom],

Je tenais à te remercier du fond du cœur pour [ce que la personne a fait]. [Pourquoi cela a compté pour toi.]

[Un souvenir ou un détail personnel.]

Avec toute ma reconnaissance,

[Prénom]`,en:`> {date}

Dear [First name],

I wanted to thank you from the bottom of my heart for [what they did]. [Why it mattered to you.]

[A memory or personal detail.]

With all my gratitude,

[First name]`},{id:"invite",cat:"perso",title:{en:"Invitation",fr:"Invitation",es:"Invitación",pt:"Convite",de:"Einladung"},fr:`# Vous êtes invité(e) !

[Prénom Nom] a le plaisir de vous inviter à [événement : anniversaire, mariage, fête, cérémonie]

! le [date] à [heure]
! [Lieu, adresse]

[Détails : tenue, repas, activités.]

Merci de confirmer votre présence avant le [date] au [téléphone ou courriel].`,en:`# You're invited!

[First and last name] is delighted to invite you to [event: birthday, wedding, party, ceremony]

! on [date] at [time]
! [Place, address]

[Details: dress code, meal, activities.]

Please RSVP by [date] at [phone or email].`},{id:"condolences",cat:"perso",title:{en:"Condolences",fr:"Condoléances",es:"Condolencias",pt:"Condolências",de:"Beileid"},fr:`> [Ville], le {date}

[Cher / Chère] [Prénom],

C'est avec une profonde tristesse que j'ai appris le décès de [nom du défunt]. Je te présente mes plus sincères condoléances, ainsi qu'à toute ta famille.

[Un souvenir ou une qualité du défunt.]

Je pense très fort à toi. N'hésite pas à faire appel à moi pour [aide concrète].

Avec toute mon affection,

[Prénom]`,en:`> {date}

Dear [First name],

I was deeply saddened to hear of the passing of [name]. Please accept my heartfelt condolences, for you and your whole family.

[A memory or quality of the person.]

You are in my thoughts. Please call on me for [practical help].

With love,

[First name]`},{id:"apology",cat:"perso",title:{en:"Apology",fr:"Excuses",es:"Disculpa",pt:"Pedido de desculpas",de:"Entschuldigung"},fr:`> [Ville], le {date}

[Cher / Chère] [Prénom],

Je te dois des excuses pour [ce qui s'est passé]. Je comprends que cela ait pu te [blesser / décevoir], et je le regrette sincèrement.

[Ce que tu vas faire pour réparer ou éviter que cela se reproduise.]

J'espère que tu pourras me pardonner.

[Prénom]`,en:`> {date}

Dear [First name],

I owe you an apology for [what happened]. I understand it may have [hurt / disappointed] you, and I am truly sorry.

[What you will do to make it right or to avoid it happening again.]

I hope you can forgive me.

[First name]`},{id:"congrats",cat:"perso",title:{en:"Congratulations",fr:"Félicitations",es:"Felicitaciones",pt:"Felicitações",de:"Glückwünsche"},fr:`> [Ville], le {date}

[Cher / Chère] [Prénom],

Toutes mes félicitations pour [réussite : diplôme, promotion, naissance, mariage] ! [Pourquoi c'est mérité.]

Je te souhaite [vœux pour la suite].

Bien amicalement,

[Prénom]`,en:`> {date}

Dear [First name],

Congratulations on [achievement: graduation, promotion, new baby, wedding]! [Why it is well deserved.]

I wish you [wishes for what comes next].

Warmly,

[First name]`}],Ha={fr:t=>`# [Prénom Nom]
~ ${t}
[Ville, province] · [Téléphone] · [Courriel] · [LinkedIn ou site]
`,en:t=>`# [First and last name]
~ ${t}
[City, province] · [Phone] · [Email] · [LinkedIn or website]
`},gt={fr:`! [Poste] · [Employeur], [Ville]
[mois année] – [mois année]
- [Réalisation chiffrée : ce que vous avez fait, et le résultat.]
- [Responsabilité principale.]
- [Outil, méthode ou équipe dirigée.]`,en:`! [Job title] · [Employer], [City]
[month year] – [month year]
- [Measurable achievement: what you did and the result.]
- [Main responsibility.]
- [Tool, method or team you led.]`},bt={profile:{fr:`## Profil
[Deux ou trois phrases : qui vous êtes, ce que vous apportez, le poste visé.]`,en:`## Profile
[Two or three sentences: who you are, what you bring, the job you want.]`},experience:{fr:`## Expérience professionnelle
${gt.fr}

${gt.fr}`,en:`## Work experience
${gt.en}

${gt.en}`},education:{fr:`## Formation
! [Diplôme] · [Établissement], [Ville]
[année] · [Mention, spécialité ou sujet de mémoire]`,en:`## Education
! [Degree or diploma] · [School], [City]
[year] · [Honours, major or thesis]`},skills:{fr:`## Compétences
- [Compétence clé] · [Compétence clé] · [Compétence clé]
- [Logiciels et outils]
- [Qualités : rigueur, leadership, travail d'équipe]`,en:`## Skills
- [Key skill] · [Key skill] · [Key skill]
- [Software and tools]
- [Strengths: rigour, leadership, teamwork]`},languages:{fr:`## Langues
- Français : [niveau]
- Anglais : [niveau]
- [Autre langue] : [niveau]`,en:`## Languages
- English: [level]
- French: [level]
- [Other language]: [level]`},certifications:{fr:`## Certifications
- [Certification] · [Organisme] · [année]
- [Certification] · [Organisme] · [année]`,en:`## Certifications
- [Certification] · [Issuer] · [year]
- [Certification] · [Issuer] · [year]`},volunteer:{fr:`## Bénévolat
! [Rôle] · [Organisme]
[année] – [année] · [Ce que vous y faites.]`,en:`## Volunteering
! [Role] · [Organization]
[year] – [year] · [What you do there.]`},interests:{fr:`## Centres d'intérêt
[Sport, lecture, voyages, associations…]`,en:`## Interests
[Sports, reading, travel, clubs…]`},references:{fr:`## Références
Disponibles sur demande.`,en:`## References
Available on request.`},service:{fr:`## Service militaire
! [Grade] · [Unité / base], [Ville]
[année] – [année] · [Groupe professionnel militaire]
- [Fonction et nombre de personnes sous vos ordres.]
- [Mission ou réalisation, avec un résultat chiffré.]
- [Responsabilité de matériel, de budget ou de sécurité.]`,en:`## Military service
! [Rank] · [Unit / base], [City]
[year] – [year] · [Military occupation]
- [Role and number of people you led.]
- [Mission or achievement, with a measurable result.]
- [Responsibility for equipment, budget or safety.]`},clearance:{fr:`## Cote de sécurité
[Niveau : Fiabilité / Secret / Très secret] · valide jusqu'en [année]`,en:`## Security clearance
[Level: Reliability / Secret / Top Secret] · valid until [year]`},milQuals:{fr:`## Qualifications militaires
- [Cours ou qualification] · [année]
- [Cours de leadership] · [année]
- [Qualification technique ou de tir] · [année]`,en:`## Military qualifications
- [Course or qualification] · [year]
- [Leadership course] · [year]
- [Technical or weapons qualification] · [year]`},awards:{fr:`## Décorations et distinctions
- [Médaille ou mention] · [année]
- [Prix ou reconnaissance] · [année]`,en:`## Honours and awards
- [Medal or commendation] · [year]
- [Award or recognition] · [year]`},deployments:{fr:`## Déploiements et opérations
- [Opération] · [Pays] · [mois année] – [mois année] · [Rôle]
- [Opération ou exercice] · [Lieu] · [année] · [Rôle]`,en:`## Deployments and operations
- [Operation] · [Country] · [month year] – [month year] · [Role]
- [Operation or exercise] · [Place] · [year] · [Role]`},transferable:{fr:`## Compétences transférables
- Leadership : [dirigé une équipe de N personnes, en langage civil].
- Gestion de projet : [planifié et livré quoi, dans quels délais].
- Logistique et ressources : [valeur du matériel ou du budget géré].
- Sécurité et gestion des risques : [procédures appliquées, résultats].`,en:`## Transferable skills
- Leadership: [led a team of N people, in civilian terms].
- Project management: [planned and delivered what, on what timeline].
- Logistics and resources: [value of the equipment or budget managed].
- Safety and risk management: [procedures applied, results].`},merit:{fr:`## Critères de mérite
! [Critère 1, tel qu'écrit dans l'annonce]
[Où, quand et comment vous l'avez démontré : situation, action, résultat.]

! [Critère 2]
[Situation, action, résultat.]`,en:`## Merit criteria
! [Criterion 1, as written in the job poster]
[Where, when and how you showed it: situation, action, result.]

! [Criterion 2]
[Situation, action, result.]`},officialLanguages:{fr:`## Langues officielles
Résultats de l'évaluation de langue seconde : [lecture / écrit / oral, ex. CBC] · [année]`,en:`## Official languages
Second language evaluation results: [reading / writing / oral, e.g. CBC] · [year]`},projects:{fr:`## Projets
! [Nom du projet] · [année]
[Ce que vous avez construit, avec quoi, et pour quel résultat.] [Lien]`,en:`## Projects
! [Project name] · [year]
[What you built, with what, and the result.] [Link]`},publications:{fr:`## Publications et conférences
- [Auteurs]. « [Titre] ». [Revue ou conférence], [année].
- [Auteurs]. « [Titre] ». [Revue ou conférence], [année].`,en:`## Publications and talks
- [Authors]. "[Title]". [Journal or conference], [year].
- [Authors]. "[Title]". [Journal or conference], [year].`},leadership:{fr:`## Leadership
- [Équipe dirigée : taille, budget, portée.]
- [Changement mené et son effet sur l'organisation.]`,en:`## Leadership
- [Team led: size, budget, scope.]
- [Change you led and its effect on the organization.]`},achievements:{fr:`## Réalisations clés
- [Résultat chiffré : +N % de chiffre d'affaires, −N % de coûts…]
- [Résultat chiffré.]
- [Résultat chiffré.]`,en:`## Key achievements
- [Measurable result: +N% revenue, −N% costs…]
- [Measurable result.]
- [Measurable result.]`},portfolio:{fr:`## Portfolio
[Lien vers vos travaux] · [Trois projets marquants en une ligne chacun.]`,en:`## Portfolio
[Link to your work] · [Three standout projects, one line each.]`},licences:{fr:`## Permis et cartes
- Permis de conduire : [classe]
- [Carte de compétence, permis de travail en hauteur, secourisme…] · valide jusqu'en [année]`,en:`## Licences and tickets
- Driver's licence: [class]
- [Trade ticket, working at heights, first aid…] · valid until [year]`},tools:{fr:`## Technologies
- Langages : [langages]
- Outils et plateformes : [outils]
- Méthodes : [Agile, DevOps, ITIL…]`,en:`## Technologies
- Languages: [languages]
- Tools and platforms: [tools]
- Methods: [Agile, DevOps, ITIL…]`}},Ua=[{id:"cvClassic",theme:"classic",title:{en:"Classic CV",fr:"CV classique",es:"CV clásico",pt:"CV clássico",de:"Klassischer Lebenslauf"},headline:{fr:"[Poste visé]",en:"[Target job]"},sections:["profile","experience","education","skills","languages","interests"]},{id:"cvModern",theme:"modern",title:{en:"Modern CV",fr:"CV moderne",es:"CV moderno",pt:"CV moderno",de:"Moderner Lebenslauf"},headline:{fr:"[Poste visé] · [Années] ans d'expérience",en:"[Target job] · [Years] years of experience"},sections:["profile","skills","experience","education","certifications","languages"]},{id:"cvElegant",theme:"elegant",title:{en:"Elegant CV",fr:"CV élégant",es:"CV elegante",pt:"CV elegante",de:"Eleganter Lebenslauf"},headline:{fr:"[Poste visé]",en:"[Target job]"},sections:["profile","experience","education","languages","volunteer","references"]},{id:"cvMinimal",theme:"mono",title:{en:"Minimal CV",fr:"CV minimaliste",es:"CV minimalista",pt:"CV minimalista",de:"Minimalistischer Lebenslauf"},headline:{fr:"[Poste visé]",en:"[Target job]"},sections:["experience","education","skills"]},{id:"cvStudent",theme:"office",title:{en:"Student / first job CV",fr:"CV étudiant / premier emploi",es:"CV estudiante / primer empleo",pt:"CV estudante / primeiro emprego",de:"Lebenslauf Student / Berufseinstieg"},headline:{fr:"Étudiant(e) en [domaine] · à la recherche de [stage / emploi]",en:"[Field] student · looking for [internship / job]"},sections:["profile","education","projects","experience","volunteer","skills","languages"]},{id:"cvExecutive",theme:"classic",title:{en:"Executive CV",fr:"CV cadre / direction",es:"CV directivo",pt:"CV executivo",de:"Lebenslauf Führungskraft"},headline:{fr:"[Directeur / Directrice] · [Secteur]",en:"[Director / Executive] · [Industry]"},sections:["profile","achievements","leadership","experience","education","languages"]},{id:"cvTech",theme:"modern",title:{en:"Technical / IT CV",fr:"CV technique / informatique",es:"CV técnico / informática",pt:"CV técnico / informática",de:"Lebenslauf Technik / IT"},headline:{fr:"[Développeur / Ingénieur] · [Spécialité]",en:"[Developer / Engineer] · [Speciality]"},sections:["profile","tools","experience","projects","certifications","education"]},{id:"cvCareer",theme:"forest",title:{en:"Career change CV",fr:"CV reconversion",es:"CV cambio de carrera",pt:"CV mudança de carreira",de:"Lebenslauf Quereinstieg"},headline:{fr:"De [ancien métier] à [nouveau métier]",en:"From [former job] to [new job]"},sections:["profile","transferable","education","experience","volunteer","skills"]},{id:"cvPublic",theme:"classic",title:{en:"Public service CV",fr:"CV fonction publique",es:"CV función pública",pt:"CV função pública",de:"Lebenslauf öffentlicher Dienst"},headline:{fr:"Candidature : [titre du poste] · processus n° [numéro]",en:"Application: [job title] · process no. [number]"},sections:["profile","merit","experience","education","officialLanguages","clearance"]},{id:"cvBilingual",theme:"office",title:{en:"Bilingual CV (FR/EN)",fr:"CV bilingue (FR/EN)",es:"CV bilingüe (FR/EN)",pt:"CV bilíngue (FR/EN)",de:"Zweisprachiger Lebenslauf (FR/EN)"},headline:{fr:"[Poste visé] · [Target job]",en:"[Target job] · [Poste visé]"},sections:["profile","experience","education","officialLanguages","skills"]},{id:"cvMilNcm",theme:"forest",title:{en:"Military CV (NCM)",fr:"CV militaire (militaire du rang)",es:"CV militar (tropa)",pt:"CV militar (praça)",de:"Lebenslauf Militär (Mannschaft/Unteroffizier)"},headline:{fr:"[Grade] · [Groupe professionnel militaire]",en:"[Rank] · [Military occupation]"},sections:["profile","service","milQuals","deployments","awards","clearance","education"]},{id:"cvMilOfficer",theme:"classic",title:{en:"Military CV (officer)",fr:"CV militaire (officier)",es:"CV militar (oficial)",pt:"CV militar (oficial)",de:"Lebenslauf Militär (Offizier)"},headline:{fr:"[Grade] · [Fonction de commandement ou d'état-major]",en:"[Rank] · [Command or staff role]"},sections:["profile","leadership","service","deployments","milQuals","education","awards","clearance","languages"]},{id:"cvMilToCiv",theme:"modern",title:{en:"Military to civilian CV",fr:"CV transition militaire → civil",es:"CV transición militar → civil",pt:"CV transição militar → civil",de:"Lebenslauf Militär → Zivil"},headline:{fr:"[Poste civil visé] · [N] ans d'expérience en leadership",en:"[Target civilian job] · [N] years of leadership"},sections:["profile","transferable","achievements","service","education","certifications","clearance"]},{id:"cvReservist",theme:"forest",title:{en:"Reservist CV",fr:"CV réserviste",es:"CV reservista",pt:"CV reservista",de:"Lebenslauf Reservist"},headline:{fr:"[Poste civil] · Réserviste, [Grade] à [Unité]",en:"[Civilian job] · Reservist, [Rank] at [Unit]"},sections:["profile","experience","service","milQuals","education","skills"]},{id:"cvVeteran",theme:"classic",title:{en:"Veteran, federal job CV",fr:"CV ancien combattant (poste fédéral)",es:"CV veterano (empleo público)",pt:"CV veterano (emprego público)",de:"Lebenslauf Veteran (Bundesdienst)"},headline:{fr:"Vétéran · Candidature [titre du poste]",en:"Veteran · Application for [job title]"},sections:["profile","merit","service","transferable","officialLanguages","clearance","education"]},{id:"cvSecurity",theme:"modern",title:{en:"Security / police / fire CV",fr:"CV sécurité / police / pompier",es:"CV seguridad / policía / bomberos",pt:"CV segurança / polícia / bombeiros",de:"Lebenslauf Sicherheit / Polizei / Feuerwehr"},headline:{fr:"[Agent / Pompier / Policier]",en:"[Officer / Firefighter / Constable]"},sections:["profile","experience","certifications","licences","clearance","languages","volunteer"]},{id:"cvHealth",theme:"elegant",title:{en:"Healthcare CV",fr:"CV santé / soins",es:"CV salud",pt:"CV saúde",de:"Lebenslauf Gesundheitswesen"},headline:{fr:"[Infirmier(ère) / Préposé(e) / Médecin] · [Spécialité]",en:"[Nurse / Care aide / Physician] · [Speciality]"},sections:["profile","licences","experience","education","certifications","languages"]},{id:"cvTrades",theme:"forest",title:{en:"Skilled trades CV",fr:"CV métiers spécialisés",es:"CV oficios",pt:"CV ofícios",de:"Lebenslauf Handwerk"},headline:{fr:"[Électricien / Mécanicien / Soudeur] · [Sceau rouge / Compagnon]",en:"[Electrician / Mechanic / Welder] · [Red Seal / Journeyperson]"},sections:["profile","licences","experience","skills","education"]},{id:"cvCreative",theme:"scene",title:{en:"Creative CV",fr:"CV créatif",es:"CV creativo",pt:"CV criativo",de:"Kreativer Lebenslauf"},headline:{fr:"[Designer / Artiste / Créateur de contenu]",en:"[Designer / Artist / Content creator]"},sections:["profile","portfolio","projects","experience","skills","education"]},{id:"cvAcademic",theme:"classic",title:{en:"Academic CV",fr:"CV académique / recherche",es:"CV académico",pt:"CV acadêmico",de:"Akademischer Lebenslauf"},headline:{fr:"[Doctorant / Chercheur / Professeur] · [Discipline]",en:"[PhD candidate / Researcher / Professor] · [Discipline]"},sections:["profile","education","publications","experience","awards","languages","references"]}];function tr(t,a){const o=[Ha[a](t.headline[a])];if(t.id==="cvBilingual")for(const i of t.sections)o.push(bt[i].fr.replace(/^## (.*)$/m,(l,f)=>{var b;return`## ${f} · ${((b=bt[i].en.match(/^## (.*)$/m))==null?void 0:b[1])??""}`}),bt[i].en.replace(/^## .*\n/,""));else for(const i of t.sections)o.push(bt[i][a]);return o.join(`

`)}const fn=Ua.map(t=>({id:t.id,cat:"cv",theme:t.theme,title:t.title,fr:tr(t,"fr"),en:tr(t,"en")})),jr="oi1.recentFonts";function on(){try{return JSON.parse(localStorage.getItem(jr)??"[]").slice(0,5)}catch{return[]}}function Wa(t){try{localStorage.setItem(jr,JSON.stringify([t,...on().filter(a=>a!==t)].slice(0,5)))}catch{}}const Ga=["home","insert","design","layout","references","review","view","smart","docs"],nr={normal:"letter.style.normal",title:"letter.style.title",subtitle:"letter.style.subtitle",quote:"letter.style.quote",h1:"letter.heading1",h2:"letter.heading2",h3:"letter.heading3",h4:"letter.style.h4",h5:"letter.style.h5",h6:"letter.style.h6"},Ka=["normal","title","subtitle","h1","h2","h3","h4","quote"],Ya="©®™€£¥¢§¶†‡•·–—…‰′″°±×÷≈≠≤≥∞√∑πΩµ←→↑↓↔✓✗★☆♥♦♣♠«»‹›„“”‘’¿¡".split("");function kr(t){return t.size==="letter"||t.size==="legal"||t.size==="executive"?"in":"cm"}const xt=(t,a)=>Math.round((a==="in"?t/72:t/72*2.54)*100)/100,rr=(t,a)=>a==="in"?t*72:t/2.54*72;function Qa(t){for(let o=1;o<=6;o++)if(t.isActive("heading",{level:o}))return`h${o}`;const a=t.getAttributes("paragraph").styleId;return a&&ta.includes(a)?a:"normal"}function Za(t,a){const o=t.chain().focus();a.startsWith("h")?o.setHeading({level:Number(a.slice(1))}).run():a==="normal"?o.setParagraph().updateAttributes("paragraph",{styleId:null}).run():o.setParagraphStyle(a).run()}const ir=t=>({num:"{page}",page:n("letter.pnPage"),total:n("letter.pageXofY"),slash:"{page} / {pages}",dash:"— {page} —",bracket:"[{page}]"})[t],Xa=[["bottom","center","num"],["bottom","right","num"],["bottom","left","num"],["bottom","center","page"],["bottom","right","page"],["bottom","center","total"],["bottom","right","total"],["bottom","left","total"],["bottom","center","slash"],["bottom","center","dash"],["bottom","right","bracket"],["top","right","num"],["top","center","num"],["top","left","num"],["top","right","page"],["top","right","total"],["top","center","slash"],["top","right","slash"],["here","left","num"],["here","left","total"]],Gt="#D4A843",eo=(()=>{const t=(i,l={})=>({w:.75,color:i,space:1,...l}),a=(i,l={})=>({w:.75,color:i,space:4,...l}),o=i=>({top:i,right:i,bottom:i,left:i});return[["bottom",i=>({bottom:t(i)})],["top",i=>({top:t(i)})],["left",i=>({left:t(i,{w:3,space:6})})],["right",i=>({right:t(i,{w:3,space:6})})],["box",i=>o(a(i))],["topBottom",i=>({top:t(i),bottom:t(i)})],["leftRight",i=>({left:t(i,{space:6}),right:t(i,{space:6})})],["doubleBottom",i=>({bottom:t(i,{style:"double",w:2.25})})],["doubleTopBottom",i=>({top:t(i,{style:"double",w:2.25}),bottom:t(i,{style:"double",w:2.25})})],["doubleBox",i=>o(a(i,{style:"double",w:2.25}))],["thickBottom",i=>({bottom:t(i,{w:2.25})})],["thickBox",i=>o(a(i,{w:2.25}))],["dashedBottom",i=>({bottom:t(i,{style:"dashed"})})],["dashedBox",i=>o(a(i,{style:"dashed"}))],["dottedBottom",i=>({bottom:t(i,{style:"dotted",w:1.5})})],["dottedBox",i=>o(a(i,{style:"dotted",w:1.5}))],["goldBar",()=>({left:t(Gt,{w:4.5,space:8})})],["goldBottom",()=>({bottom:t(Gt,{w:1.5})})],["goldBox",()=>o(a(Gt,{w:1.5,space:6}))],["none",()=>null]]})();function to({editor:t,body:a,styles:o,page:i,setPage:l,lang:f,setLang:b,view:c,setView:d,actions:p,suite:m,proofTools:w}){var Te;const[v,C]=S.useState("home"),x=re({editor:t,selector:({editor:u})=>{const g=u.getAttributes("textStyle"),T={...u.getAttributes("paragraph"),...u.isActive("heading")?u.getAttributes("heading"):{}};return{bold:u.isActive("bold"),italic:u.isActive("italic"),underline:u.isActive("underline"),strike:u.isActive("strike"),sub:u.isActive("subscript"),sup:u.isActive("superscript"),bullets:u.isActive("bulletList"),numbers:u.isActive("orderedList"),bulletStyle:u.getAttributes("bulletList").listStyle??null,numberStyle:u.getAttributes("orderedList").listStyle??null,align:["left","center","right","justify"].find(W=>u.isActive({textAlign:W}))??null,link:u.isActive("link"),inTable:u.isActive("table"),inImage:u.isActive("image"),imageAlt:u.getAttributes("image").alt||"",canUndo:u.can().undo(),canRedo:u.can().redo(),font:g.fontFamily||"",size:g.fontSize||"",color:g.color||null,highlight:u.getAttributes("highlight").color||null,style:Qa(u),lineHeight:T.lineHeight||null,spaceBefore:T.spaceBefore,spaceAfter:T.spaceAfter,indentLeft:T.indentLeft??0,indentRight:T.indentRight??0,background:T.background||null}}}),y=()=>t.chain().focus(),E=(u,g)=>{t.isActive(u)||y()[u==="bulletList"?"toggleBulletList":"toggleOrderedList"]().run();const T=u==="bulletList"?"disc":"decimal";y().updateAttributes(u,{listStyle:g===T?null:g}).run()},$=t===a,F=v==="table"&&!x.inTable||v==="picture"&&!x.inImage?"home":v,Q={...o.normal,...o[x.style]},Ne=(x.font||Q.font||o.normal.font||"Calibri").split(",")[0].replace(/"/g,""),U=x.size?parseFloat(x.size):Q.size??o.normal.size??11,O=kr(i),Oe=[...new Set([...Object.values(o).map(u=>u.font).filter(u=>!!u),Ne])].sort((u,g)=>u.localeCompare(g)),At=[{label:n("letter.fonts.document"),items:Oe},...on().length?[{label:n("letter.fonts.recent"),items:on()}]:[],...Qi.map(u=>({label:n(`letter.fonts.${u.kind}`),items:u.fonts}))],qe=u=>{u>0&&u<1638&&y().setFontSize(`${u}pt`).run()},pe=u=>{const g=u>0?Ut.find(T=>T>U)??U+10:[...Ut].reverse().find(T=>T<U)??Math.max(1,U-1);qe(g)},Nt=()=>y().unsetAllMarks().clearNodes().setParagraph().setParagraphFormat({lineHeight:null,spaceBefore:null,spaceAfter:null,indentLeft:null,indentRight:null,indentFirst:null,background:null,borders:null}).updateAttributes("paragraph",{styleId:null,textAlign:null}).run(),Xe=u=>{if(x.bullets||x.numbers){u>0?y().sinkListItem("listItem").run():y().liftListItem("listItem").run();return}y().setParagraphFormat({indentLeft:Math.max(0,(x.indentLeft||0)+36*u)||null}).run()},fe=o.normal.color??(Ye(i.color)?"#FFFFFF":"#000000"),Et=u=>y().setParagraphFormat({borders:u}).run(),Ee={home:"letter.tab.home",insert:"letter.tab.insert",design:"letter.tab.design",layout:"letter.tab.layout",review:"letter.tab.review",references:"letter.tab.references",view:"letter.tab.view",smart:"letter.tab.smart",docs:"letter.tab.docs",table:"letter.tab.table",picture:"letter.tab.picture"},Tt=(br(i).width-i.margins.left-i.margins.right)*ne,he=u=>y().updateAttributes("image",{width:Math.round(Tt*u),height:null}).run();return e.jsxs("div",{className:"ribbon",children:[e.jsxs("div",{className:"ribbon-tabs",role:"tablist",children:[e.jsx("button",{type:"button",className:"ribbon-file",onClick:p.fileMenu,children:n("letter.tab.file")}),Ga.map(u=>e.jsx("button",{type:"button",role:"tab","aria-selected":F===u,className:F===u?"on":"",onMouseDown:g=>g.preventDefault(),onClick:()=>C(u),children:n(Ee[u])},u)),e.jsxs("button",{type:"button",role:"tab","aria-selected":F==="oi1",className:`ribbon-special${F==="oi1"?" on":""}`,onMouseDown:u=>u.preventDefault(),onClick:()=>C("oi1"),children:[e.jsx("span",{className:"dot"}),"Office In 1"]}),e.jsx(li,{}),x.inTable&&e.jsx("button",{type:"button",role:"tab","aria-selected":F==="table",className:F==="table"?"on":"",onMouseDown:u=>u.preventDefault(),onClick:()=>C("table"),children:n(Ee.table)}),x.inImage&&e.jsx("button",{type:"button",role:"tab","aria-selected":F==="picture",className:F==="picture"?"on":"",onMouseDown:u=>u.preventDefault(),onClick:()=>C("picture"),children:n(Ee.picture)}),e.jsxs("span",{className:"ribbon-quick",children:[e.jsx(Wi,{open:m.copilot,onClick:p.copilot}),e.jsxs("button",{type:"button",className:"cmd-search",onMouseDown:u=>u.preventDefault(),onClick:p.commandSearch,title:`${n("letter.commandSearch")} (Alt+Q)`,children:[e.jsx(Ce,{name:"search"}),e.jsx("span",{children:n("letter.commandSearch")}),e.jsx("kbd",{children:"Alt+Q"})]}),e.jsx(k,{icon:"undo",title:"letter.undo",onClick:()=>y().undo().run(),disabled:!x.canUndo}),e.jsx(k,{icon:"redo",title:"letter.redo",onClick:()=>y().redo().run(),disabled:!x.canRedo})]})]}),e.jsxs("div",{className:"ribbon-panel",role:"tabpanel",children:[F==="home"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.clipboard",children:[e.jsxs("div",{className:"split",children:[e.jsx(k,{big:!0,icon:"paste",title:"letter.paste",onClick:p.paste}),e.jsx(R,{title:"letter.pasteOptions",children:u=>Da.map(g=>e.jsx(I,{label:n(`letter.pasteAs.${g}`),onClick:()=>{u(),p.pasteAs(g)}},g))})]}),e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"cut",title:"letter.cut",onClick:()=>{t.commands.focus(),document.execCommand("cut")}}),e.jsx(k,{icon:"copy",title:"letter.copy",onClick:()=>{t.commands.focus(),document.execCommand("copy")}}),e.jsx(k,{icon:"painter",title:"letter.painter",onClick:p.painter})]})]}),e.jsx(A,{label:"letter.group.font",children:e.jsxs("div",{className:"rows",children:[e.jsxs("div",{className:"row",children:[e.jsx(Pn,{className:"font-box",label:n("letter.font"),value:Ne,groups:At,itemStyle:u=>({fontFamily:Zi(u)}),onPick:u=>{Wa(u),y().setFontFamily(u).run()}}),e.jsx(Pn,{className:"size-box",label:n("letter.fontSize"),value:String(U),numeric:!0,inputMode:"decimal",groups:[{items:Ut.map(String)}],onPick:u=>qe(parseFloat(u.replace(",",".")))}),e.jsx(k,{icon:"grow",title:"letter.grow",onClick:()=>pe(1)}),e.jsx(k,{icon:"shrink",title:"letter.shrink",onClick:()=>pe(-1)}),e.jsx(R,{icon:"case",title:"letter.changeCase",children:u=>Qn.map(g=>e.jsx(I,{label:n(`letter.case.${g}`),onClick:()=>{Zn(t,g),u()}},g))}),e.jsx(k,{icon:"clear",title:"letter.clearFormatting",onClick:Nt})]}),e.jsxs("div",{className:"row",children:[e.jsx(k,{label:"B",title:"letter.bold",onClick:()=>y().toggleBold().run(),active:x.bold,style:{fontWeight:700}}),e.jsx(k,{label:"I",title:"letter.italic",onClick:()=>y().toggleItalic().run(),active:x.italic,style:{fontStyle:"italic",fontFamily:"Georgia, serif"}}),e.jsx(k,{label:"U",title:"letter.underline",onClick:()=>y().toggleUnderline().run(),active:x.underline,style:{textDecoration:"underline"}}),e.jsx(k,{label:"ab",title:"letter.strike",onClick:()=>y().toggleStrike().run(),active:x.strike,style:{textDecoration:"line-through"}}),e.jsx(k,{label:e.jsxs(e.Fragment,{children:["x",e.jsx("sub",{children:"2"})]}),title:"letter.subscript",onClick:()=>y().toggleSubscript().run(),active:x.sub}),e.jsx(k,{label:e.jsxs(e.Fragment,{children:["x",e.jsx("sup",{children:"2"})]}),title:"letter.superscript",onClick:()=>y().toggleSuperscript().run(),active:x.sup}),e.jsx(R,{label:e.jsxs("span",{className:"color-a",children:["A",e.jsx("i",{style:{background:x.color??"currentColor"}})]}),title:"letter.color",children:u=>e.jsx(je,{none:"letter.automatic",value:x.color,onPick:g=>{g?y().setColor(g).run():y().unsetColor().run(),u()}})}),e.jsx(R,{label:e.jsxs("span",{className:"color-a hl",children:["ab",e.jsx("i",{style:{background:x.highlight??"#FFFF00"}})]}),title:"letter.highlight",children:u=>e.jsx(je,{none:"letter.noColor",value:x.highlight,onPick:g=>{g?y().setHighlight({color:g}).run():y().unsetHighlight().run(),u()}})})]})]})}),e.jsx(A,{label:"letter.group.paragraph",children:e.jsxs("div",{className:"rows",children:[e.jsxs("div",{className:"row",children:[e.jsxs("span",{className:"split",children:[e.jsx(k,{icon:"bullets",title:"letter.bullets",onClick:()=>y().toggleBulletList().run(),active:x.bullets}),e.jsx(R,{title:"letter.bulletLibrary",children:u=>e.jsx("div",{className:"list-gallery",children:di.map(g=>e.jsx("button",{type:"button",title:pt[g],"aria-label":pt[g],className:x.bullets&&(x.bulletStyle??"disc")===g?"on":"",onClick:()=>{E("bulletList",g),u()},children:`${pt[g]} ——
${pt[g]} ——`},g))})})]}),e.jsxs("span",{className:"split",children:[e.jsx(k,{icon:"numbers",title:"letter.numbers",onClick:()=>y().toggleOrderedList().run(),active:x.numbers}),e.jsx(R,{title:"letter.numberLibrary",children:u=>e.jsx("div",{className:"list-gallery",children:mi.map(g=>e.jsx("button",{type:"button",className:x.numbers&&(x.numberStyle??"decimal")===g?"on":"",onClick:()=>{E("orderedList",g),u()},children:[1,2].map(T=>`${pi(g,T)} —`).join(`
`)},g))})})]}),e.jsx(k,{icon:"outdent",title:"letter.outdent",onClick:()=>Xe(-1)}),e.jsx(k,{icon:"indent",title:"letter.indent",onClick:()=>Xe(1)}),e.jsx(k,{icon:"marks",title:"letter.showMarks",onClick:()=>d({marks:!c.marks}),active:c.marks})]}),e.jsxs("div",{className:"row",children:[e.jsx(k,{icon:"left",title:"letter.alignLeft",onClick:()=>y().setTextAlign("left").run(),active:x.align==="left"}),e.jsx(k,{icon:"center",title:"letter.alignCenter",onClick:()=>y().setTextAlign("center").run(),active:x.align==="center"}),e.jsx(k,{icon:"right",title:"letter.alignRight",onClick:()=>y().setTextAlign("right").run(),active:x.align==="right"}),e.jsx(k,{icon:"justify",title:"letter.justify",onClick:()=>y().setTextAlign("justify").run(),active:x.align==="justify"}),e.jsx(R,{icon:"spacing",title:"letter.lineSpacing",children:u=>e.jsxs(e.Fragment,{children:[["1.0","1.08","1.15","1.25","1.5","1.75","2.0","2.5","3.0"].map(g=>e.jsx(I,{label:g,active:x.lineHeight!==null&&parseFloat(x.lineHeight)===parseFloat(g),onClick:()=>{y().setParagraphFormat({lineHeight:String(parseFloat(g))}).run(),u()}},g)),e.jsx("hr",{}),[0,6,12,18,24].map(g=>e.jsx(I,{label:n("letter.spaceBeforePt",{n:g}),active:(x.spaceBefore??0)===g,onClick:()=>{y().setParagraphFormat({spaceBefore:g}).run(),u()}},`b${g}`)),e.jsx("hr",{}),[0,4,8,12,18,24].map(g=>e.jsx(I,{label:n("letter.spaceAfterPt",{n:g}),active:x.spaceAfter===g,onClick:()=>{y().setParagraphFormat({spaceAfter:g}).run(),u()}},`a${g}`))]})}),e.jsx(R,{icon:"shading",title:"letter.shading",swatch:x.background,children:u=>e.jsx(je,{none:"letter.noColor",value:x.background,onPick:g=>{y().setParagraphFormat({background:g}).run(),u()}})}),e.jsx(R,{icon:"borders",title:"letter.borders",children:u=>eo.map(([g,T])=>e.jsx(I,{label:n(`letter.border.${g}`),onClick:()=>{Et(T(fe)),u()}},g))})]})]})}),e.jsx(A,{label:"letter.group.styles",children:e.jsx("div",{className:"gallery",role:"listbox","aria-label":n("letter.group.styles"),style:{"--tile-bg":i.color??"#FFFFFF","--tile-ink":o.normal.color??(Ye(i.color)?"#FFFFFF":"#000000")},children:Ka.map(u=>e.jsx("button",{type:"button",role:"option","aria-selected":x.style===u,className:`style-tile${x.style===u?" on":""}`,onMouseDown:g=>g.preventDefault(),onClick:()=>Za(t,u),title:n(nr[u]),children:e.jsx("span",{style:xr({...o.normal,...o[u]},o.normal),children:n(nr[u])})},u))})}),e.jsx(A,{label:"letter.group.editing",children:e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"find",title:"letter.find",text:!0,onClick:()=>p.find(!1)}),e.jsx(k,{icon:"replace",title:"letter.replace",text:!0,onClick:()=>p.find(!0)}),e.jsx(k,{icon:"select",title:"letter.selectAll",text:!0,onClick:()=>y().selectAll().run()})]})}),e.jsx(A,{label:"letter.group.voice",children:e.jsx(k,{big:!0,icon:"mic",title:m.dictating?"letter.dictateStop":"letter.dictate",onClick:p.dictate,active:m.dictating})})]}),F==="insert"&&e.jsxs(e.Fragment,{children:[e.jsx(A,{label:"letter.group.pages",children:e.jsx(k,{big:!0,icon:"pagebreak",title:"letter.pageBreak",onClick:()=>a.chain().focus().setPageBreak().run(),disabled:!$})}),e.jsxs(A,{label:"letter.group.tables",children:[e.jsx(R,{big:!0,icon:"table",title:"letter.table",children:u=>e.jsxs(e.Fragment,{children:[e.jsx(no,{onPick:(g,T)=>{y().insertTable({rows:g,cols:T,withHeaderRow:!1}).run(),u()}}),e.jsx("hr",{}),e.jsx(I,{label:n("letter.textToTable"),onClick:()=>{p.textToTable(),u()}})]})}),e.jsx(ar,{suite:m,actions:p})]}),e.jsx(A,{label:"letter.group.illustrations",children:e.jsx(k,{big:!0,icon:"image",title:"letter.image",onClick:p.image})}),e.jsx(A,{label:"letter.group.links",children:e.jsx(k,{big:!0,icon:"link",title:"letter.link",onClick:p.link,active:x.link})}),e.jsxs(A,{label:"letter.group.blocks",children:[e.jsx(R,{big:!0,icon:"callout",title:"letter.callout",children:u=>ma.map(g=>e.jsx(I,{label:e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"callout-dot",style:{background:Ft[g].line}}),Ft[g].icon," ",n(`letter.callout.${g}`)]}),onClick:()=>{p.callout(g),u()}},g))}),e.jsx(R,{big:!0,icon:"envelope",title:"letter.letterBlock",children:u=>$a.map(g=>e.jsx(I,{label:n(`letter.part.${g}`),onClick:()=>{p.letterPart(g),u()}},g))}),e.jsx(k,{big:!0,icon:"toc",title:"letter.toc",onClick:p.toc,disabled:!$}),e.jsx(k,{big:!0,icon:"qr",title:"letter.qr",onClick:p.qr})]}),e.jsxs(A,{label:"letter.group.headerFooter",children:[e.jsx(k,{big:!0,icon:"header",title:"letter.header",onClick:p.header}),e.jsx(k,{big:!0,icon:"footer",title:"letter.footer",onClick:p.footer}),e.jsx(R,{big:!0,icon:"pagenum",title:"letter.pageNumber",children:u=>Xa.map(([g,T,W])=>e.jsx(I,{label:`${n(`letter.pn.${g}`)} · ${g==="here"?"":`${n(`letter.pn.${T}`)} · `}${ir(W).replace("{page}","1").replace("{pages}","3")}`,onClick:()=>{p.pageNumber(g,ir(W),T),u()}},`${g}-${T}-${W}`))})]}),e.jsxs(A,{label:"letter.group.text",children:[e.jsx(k,{big:!0,icon:"date",title:"letter.date",onClick:()=>y().insertContent(new Date().toLocaleDateString(f||void 0,{dateStyle:"long"})).run()}),e.jsx(k,{big:!0,icon:"hr",title:"letter.horizontalLine",onClick:()=>y().setHorizontalRule().run()})]}),e.jsx(A,{label:"letter.group.symbols",children:e.jsx(R,{big:!0,icon:"symbol",title:"letter.symbol",wide:!0,children:u=>e.jsx("div",{className:"symbols",children:Ya.map(g=>e.jsx("button",{type:"button",onClick:()=>{y().insertContent(g).run(),u()},children:g},g))})})})]}),F==="design"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.themes",children:[e.jsx("div",{className:"theme-gallery",role:"listbox","aria-label":n("letter.group.themes"),"data-gallery":"Themes",children:Qe.map(u=>e.jsx(or,{th:u,on:m.themeId===u.id,onPick:p.theme},u.id))}),e.jsx(R,{icon:"palette",title:"letter.allThemes",wide:!0,children:u=>e.jsx("div",{className:"theme-grid",children:Qe.map(g=>e.jsx(or,{th:g,on:m.themeId===g.id,onPick:T=>{p.theme(T),u()}},g.id))})})]}),e.jsx(A,{label:"letter.group.spacing",children:e.jsx(R,{big:!0,icon:"spacing",title:"letter.paragraphSpacing",children:u=>Object.keys($e).map(g=>e.jsx(I,{label:n(`letter.spacing.${g}`),hint:`${$e[g].lineHeight} · ${$e[g].after} pt`,active:o.normal.after===$e[g].after&&o.normal.lineHeight===$e[g].lineHeight,onClick:()=>{p.spacing(g),u()}},g))})}),e.jsxs(A,{label:"letter.group.pageBackground",children:[e.jsx(R,{big:!0,icon:"pagecolor",title:"letter.pageColor",swatch:i.color,children:u=>e.jsx(je,{none:"letter.noColor",value:i.color,onPick:g=>{l({...i,color:g}),u()}})}),e.jsx(R,{big:!0,icon:"pageborder",title:"letter.pageBorder",swatch:((Te=i.border)==null?void 0:Te.color)??null,children:u=>{var g;return e.jsx(je,{none:"letter.border.none",value:(g=i.border)==null?void 0:g.color,onPick:T=>{l({...i,border:T?{w:1.5,color:T,space:24}:null}),u()}})}}),e.jsx(R,{big:!0,icon:"watermark",title:"letter.watermark",children:u=>{var W;const g=((W=i.watermark)==null?void 0:W.color)??"#C0C0C0",T=G=>{l({...i,watermark:G?{text:G,color:g}:null}),u()};return e.jsxs(e.Fragment,{children:[Xi.map(G=>{var oe;return e.jsx(I,{label:G,active:((oe=i.watermark)==null?void 0:oe.text)===G,onClick:()=>T(G)},G)}),e.jsx("hr",{}),e.jsx(I,{label:n("letter.watermarkCustom"),onClick:()=>{var oe;const G=prompt(n("letter.watermarkPrompt"),((oe=i.watermark)==null?void 0:oe.text)??"");G!==null&&T(G.trim().slice(0,60)||null)}}),e.jsx("span",{className:"kicker",children:n("letter.watermarkColor")}),e.jsx(je,{value:g,onPick:G=>{i.watermark&&G&&l({...i,watermark:{...i.watermark,color:G}}),u()}}),e.jsx("hr",{}),e.jsx(I,{label:n("letter.watermarkRemove"),onClick:()=>T(null)})]})}})]})]}),F==="layout"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.pageSetup",children:[e.jsx(R,{big:!0,icon:"margins",title:"letter.margins",children:u=>e.jsxs(e.Fragment,{children:[Object.keys(Wn).map(g=>{const T=Wn[g],W=["top","right","bottom","left"].every(G=>Math.abs(i.margins[G]-T[G])<.01);return e.jsx(I,{active:W,label:n(`letter.margins.${g}`),hint:`${xt(T.top*72,O)} / ${xt(T.left*72,O)} ${O}`,onClick:()=>{l({...i,margins:{...T}}),u()}},g)}),e.jsx("hr",{}),e.jsx(I,{label:n("letter.margins.custom"),onClick:()=>{p.customMargins(),u()}})]})}),e.jsx(R,{big:!0,icon:"orientation",title:"letter.orientation",children:u=>["portrait","landscape"].map(g=>e.jsx(I,{active:i.orientation===g,label:n(`letter.orientation.${g}`),onClick:()=>{l({...i,orientation:g}),u()}},g))}),e.jsx(R,{big:!0,icon:"size",title:"letter.size",children:u=>Object.keys(Gn).map(g=>{const T=Gn[g],W=O==="in"?`${T.width} × ${T.height} in`:`${(T.width*2.54).toFixed(1)} × ${(T.height*2.54).toFixed(1)} cm`;return e.jsx(I,{active:i.size===g,label:T.name,hint:W,onClick:()=>{l({...i,size:g}),u()}},g)})}),e.jsx(k,{big:!0,icon:"hyphen",title:"letter.hyphenation",active:!!i.hyphenate,onClick:()=>l({...i,hyphenate:!i.hyphenate||void 0})})]}),e.jsxs(A,{label:"letter.group.paragraphLayout",children:[e.jsx(R,{big:!0,icon:"lines",title:"letter.lineNumbers",active:!!i.lineNumbers,children:u=>e.jsxs(e.Fragment,{children:[e.jsx(I,{active:!i.lineNumbers,label:n("letter.lineNumbers.none"),onClick:()=>{l({...i,lineNumbers:null}),u()}}),ea.map(g=>e.jsx(I,{active:i.lineNumbers===g,label:n(`letter.lineNumbers.${g}`),onClick:()=>{l({...i,lineNumbers:g}),u()}},g))]})}),e.jsx(R,{big:!0,icon:"rtl",title:"letter.textDirection",active:!!i.rtl,children:u=>["ltr","rtl"].map(g=>e.jsx(I,{active:!!i.rtl==(g==="rtl"),label:n(`letter.dir.${g}`),onClick:()=>{l({...i,rtl:g==="rtl"||void 0}),u()}},g))})]}),e.jsx(A,{label:"letter.group.indent",children:e.jsxs("div",{className:"stack",children:[e.jsx(Ge,{label:n("letter.indentLeft"),unit:O,step:O==="in"?.1:.25,min:0,value:xt(x.indentLeft||0,O),onChange:u=>y().setParagraphFormat({indentLeft:rr(u,O)||null}).run()}),e.jsx(Ge,{label:n("letter.indentRight"),unit:O,step:O==="in"?.1:.25,min:0,value:xt(x.indentRight||0,O),onChange:u=>y().setParagraphFormat({indentRight:rr(u,O)||null}).run()})]})}),e.jsx(A,{label:"letter.group.spacing",children:e.jsxs("div",{className:"stack",children:[e.jsx(Ge,{label:n("letter.spaceBefore"),unit:"pt",step:6,min:0,value:x.spaceBefore??Q.before??0,onChange:u=>y().setParagraphFormat({spaceBefore:u}).run()}),e.jsx(Ge,{label:n("letter.spaceAfter"),unit:"pt",step:6,min:0,value:x.spaceAfter??Q.after??0,onChange:u=>y().setParagraphFormat({spaceAfter:u}).run()})]})})]}),F==="references"&&e.jsxs(e.Fragment,{children:[e.jsx(A,{label:"letter.group.toc",children:e.jsx(k,{big:!0,icon:"toc",title:"letter.toc",onClick:p.toc,disabled:!$})}),e.jsxs(A,{label:"letter.group.footnotes",children:[e.jsx(k,{big:!0,icon:"footnote",title:"letter.footnoteInsert",onClick:p.footnote,disabled:!$}),e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"pen",title:"letter.footnoteEdit",text:!0,onClick:p.editFootnote,disabled:!m.footnoteHere}),e.jsx(k,{icon:"next",title:"letter.footnoteNext",text:!0,onClick:p.nextFootnote,disabled:!m.footnotes})]})]}),e.jsxs(A,{label:"letter.group.citations",children:[e.jsx(k,{big:!0,icon:"cite",title:"letter.citeInsert",onClick:()=>p.newCitation(!1),disabled:!$}),e.jsxs("div",{className:"stack",children:[e.jsx(R,{icon:"cite",title:"letter.citeStyle",text:!0,label:e.jsx("span",{className:"rb-label",children:In[p.citeStyle].label}),children:u=>fi.map(g=>e.jsx(I,{active:p.citeStyle===g,label:In[g].label,onClick:()=>{p.setCiteStyle(g),u()}},g))}),e.jsx(R,{icon:"next",title:"letter.citeAgain",text:!0,children:u=>{const g=p.citedSources();return g.length?g.map(T=>e.jsx(I,{label:T.title,hint:T.year,onClick:()=>{p.cite(T),u()}},T.id)):e.jsx("p",{className:"muted menu-note",children:n("letter.citeNone")})}}),e.jsx(k,{icon:"sparkle",title:"letter.sourceAi",text:!0,onClick:()=>p.newCitation(!0),disabled:!$})]}),e.jsx(R,{big:!0,icon:"book",title:"letter.bibliography",children:u=>hi.map(g=>e.jsx(I,{label:n(`letter.bib.${g}`),onClick:()=>{p.bibliography(n(`letter.bib.${g}`)),u()}},g))})]}),e.jsxs(A,{label:"letter.group.captions",children:[e.jsx(R,{big:!0,icon:"caption",title:"letter.captionInsert",children:u=>e.jsx("div",{className:"menu-columns",children:gi.map(g=>e.jsx(I,{label:n(`letter.caption.${g}`),onClick:()=>{u(),p.caption(g)}},g))})}),e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"toc",title:"letter.tof",text:!0,onClick:p.tableOfFigures,disabled:!$}),e.jsx(R,{icon:"crossref",title:"letter.crossRef",text:!0,children:u=>{const g=p.refTargets();return g.length?e.jsx(ro,{targets:g,onPick:(T,W)=>{p.crossRef(T,W),u()}}):e.jsx("p",{className:"muted menu-note",children:n("letter.crossRefNone")})}})]})]}),e.jsxs(A,{label:"letter.group.index",children:[e.jsx(k,{big:!0,icon:"index",title:"letter.indexMark",onClick:p.markIndex,disabled:!$}),e.jsx(k,{big:!0,icon:"book",title:"letter.indexInsert",onClick:p.insertIndex,disabled:!$})]})]}),F==="review"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.comments",children:[e.jsx(k,{big:!0,icon:"commentnew",title:"letter.commentNew",onClick:p.newComment,disabled:!$}),e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"trash",title:"letter.commentDelete",text:!0,onClick:p.deleteComment,disabled:!m.commentHere}),e.jsx(k,{icon:"prev",title:"letter.previous",text:!0,onClick:()=>p.comment(-1)}),e.jsx(k,{icon:"next",title:"letter.next",text:!0,onClick:()=>p.comment(1)})]}),e.jsx(k,{big:!0,icon:"comment",title:"letter.commentsShow",onClick:p.toggleComments,active:m.commentsOpen})]}),e.jsxs(A,{label:"letter.group.tracking",children:[e.jsx(k,{big:!0,icon:"track",title:"letter.track",onClick:p.track,active:m.tracking}),e.jsx(k,{big:!0,icon:"markup",title:"letter.markupShow",onClick:p.markup,active:m.markup})]}),e.jsxs(A,{label:"letter.group.changes",children:[e.jsxs("span",{className:"split",children:[e.jsx(k,{big:!0,icon:"accept",title:"letter.accept",onClick:()=>p.accept(!1),disabled:!m.changes}),e.jsx(R,{title:"letter.acceptOptions",disabled:!m.changes,children:u=>e.jsxs(e.Fragment,{children:[e.jsx(I,{label:n("letter.acceptNext"),onClick:()=>{u(),p.accept(!1)}}),e.jsx(I,{label:n("letter.acceptAll"),onClick:()=>{u(),p.accept(!0)}})]})})]}),e.jsxs("span",{className:"split",children:[e.jsx(k,{big:!0,icon:"reject",title:"letter.reject",onClick:()=>p.reject(!1),disabled:!m.changes}),e.jsx(R,{title:"letter.rejectOptions",disabled:!m.changes,children:u=>e.jsxs(e.Fragment,{children:[e.jsx(I,{label:n("letter.rejectNext"),onClick:()=>{u(),p.reject(!1)}}),e.jsx(I,{label:n("letter.rejectAll"),onClick:()=>{u(),p.reject(!0)}})]})})]}),e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"prev",title:"letter.changePrevious",text:!0,onClick:()=>p.change(-1),disabled:!m.changes}),e.jsx(k,{icon:"next",title:"letter.changeNext",text:!0,onClick:()=>p.change(1),disabled:!m.changes})]})]}),e.jsxs(A,{label:"letter.group.proofing",children:[e.jsx(k,{big:!0,icon:"spell",title:"letter.spelling",onClick:()=>d({spell:!c.spell}),active:c.spell}),w,e.jsx(k,{big:!0,icon:"count",title:"letter.wordCount",onClick:p.wordCount})]}),e.jsx(A,{label:"letter.group.speech",children:e.jsx(k,{big:!0,icon:"speak",title:m.speaking?"letter.readAloudStop":"letter.readAloud",onClick:p.readAloud,active:m.speaking})}),e.jsx(A,{label:"letter.group.language",children:e.jsx(R,{big:!0,icon:"language",title:"letter.language",children:u=>bi.map(g=>e.jsx(I,{active:f===g,label:new Intl.DisplayNames([document.documentElement.lang||"en"],{type:"language"}).of(g)??g,onClick:()=>{b(g),u()}},g))})})]}),F==="view"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.views",children:[e.jsx(k,{big:!0,icon:"print",title:"letter.printLayout",onClick:()=>d({layout:"print"}),active:c.layout==="print"}),e.jsx(k,{big:!0,icon:"web",title:"letter.webLayout",onClick:()=>d({layout:"web"}),active:c.layout==="web"})]}),e.jsxs(A,{label:"letter.group.show",children:[e.jsx(k,{big:!0,icon:"outline",title:"letter.outline",onClick:p.outline,active:m.outline}),e.jsx(k,{big:!0,icon:"marks",title:"letter.showMarks",onClick:()=>d({marks:!c.marks}),active:c.marks})]}),e.jsxs(A,{label:"letter.group.immersive",children:[e.jsx(k,{big:!0,icon:"focus",title:"letter.focus",onClick:p.focus}),e.jsx(k,{big:!0,icon:"speak",title:m.speaking?"letter.readAloudStop":"letter.readAloud",onClick:p.readAloud,active:m.speaking})]}),e.jsxs(A,{label:"letter.group.zoom",children:[e.jsx(k,{big:!0,icon:"zoomin",title:"letter.zoom100",onClick:()=>d({zoom:1}),active:c.zoom===1}),e.jsx(k,{big:!0,icon:"onepage",title:"letter.onePage",onClick:()=>d({zoom:"page"}),active:c.zoom==="page",disabled:c.layout==="web"}),e.jsx(k,{big:!0,icon:"width",title:"letter.pageWidth",onClick:()=>d({zoom:"width"}),active:c.zoom==="width"})]})]}),F==="table"&&e.jsxs(e.Fragment,{children:[e.jsx(A,{label:"letter.group.tableStyles",children:e.jsx("div",{className:"table-styles",children:Object.keys(an).map(u=>{const g=an[u];return e.jsx("button",{type:"button",title:n(`letter.tableStyle.${u}`),onClick:()=>ha(t,u),className:g.borders==="none"?"no-lines":"",children:[0,1,2,3].map(T=>e.jsx("i",{style:{background:T===0?g.head??"#FFFFFF":T%2===0?g.band??"#FFFFFF":"#FFFFFF"}},T))},u)})})}),e.jsxs(A,{label:"letter.group.rowsColumns",children:[e.jsx(k,{big:!0,icon:"rowabove",title:"letter.rowAbove",onClick:()=>y().addRowBefore().run()}),e.jsx(k,{big:!0,icon:"rowbelow",title:"letter.rowBelow",onClick:()=>y().addRowAfter().run()}),e.jsx(k,{big:!0,icon:"colleft",title:"letter.columnLeft",onClick:()=>y().addColumnBefore().run()}),e.jsx(k,{big:!0,icon:"colright",title:"letter.columnRight",onClick:()=>y().addColumnAfter().run()})]}),e.jsx(A,{label:"letter.group.delete",children:e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"delrow",title:"letter.deleteRow",text:!0,onClick:()=>y().deleteRow().run()}),e.jsx(k,{icon:"delcol",title:"letter.deleteColumn",text:!0,onClick:()=>y().deleteColumn().run()}),e.jsx(k,{icon:"deltable",title:"letter.deleteTable",text:!0,onClick:()=>y().deleteTable().run()})]})}),e.jsxs(A,{label:"letter.group.merge",children:[e.jsx(k,{big:!0,icon:"merge",title:"letter.mergeCells",onClick:()=>y().mergeCells().run()}),e.jsx(k,{big:!0,icon:"split",title:"letter.splitCell",onClick:()=>y().splitCell().run()}),e.jsx(k,{big:!0,icon:"headerrow",title:"letter.headerRow",onClick:()=>y().toggleHeaderRow().run()})]}),e.jsx(A,{label:"letter.group.cell",children:e.jsx(R,{big:!0,icon:"shading",title:"letter.cellShading",children:u=>e.jsx(je,{none:"letter.noColor",onPick:g=>{y().setCellAttribute("background",g).run(),u()}})})}),e.jsxs(A,{label:"letter.group.withClass",children:[e.jsx(k,{big:!0,icon:"sheet",title:m.linkedTable?"letter.openLinkedSheet":"letter.editInClass",onClick:p.editInClass}),e.jsx(k,{big:!0,icon:"texttable",title:"letter.tableToText",onClick:p.tableToText})]})]}),F==="picture"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.arrange",children:[e.jsx(k,{icon:"left",title:"letter.alignLeft",onClick:()=>y().setTextAlign("left").run(),active:x.align==="left"||!x.align}),e.jsx(k,{icon:"center",title:"letter.alignCenter",onClick:()=>y().setTextAlign("center").run(),active:x.align==="center"}),e.jsx(k,{icon:"right",title:"letter.alignRight",onClick:()=>y().setTextAlign("right").run(),active:x.align==="right"})]}),e.jsx(A,{label:"letter.group.size",children:[.25,.5,.75,1].map(u=>e.jsx(k,{text:!0,label:`${u*100}%`,title:n("letter.imageWidth",{n:u*100}),onClick:()=>he(u)},u))}),e.jsxs(A,{label:"letter.group.picture",children:[e.jsx(k,{big:!0,icon:"image",title:"letter.replaceImage",onClick:p.replaceImage}),e.jsx(k,{big:!0,icon:"alt",title:"letter.altText",onClick:()=>{const u=prompt(n("letter.altTextPrompt"),x.imageAlt);u!==null&&y().updateAttributes("image",{alt:u.trim()||null}).run()}}),e.jsx(k,{big:!0,icon:"trash",title:"letter.deleteImage",onClick:()=>y().deleteSelection().run()})]})]}),F==="smart"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.find",children:[e.jsx(k,{big:!0,icon:"search",title:"letter.commandSearch",onClick:p.commandSearch}),e.jsx(k,{big:!0,icon:"outline",title:"letter.outline",onClick:p.outline,active:m.outline})]}),e.jsxs(A,{label:"letter.group.cleanUp",children:[e.jsx(R,{big:!0,icon:"clean",title:"letter.cleanUp",children:u=>oa.map(g=>e.jsx(I,{label:n(`letter.cleanUp.${g}`),onClick:()=>{p.cleanUp(g),u()}},g))}),e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"sort",title:"letter.sortAZ",text:!0,onClick:()=>p.sort(1)}),e.jsx(k,{icon:"sort",title:"letter.sortZA",text:!0,onClick:()=>p.sort(-1)}),e.jsx(R,{icon:"case",title:"letter.changeCase",text:!0,children:u=>Qn.map(g=>e.jsx(I,{label:n(`letter.case.${g}`),onClick:()=>{Zn(t,g),u()}},g))})]})]}),e.jsxs(A,{label:"letter.group.convert",children:[e.jsx(k,{big:!0,icon:"texttable",title:"letter.textToTable",onClick:p.textToTable}),e.jsx(k,{big:!0,icon:"toc",title:"letter.toc",onClick:p.toc,disabled:!$}),e.jsx(k,{big:!0,icon:"qr",title:"letter.qr",onClick:p.qr})]}),e.jsxs(A,{label:"letter.group.voice",children:[e.jsx(k,{big:!0,icon:"mic",title:m.dictating?"letter.dictateStop":"letter.dictate",onClick:p.dictate,active:m.dictating}),e.jsx(k,{big:!0,icon:"speak",title:m.speaking?"letter.readAloudStop":"letter.readAloud",onClick:p.readAloud,active:m.speaking}),e.jsx(k,{big:!0,icon:"focus",title:"letter.focus",onClick:p.focus})]})]}),F==="docs"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.proLetters",children:[e.jsx(yt,{cat:"admin",icon:"envelope",suite:m,actions:p}),e.jsx(yt,{cat:"gov",icon:"gov",suite:m,actions:p}),e.jsx(yt,{cat:"mil",icon:"shield",suite:m,actions:p})]}),e.jsx(A,{label:"letter.group.normalLetters",children:e.jsx(yt,{cat:"perso",icon:"heart",suite:m,actions:p})}),e.jsx(A,{label:"letter.group.cv",children:e.jsx(R,{big:!0,icon:"cv",title:"letter.docs.cv",children:u=>fn.map(g=>e.jsx(I,{label:g.title[X()],onClick:()=>{p.docTemplate(g.id),u()}},g.id))})}),e.jsxs(A,{label:"letter.group.fill",children:[e.jsx(k,{big:!0,icon:"fill",title:"letter.docs.fill",onClick:p.fillFields,disabled:!m.fields}),e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"next",title:"letter.docs.nextField",text:!0,onClick:p.nextField,disabled:!m.fields}),e.jsx(k,{icon:"user",title:"letter.docs.profile",text:!0,onClick:p.profile}),e.jsx("span",{className:"docs-count",children:n("letter.docs.left",{n:m.fields})})]})]}),e.jsxs(A,{label:"letter.group.docAi",children:[e.jsx(k,{big:!0,icon:"sparkle",title:"letter.docs.aiWrite",onClick:()=>p.docAi("docWrite")}),e.jsx(k,{big:!0,icon:"pen",title:"letter.docs.aiFill",onClick:()=>p.docAi("fillAi"),disabled:!m.fields})]}),e.jsx(A,{label:"letter.group.docLang",children:e.jsxs("div",{className:"stack",children:[e.jsx(k,{icon:"language",title:"Français",label:"Français",text:!0,active:m.docLang==="fr",onClick:()=>p.docLang("fr")}),e.jsx(k,{icon:"language",title:"English",label:"English",text:!0,active:m.docLang==="en",onClick:()=>p.docLang("en")})]})})]}),F==="oi1"&&e.jsxs(e.Fragment,{children:[e.jsxs(A,{label:"letter.group.withClass",children:[e.jsx(k,{big:!0,icon:"sheet",title:m.linkedTable?"letter.openLinkedSheet":"letter.editInClass",onClick:p.editInClass,disabled:!x.inTable}),e.jsx(ar,{suite:m,actions:p}),e.jsx(k,{big:!0,icon:"new",title:"letter.newSheet",onClick:p.newSheet})]}),e.jsx(A,{label:"letter.group.withStage",children:e.jsx(k,{big:!0,icon:"stage",title:"letter.makeSlides",onClick:p.makeSlides})}),e.jsxs(A,{label:"letter.group.withProdfos",children:[e.jsx(k,{big:!0,icon:"pdf",title:"letter.savePdf",onClick:p.pdf}),e.jsx(k,{big:!0,icon:"prodfos",title:"letter.openProdfos",onClick:()=>p.openApp("prodfos")})]}),e.jsx(A,{label:"letter.group.apps",children:e.jsx("div",{className:"app-keys",children:m.apps.filter(u=>u.id!=="letter").map(u=>e.jsxs("button",{type:"button",className:"app-key",disabled:!u.ready,onClick:()=>p.openApp(u.id),style:{"--accent":u.color},title:u.ready?u.name:`${u.name} (${n("home.soon")})`,children:[e.jsx("i",{}),u.name.replace("Office ","")]},u.id))})}),e.jsx(A,{label:"letter.group.share",children:e.jsx(k,{big:!0,icon:"share",title:"letter.share",onClick:p.share})})]})]})]})}function yt({cat:t,icon:a,actions:o}){return e.jsx(R,{big:!0,icon:a,title:`letter.docs.${t}`,children:i=>pn.filter(l=>l.cat===t).map(l=>e.jsx(I,{label:l.title[X()],onClick:()=>{o.docTemplate(l.id),i()}},l.id))})}function ar({suite:t,actions:a}){return e.jsx(R,{big:!0,icon:"sheet",title:"letter.fromClass",children:o=>e.jsxs(e.Fragment,{children:[t.sheets.length>0&&e.jsx("span",{className:"kicker",children:n("letter.openSheets")}),t.sheets.map(i=>e.jsx(I,{label:i.title,onClick:()=>{a.insertFromSheet(i.tabId),o()}},i.tabId)),t.sheets.length>0&&e.jsx("hr",{}),e.jsx(I,{label:n("letter.fromSheetFile"),onClick:()=>{a.insertFromSheet(null),o()}})]})})}function no({onPick:t}){const[a,o]=S.useState({r:0,c:0});return e.jsxs("div",{className:"table-grid",onMouseLeave:()=>o({r:0,c:0}),children:[e.jsx("div",{className:"table-grid-label",children:a.r?`${a.c} × ${a.r}`:n("letter.table")}),Array.from({length:8},(i,l)=>e.jsx("div",{className:"table-grid-row",children:Array.from({length:10},(f,b)=>e.jsx("button",{type:"button","aria-label":`${b+1} × ${l+1}`,className:l<a.r&&b<a.c?"on":"",onMouseEnter:()=>o({r:l+1,c:b+1}),onFocus:()=>o({r:l+1,c:b+1}),onClick:()=>t(l+1,b+1)},b))},l))]})}function or({th:t,on:a,onPick:o}){return e.jsxs("button",{type:"button",role:"option","aria-selected":a,className:`theme-tile${a?" on":""}`,onClick:()=>o(t),title:n(t.name),style:{background:t.page??"#FFFFFF",color:t.styles.normal.color??(Ye(t.page)?"#FFFFFF":"#000000")},children:[e.jsx("span",{className:"theme-title",style:xr({...t.styles.normal,...t.styles.title,size:15},t.styles.normal),children:"Aa"}),e.jsxs("span",{className:"theme-lines",children:[e.jsx("i",{style:{background:t.styles.h1.color??"#2F5496"}}),e.jsx("i",{}),e.jsx("i",{})]}),e.jsx("span",{className:"theme-name",children:n(t.name)})]})}function ro({targets:t,onPick:a}){const[o,i]=S.useState("see");return e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"seg-row",role:"radiogroup","aria-label":n("letter.crossRef"),children:xi.map(l=>e.jsx("button",{type:"button",role:"radio","aria-checked":o===l,className:o===l?"on":"",onClick:()=>i(l),children:n(`letter.refForm.${l}`)},l))}),e.jsx("hr",{}),t.map(l=>e.jsx(I,{label:l.text,hint:n(l.kind==="heading"?"letter.source.title":l.kind==="caption"?"letter.group.captions":"letter.footnoteInsert"),onClick:()=>a(l,o)},`${l.kind}${l.pos}`))]})}function io({editor:t,replace:a,onClose:o}){const[i,l]=S.useState(()=>{const{from:y,to:E}=t.state.selection,$=t.state.doc.textBetween(y,E," ");return $.length<80?$:""}),[f,b]=S.useState(""),[c,d]=S.useState(!1),[p,m]=S.useState(a),[,w]=S.useState(0),v=S.useRef(null);S.useEffect(()=>{var y,E;m($=>$||a),(y=v.current)==null||y.focus(),(E=v.current)==null||E.select()},[a]),S.useEffect(()=>{yi(t,i,c),w(y=>y+1)},[t,i,c]),S.useEffect(()=>{const y=()=>w(E=>E+1);return t.on("transaction",y),()=>{t.off("transaction",y),vi(t)}},[t]);const C=Ci(t.state),x=C.matches.length?n("letter.findCount",{n:C.current+1,total:C.matches.length}):i?n("letter.findNone"):"";return e.jsxs("div",{className:"findbar",role:"search",onKeyDown:y=>{y.key==="Escape"&&o()},children:[e.jsxs("div",{className:"find-row",children:[e.jsx("input",{ref:v,value:i,placeholder:n("letter.find"),"aria-label":n("letter.find"),onChange:y=>l(y.target.value),onKeyDown:y=>{y.key==="Enter"&&(y.preventDefault(),y.shiftKey?$n(t):On(t))}}),e.jsx("span",{className:"find-count","aria-live":"polite",children:x}),e.jsx("button",{type:"button",title:n("letter.findPrevious"),"aria-label":n("letter.findPrevious"),onClick:()=>$n(t),children:"↑"}),e.jsx("button",{type:"button",title:n("letter.findNext"),"aria-label":n("letter.findNext"),onClick:()=>On(t),children:"↓"}),e.jsx("button",{type:"button",title:n("letter.replace"),"aria-label":n("letter.replace"),"aria-pressed":p,onClick:()=>m(y=>!y),children:"⇄"}),e.jsx("button",{type:"button",title:n("letter.close"),"aria-label":n("letter.close"),onClick:o,children:"×"})]}),p&&e.jsxs("div",{className:"find-row",children:[e.jsx("input",{value:f,placeholder:n("letter.replaceWith"),"aria-label":n("letter.replaceWith"),onChange:y=>b(y.target.value),onKeyDown:y=>{y.key==="Enter"&&(y.preventDefault(),qn(t,f))}}),e.jsx("button",{type:"button",onClick:()=>qn(t,f),children:n("letter.replace")}),e.jsx("button",{type:"button",onClick:()=>ji(t,f),children:n("letter.replaceAll")})]}),e.jsxs("label",{className:"find-case",children:[e.jsx("input",{type:"checkbox",checked:c,onChange:y=>d(y.target.checked)})," ",n("letter.matchCase")]})]})}function ao({editor:t,pages:a,onClose:o}){const i=t.getText({blockSeparator:`
`});let l=0;t.state.doc.descendants(c=>(c.isTextblock&&c.textContent.trim()&&l++,!c.isTextblock));const f=yr(i),b=[[n("letter.count.pages"),a],[n("letter.count.words"),t.storage.characterCount.words()],[n("letter.count.charsNoSpaces"),i.replace(/\s/g,"").length],[n("letter.count.chars"),i.replace(/\n/g,"").length],[n("letter.count.paragraphs"),l],[n("letter.count.sentences"),f.sentences],[n("letter.count.perSentence"),f.perSentence],[n("letter.count.reading"),n("letter.minutes",{n:f.readMinutes})],[n("letter.count.speaking"),n("letter.minutes",{n:f.speakMinutes})]];return e.jsx(Ze,{title:n("letter.wordCount"),onClose:o,children:e.jsx("table",{className:"count-table",children:e.jsx("tbody",{children:b.map(([c,d])=>e.jsxs("tr",{children:[e.jsx("th",{children:c}),e.jsx("td",{children:d.toLocaleString(X())})]},c))})})})}function oo({page:t,onApply:a,onClose:o}){const i=kr(t),l=i==="in"?1:2.54,[f,b]=S.useState({...t.margins,header:t.headerDistance,footer:t.footerDistance}),c=(d,p)=>e.jsx(Ge,{label:p,unit:i,step:i==="in"?.1:.25,min:0,max:i==="in"?10:25,value:Math.round(f[d]*l*100)/100,onChange:m=>b(w=>({...w,[d]:m/l}))});return e.jsx(Ze,{title:n("letter.margins.custom"),onClose:o,onOk:()=>a({...t,margins:{top:f.top,right:f.right,bottom:f.bottom,left:f.left},headerDistance:f.header,footerDistance:f.footer}),children:e.jsxs("div",{className:"margins-grid",children:[c("top",n("letter.margin.top")),c("bottom",n("letter.margin.bottom")),c("left",n("letter.margin.left")),c("right",n("letter.margin.right")),c("header",n("letter.margin.header")),c("footer",n("letter.margin.footer"))]})})}function so({editor:t,onClose:a}){var f;const o=re({editor:t,selector:({editor:b})=>{const c=[];return b.state.doc.descendants((d,p)=>{if(d.type.name==="heading"||d.attrs.styleId==="title"){const m=d.textContent.trim();m&&c.push({level:d.type.name==="heading"?d.attrs.level:0,text:m,pos:p})}return d.type.name!=="table"}),c},equalityFn:(b,c)=>JSON.stringify(b)===JSON.stringify(c)})??[],i=re({editor:t,selector:({editor:b})=>b.state.selection.from})??0,l=(f=[...o].reverse().find(b=>b.pos<i))==null?void 0:f.pos;return e.jsxs("aside",{className:"outline-pane","aria-label":n("letter.outline"),children:[e.jsxs("header",{children:[e.jsx("span",{className:"kicker",children:n("letter.outline")}),e.jsx("button",{type:"button",onClick:a,"aria-label":n("letter.close"),children:"×"})]}),o.length===0?e.jsx("p",{className:"muted",children:n("letter.outlineEmpty")}):e.jsx("ol",{children:o.map(b=>e.jsx("li",{children:e.jsx("button",{type:"button",className:`lvl${b.level}${b.pos===l?" on":""}`,onClick:()=>{var d;t.chain().focus().setTextSelection(b.pos+1).run();const c=t.view.nodeDOM(b.pos);(d=c==null?void 0:c.scrollIntoView)==null||d.call(c,{block:"start",behavior:"smooth"})},children:b.text})},b.pos))})]})}function lo({commands:t,onClose:a}){const[o,i]=S.useState(""),[l,f]=S.useState(0),b=S.useRef(null);S.useEffect(()=>{var m;(m=b.current)==null||m.focus()},[]);const c=m=>m.normalize("NFD").replace(new RegExp("\\p{M}","gu"),"").toLowerCase(),d=S.useMemo(()=>{const m=c(o.trim()),w=t.filter(C=>!C.disabled);if(!m)return w.slice(0,60);const v=m.split(/\s+/);return w.map(C=>({c:C,label:c(C.label),group:c(C.group)})).filter(C=>v.every(x=>C.label.includes(x)||C.group.includes(x))).sort((C,x)=>+!C.label.startsWith(v[0])-+!x.label.startsWith(v[0])).map(C=>C.c)},[o,t]);S.useEffect(()=>f(0),[o]);const p=m=>{m&&(a(),window.setTimeout(m.run,0))};return e.jsx("div",{className:"palette-backdrop",onMouseDown:m=>{m.target===m.currentTarget&&a()},children:e.jsxs("div",{className:"palette",role:"dialog","aria-label":n("letter.commandSearch"),children:[e.jsxs("div",{className:"palette-input",children:[e.jsx(Ce,{name:"search"}),e.jsx("input",{ref:b,value:o,placeholder:n("letter.commandSearchHint"),"aria-label":n("letter.commandSearch"),onChange:m=>i(m.target.value),onKeyDown:m=>{m.key==="Escape"?a():m.key==="ArrowDown"?(m.preventDefault(),f(w=>Math.min(d.length-1,w+1))):m.key==="ArrowUp"?(m.preventDefault(),f(w=>Math.max(0,w-1))):m.key==="Enter"&&(m.preventDefault(),p(d[l]))}}),e.jsx("kbd",{children:"Esc"})]}),e.jsxs("ul",{className:"palette-list",role:"listbox",children:[d.length===0&&e.jsx("li",{className:"muted palette-empty",children:n("letter.findNone")}),d.map((m,w)=>e.jsx("li",{role:"option","aria-selected":w===l,children:e.jsxs("button",{type:"button",className:w===l?"on":"",onMouseEnter:()=>f(w),onClick:()=>p(m),children:[e.jsx("span",{className:"palette-icon",children:m.icon&&e.jsx(Ce,{name:m.icon})}),e.jsx("span",{className:"palette-label",children:m.label}),e.jsx("span",{className:"palette-group",children:m.group}),m.keys&&e.jsx("kbd",{children:m.keys})]})},m.id))]})]})})}const wr=["name","firstName","address","city","town","phone","email","web","rank","position","unit","serviceNo"],co={name:["Prénom Nom","First and last name","Nom complet","Full name"],firstName:["Prénom","First name"],address:["Adresse","Address"],city:["Ville, province, code postal","City, province, postal code"],town:["Ville","City","Ville, province","City, province"],phone:["Téléphone","Phone"],email:["Courriel","Email"],web:["LinkedIn ou site","LinkedIn or website"],rank:["Grade","Rank"],position:["Poste","Position"],unit:["Unité","Unit"],serviceNo:["Matricule","Service number"]},Kt={"Grade Nom":t=>t.rank&&t.name?`${t.rank} ${t.name}`:void 0,"Rank Name":t=>t.rank&&t.name?`${t.rank} ${t.name}`:void 0,"Grade Prénom Nom":t=>t.rank&&t.name?`${t.rank} ${t.name}`:void 0,"Rank First and last name":t=>t.rank&&t.name?`${t.rank} ${t.name}`:void 0},Sr="oi1.letter.profile";function hn(){try{return JSON.parse(localStorage.getItem(Sr)??"{}")}catch{return{}}}function Fr(t){try{localStorage.setItem(Sr,JSON.stringify(t))}catch{}}function Ar(t){const a=t.trim().toLowerCase();return wr.find(o=>co[o].some(i=>i.toLowerCase()===a))??null}function Nr(t,a=hn()){var i;const o={};for(const l of t){const f=Ar(l),b=f?a[f]:(i=Kt[l])==null?void 0:i.call(Kt,a);b!=null&&b.trim()&&(o[l]=b.trim())}return o}function uo(t,a=hn()){const o={...a};for(const[i,l]of Object.entries(t)){const f=Ar(i);f&&l.trim()&&(o[f]=l.trim())}return Fr(o),o}function mo({editor:t,onClose:a,onDone:o}){const[i]=S.useState(()=>cn(t.state.doc)),[l,f]=S.useState(()=>Nr(i.map(d=>d.label))),[b,c]=S.useState(!0);return e.jsxs(Ze,{title:n("letter.docs.fillTitle"),onClose:a,onOk:()=>{const d=un(t,l);b&&uo(l),o(d)},children:[e.jsx("p",{className:"muted",children:n("letter.docs.fillHint")}),e.jsx("div",{className:"fill-list",children:i.map(({label:d,count:p})=>{const m=d.length>40||/[.:]$/.test(d),w=v=>f(C=>({...C,[d]:v}));return e.jsxs("label",{className:m?"wide":"",children:[e.jsxs("span",{children:[d,p>1&&e.jsxs("em",{children:[" ×",p]})]}),m?e.jsx("textarea",{rows:2,value:l[d]??"",onChange:v=>w(v.target.value)}):e.jsx("input",{value:l[d]??"",onChange:v=>w(v.target.value)})]},d)})}),e.jsxs("label",{className:"check",children:[e.jsx("input",{type:"checkbox",checked:b,onChange:d=>c(d.target.checked)})," ",n("letter.docs.remember")]})]})}function po({onClose:t}){const[a,o]=S.useState(hn);return e.jsxs(Ze,{title:n("letter.docs.profile"),onClose:t,onOk:()=>Fr(a),children:[e.jsx("p",{className:"muted",children:n("letter.docs.profileHint")}),e.jsx("div",{className:"fill-list",children:wr.map(i=>e.jsxs("label",{children:[e.jsx("span",{children:n(`letter.profile.${i}`)}),e.jsx("input",{value:a[i]??"",onChange:l=>o(f=>({...f,[i]:l.target.value}))})]},i))})]})}const fo=["authors","title","year","container","volume","issue","pages","publisher","place","url","doi"];function ho({shell:t,onClose:a,onDone:o,aiFirst:i}){const[l,f]=S.useState(()=>({id:`s${Date.now().toString(36)}`,kind:"book",authors:"",title:"",year:""})),[b,c]=S.useState(""),[d,p]=S.useState(!1),m=(v,C)=>f(x=>({...x,[v]:C})),w=async()=>{if(b.trim()){if(!t.ai.ready()){t.notify(n("letter.pasteNeedsAi"));return}p(!0);try{const v=await t.ai.ask({system:wi,messages:[{role:"user",content:b.trim()}]}),C=Si(v,l.id);C?f(C):t.notify(n("letter.source.aiFailed"))}catch(v){t.notify(`${n("letter.source.aiFailed")} ${String(v)}`)}finally{p(!1)}}};return e.jsxs(Ze,{title:n("letter.source.dialog"),onClose:a,onOk:()=>{if(!l.title.trim())return t.notify(n("letter.source.needTitle")),!1;o(l)},children:[e.jsx("p",{className:"muted",children:n("letter.source.aiHint")}),e.jsxs("div",{className:"source-ai",children:[e.jsx("input",{autoFocus:i,value:b,onChange:v=>c(v.target.value),"aria-label":n("letter.sourceAi"),placeholder:"10.1038/nature14539 · ISBN · https://…",onKeyDown:v=>{v.key==="Enter"&&(v.preventDefault(),w())}}),e.jsx("button",{type:"button",className:"btn",disabled:d||!b.trim(),onClick:()=>void w(),children:d?n("letter.source.aiWorking"):n("letter.source.aiFill")})]}),e.jsxs("div",{className:"fill-list",children:[e.jsxs("label",{children:[e.jsx("span",{children:n("letter.source.kind")}),e.jsx("select",{value:l.kind,onChange:v=>f(C=>({...C,kind:v.target.value})),children:ki.map(v=>e.jsx("option",{value:v,children:n(`letter.sourceKind.${v}`)},v))})]}),fo.map(v=>e.jsxs("label",{className:v==="title"||v==="authors"?"wide":"",children:[e.jsx("span",{children:n(`letter.source.${v}`)}),e.jsx("input",{autoFocus:!i&&v==="authors",value:l[v]??"",onChange:C=>m(v,C.target.value)})]},v))]})]})}function sr(t){const a=new Date(t);if(isNaN(a.getTime()))return"";const o=Math.round((Date.now()-a.getTime())/6e4),i=new Intl.RelativeTimeFormat(X(),{numeric:"auto"});return o<1?i.format(0,"minute"):o<60?i.format(-o,"minute"):o<1440?i.format(-Math.round(o/60),"hour"):a.toLocaleDateString(X(),{day:"numeric",month:"short",year:a.getFullYear()===new Date().getFullYear()?void 0:"numeric"})}function Yt({name:t}){return e.jsx("i",{className:"cmt-avatar",style:{background:Ai(t)},"aria-hidden":"true",children:Fi(t)})}function Er(t,a){const o=Ke(t.state.doc).get(a);o&&t.chain().setTextSelection(o).scrollIntoView().run()}function go({editor:t,comments:a,onChange:o,author:i,editing:l,setEditing:f,showResolved:b,onClose:c}){const d=re({editor:t,selector:({editor:x})=>[...Ke(x.state.doc).keys()],equalityFn:(x,y)=>x.join()===(y==null?void 0:y.join())})??[],p=re({editor:t,selector:({editor:x})=>en(x.state),equalityFn:(x,y)=>x.join()===(y==null?void 0:y.join())})??[],m=new Map(a.map(x=>[x.id,x])),w=d.map(x=>m.get(x)).filter(x=>!!x&&(b||!x.resolved||p.includes(x.id))),v=(x,y)=>{const E=[];for(const $ of a){if($.id!==x){E.push($);continue}const F=y($);F&&E.push(F)}o(E)},C=x=>{pr(t,x),v(x,()=>null),l===x&&f(null)};return e.jsxs("aside",{className:"comments-pane","aria-label":n("letter.comments"),children:[e.jsxs("header",{children:[e.jsx("span",{className:"kicker",children:n("letter.comments")}),e.jsx("button",{type:"button",onClick:c,"aria-label":n("letter.close"),children:"×"})]}),w.length===0&&e.jsx("p",{className:"muted",children:n("letter.commentsEmpty")}),w.map(x=>e.jsx(bo,{c:x,active:p.includes(x.id),editing:l===x.id,author:i,onShow:()=>Er(t,x.id),onSave:y=>{if(!y.trim()){x.text?f(null):C(x.id);return}v(x.id,E=>({...E,text:y.trim()})),f(null),t.commands.focus()},onCancel:()=>{x.text?f(null):C(x.id),t.commands.focus()},onEdit:()=>f(x.id),onReply:y=>v(x.id,E=>({...E,replies:[...E.replies??[],{id:fr(),author:i(),date:new Date().toISOString(),text:y}]})),onResolve:()=>v(x.id,y=>({...y,resolved:!y.resolved||void 0})),onDelete:()=>C(x.id)},x.id))]})}function bo({c:t,active:a,editing:o,author:i,onShow:l,onSave:f,onCancel:b,onEdit:c,onReply:d,onResolve:p,onDelete:m}){const[w,v]=S.useState(t.text),[C,x]=S.useState(""),y=S.useRef(null),E=S.useRef(null);S.useEffect(()=>{var F;o&&(v(t.text),(F=y.current)==null||F.focus())},[o,t.text]),S.useEffect(()=>{var F;a&&((F=E.current)==null||F.scrollIntoView({block:"nearest",behavior:"smooth"}))},[a]);const $=(F,Q,Ne)=>{F.key==="Enter"&&(F.ctrlKey||F.metaKey)&&(F.preventDefault(),Q()),F.key==="Escape"&&(F.preventDefault(),Ne())};return e.jsxs("article",{ref:E,className:`cmt-card${a?" on":""}${t.resolved?" resolved":""}`,onClick:()=>{o||l()},children:[e.jsxs("div",{className:"cmt-head",children:[e.jsx(Yt,{name:t.author}),e.jsxs("span",{className:"cmt-who",children:[e.jsx("b",{children:t.author}),e.jsxs("small",{children:[sr(t.date),t.resolved?` · ${n("letter.commentResolved")}`:""]})]}),e.jsxs("span",{className:"cmt-tools",onClick:F=>F.stopPropagation(),children:[e.jsx("button",{type:"button",title:n(t.resolved?"letter.commentReopen":"letter.commentResolve"),"aria-label":n(t.resolved?"letter.commentReopen":"letter.commentResolve"),onClick:p,children:e.jsx(Ce,{name:t.resolved?"undo":"check"})}),e.jsx("button",{type:"button",title:n("letter.commentEdit"),"aria-label":n("letter.commentEdit"),onClick:c,children:e.jsx(Ce,{name:"pen"})}),e.jsx("button",{type:"button",title:n("letter.commentDelete"),"aria-label":n("letter.commentDelete"),onClick:m,children:e.jsx(Ce,{name:"trash"})})]})]}),o?e.jsxs("div",{className:"cmt-edit",onClick:F=>F.stopPropagation(),children:[e.jsx("textarea",{ref:y,value:w,rows:3,placeholder:n("letter.commentPlaceholder"),"aria-label":n("letter.comment"),onChange:F=>v(F.target.value),onKeyDown:F=>$(F,()=>f(w),b)}),e.jsxs("div",{className:"cmt-actions",children:[e.jsx("button",{type:"button",className:"ghost",onClick:b,children:n("letter.cancel")}),e.jsx("button",{type:"button",className:"primary",onClick:()=>f(w),disabled:!w.trim(),children:n("letter.commentPost")})]})]}):e.jsx("p",{className:"cmt-text",children:t.text}),(t.replies??[]).map(F=>e.jsxs("div",{className:"cmt-reply",children:[e.jsxs("div",{className:"cmt-head",children:[e.jsx(Yt,{name:F.author}),e.jsxs("span",{className:"cmt-who",children:[e.jsx("b",{children:F.author}),e.jsx("small",{children:sr(F.date)})]})]}),e.jsx("p",{className:"cmt-text",children:F.text})]},F.id)),a&&!o&&!t.resolved&&e.jsxs("div",{className:"cmt-reply-box",onClick:F=>F.stopPropagation(),children:[e.jsx(Yt,{name:i()}),e.jsx("input",{value:C,placeholder:n("letter.commentReply"),"aria-label":n("letter.commentReply"),onChange:F=>x(F.target.value),onKeyDown:F=>{F.key==="Enter"&&C.trim()&&(F.preventDefault(),d(C.trim()),x("")),F.key==="Escape"&&x("")}})]})]})}const xo=[".xlsx",".csv",".tsv"],lr=t=>t||{en:"en-US",fr:"fr-FR",es:"es-ES",pt:"pt-PT",de:"de-DE"}[X()]||navigator.language,sn=[".docx",".html",".htm",".txt"],vt="application/vnd.openxmlformats-officedocument.wordprocessingml.document",cr=[".png",".jpg",".jpeg",".gif",".webp"],Ct=24;function ur(t,a,o=!1){const i=o&&t?Ke(t.state.doc):null,l=i?a.filter(f=>i.has(f.id)):a;return{comments:l.length?l:void 0,track:t&&me(t)?!0:void 0}}async function yo(t){try{const a=await t.storage.load("letter");if(a){const i=JSON.parse(a);return{...i,body:tn(i.body)??wt("").body,page:{...na(),...i.page},styles:{...dn(),...i.styles}}}const o=t.storage.get("doc");if(o)return{...wt(""),body:tn(JSON.parse(o))}}catch{}return null}function vo({shell:t,file:a,handoff:o}){const[i,l]=S.useState(null);return S.useEffect(()=>{yo(t).then(f=>l(f??wt(n("letter.untitled"))))},[t]),i?e.jsx(Co,{shell:t,file:a,handoff:o,initial:i}):e.jsx("div",{className:"letter"})}function Co({shell:t,file:a,handoff:o,initial:i}){var Rn;ci();const[l,f]=S.useState(i.page),[b,c]=S.useState(i.styles),[d,p]=S.useState(i.lang??""),[m,w]=S.useState(()=>t.storage.get("name")||""),[v,C]=S.useState(null),[x,y]=S.useState(!1),[E,$]=S.useState(()=>({layout:window.innerWidth<600?"web":"print",zoom:window.innerWidth<880?"width":1,marks:!1,spell:!0})),F=S.useCallback(r=>$(s=>({...s,...r})),[]),[Q,Ne]=S.useState({pages:1,tail:96,notes:[]}),[U,O]=S.useState(null),[Oe,At]=S.useState(()=>t.storage.get("citeStyle")??"apa"),[qe,pe]=S.useState(!1),[Nt,Xe]=S.useState(),[fe,Et]=S.useState(()=>t.storage.get("docLang")||(X()==="fr"?"fr":"en")),[Ee,Tt]=S.useState(()=>window.innerWidth>=1200&&t.storage.get("outline")==="1"),[he,Te]=S.useState(!1),[u,g]=S.useState(!1),[T,W]=S.useState(!1),[G,oe]=S.useState(0),[le,gn]=S.useState(i.comments??[]),[Mt,Me]=S.useState(()=>(i.comments??[]).some(r=>!r.resolved)&&window.innerWidth>=900),[Tr,Lt]=S.useState(null),[bn,Mr]=S.useState(!0),Dt=S.useRef(!1),et=S.useRef(null);Gi(()=>pe(r=>!r),et);const tt=S.useRef(null),nt=S.useRef(null),rt=S.useMemo(()=>`letter-${Math.random().toString(36).slice(2,8)}`,[]),xn=S.useRef(0),ge=S.useRef({page:l,styles:b,lang:d,fileName:m,comments:le});ge.current={page:l,styles:b,lang:d,fileName:m,comments:le};const Rt=S.useRef({body:null,header:null,footer:null}),Be=S.useCallback(()=>{window.clearTimeout(xn.current),xn.current=window.setTimeout(()=>{const{body:r,header:s,footer:j}=Rt.current;if(!r)return;const N={body:r.getJSON(),header:s&&!s.isEmpty?s.getJSON():null,footer:j&&!j.isEmpty?j.getJSON():null,page:ge.current.page,styles:ge.current.styles,lang:ge.current.lang||void 0,...ur(r,ge.current.comments)};t.storage.save("letter",JSON.stringify(N)),t.storage.set("name",ge.current.fileName)},400)},[t]),[it,ze]=S.useState("body"),Le=()=>{Dt.current=!0,y(!0),Be()},Lr=!!Ni(d||X()),at=r=>({class:`doc-text ${r}-text`,spellcheck:String(E.spell&&!Lr),lang:d||""}),Pt=S.useRef({spell:E.spell,lang:d});Pt.current={spell:E.spell,lang:d};const It=S.useMemo(()=>({enabled:()=>Pt.current.spell,lang:()=>Pt.current.lang}),[]),h=Vt({extensions:_t("body",It),content:i.body,editorProps:{attributes:at("body")},onUpdate:Le,onFocus:()=>ze("body")}),z=Vt({extensions:_t("header",It),content:i.header??"",editorProps:{attributes:at("header")},onUpdate:()=>{Le(),oe(r=>r+1)},onFocus:()=>ze("header")}),V=Vt({extensions:_t("footer",It),content:i.footer??"",editorProps:{attributes:at("footer")},onUpdate:()=>{Le(),oe(r=>r+1)},onFocus:()=>ze("footer")});Rt.current={body:h,header:z,footer:V};const P=(it==="header"?z:it==="footer"?V:h)??h,Ve=S.useRef(it);Ve.current=it,S.useEffect(()=>{for(const[r,s]of[["body",h],["header",z],["footer",V]])s==null||s.setOptions({editorProps:{attributes:at(r)}});for(const r of[h,z,V])Ei(r)},[E.spell,d,h,z,V]),S.useEffect(()=>{Be()},[l,b,d,le,Be]),S.useEffect(()=>{Ti(()=>n("letter.yourName"),n("letter.authorDefault")),h&&i.track&&!me(h)&&Ae(h,!0)},[h]);const yn=re({editor:h,selector:({editor:r})=>!!r&&me(r)})??!1,B=re({editor:h,selector:({editor:r})=>r?{comments:en(r.state),change:!!Ht(r),changes:Ri(r.state.doc).length,footnote:!!Vn(r.state),footnotes:zn(r.state.doc)}:null,equalityFn:(r,s)=>JSON.stringify(r)===JSON.stringify(s)}),Z=re({editor:h,selector:({editor:r})=>{if(m)return m.replace(/\.(docx|html?|txt)$/i,"");let s="";return r==null||r.state.doc.descendants(j=>s?!1:((j.type.name==="heading"||j.attrs.styleId==="title")&&(s=j.textContent.trim()),!s)),(s||n("letter.untitled")).slice(0,60)}})??n("letter.untitled"),$t=re({editor:h,selector:({editor:r})=>(r==null?void 0:r.storage.characterCount.words())??0})??0,Dr=re({editor:h,selector:({editor:r})=>r?ln(r.state.doc).length:0})??0,Rr=re({editor:h,selector:({editor:r})=>!!r&&r.isActive("table")})??!1,Pr=re({editor:h,selector:({editor:r})=>{var s;return r?!!((s=St(r))!=null&&s.node.attrs.link):!1}})??!1;S.useEffect(()=>{t.setTitle(Z)},[Z,t]);const be=br(l),_e=be.width*ne,xe=be.height*ne,J=l.margins,_=E.layout==="print",[Ot,Ir]=S.useState({w:1e3,h:800});S.useLayoutEffect(()=>{const r=tt.current;if(!r)return;const s=new ResizeObserver(()=>{Ir({w:r.clientWidth,h:r.clientHeight}),h==null||h.storage.pagination.relayout()});return s.observe(r),()=>s.disconnect()},[h]);const te=_?typeof E.zoom=="number"?E.zoom:E.zoom==="width"?Math.max(.2,(Ot.w-32)/_e):Math.max(.1,Math.min((Ot.w-32)/_e,(Ot.h-32)/xe)):1,vn=z&&!z.isEmpty?z.getHTML():"",Cn=V&&!V.isEmpty?V.getHTML():"";S.useEffect(()=>{if(!h)return;const r=h.storage.pagination;Object.assign(r.layout,{enabled:_,pageHeight:xe,marginTop:J.top*ne,marginBottom:J.bottom*ne,gap:Ct,headerHtml:vn,footerHtml:Cn,version:r.layout.version+1}),r.onLayout=s=>Ne(j=>j.pages===s.pages&&Math.abs(j.tail-s.tail)<.5&&JSON.stringify(j.notes)===JSON.stringify(s.notes)?j:s),r.relayout()},[h,_,xe,J.top,J.bottom,vn,Cn,b,l.size,l.orientation,J.left,J.right,G]);const[$r,Or]=S.useState(xe);S.useLayoutEffect(()=>{const r=nt.current;if(!r)return;const s=new ResizeObserver(()=>Or(r.offsetHeight));return s.observe(r),()=>s.disconnect()},[]);const[qr,Br]=S.useState(1);S.useEffect(()=>{if(!h)return;const r=()=>{const s=nt.current;if(!(!s||!_||!h.view.dom.isConnected))try{const j=(h.view.coordsAtPos(h.state.selection.from).top-s.getBoundingClientRect().top)/te;Br(Math.min(Q.pages,Math.max(1,Math.floor(j/(xe+Ct))+1)))}catch{}};return h.on("selectionUpdate",r),h.on("update",r),()=>{h.off("selectionUpdate",r),h.off("update",r)}},[h,_,te,xe,Q.pages]);const jn=()=>{var r;return!!((r=et.current)!=null&&r.offsetParent)};S.useEffect(()=>{let r=null;const s=()=>{if(!jn())return;r=document.createElement("style");const N=_?`@page { size: ${be.width}in ${be.height}in; margin: 0 }`:`@page { size: ${be.width}in ${be.height}in; margin: ${J.top}in ${J.right}in ${J.bottom}in ${J.left}in }`;r.textContent=`${N}
html, body { background: ${l.color??"#FFFFFF"} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`,document.head.append(r),document.documentElement.classList.add("printing-letter")},j=()=>{r==null||r.remove(),r=null,document.documentElement.classList.remove("printing-letter")};return window.addEventListener("beforeprint",s),window.addEventListener("afterprint",j),()=>{window.removeEventListener("beforeprint",s),window.removeEventListener("afterprint",j),j()}},[_,be.width,be.height,J.top,J.right,J.bottom,J.left,l.color]);const De=()=>(Z||"letter").replace(/[\\/:*?"<>|]+/g,"").trim()||"letter",ot=S.useCallback(()=>{const r=()=>{const s=document.title;document.title=De(),window.print(),document.title=s};_?r():(F({layout:"print"}),window.setTimeout(r,400))},[_,Z]),zr=()=>({body:h.getJSON(),header:z&&!z.isEmpty?z.getJSON():null,footer:V&&!V.isEmpty?V.getJSON():null,page:l,styles:b,lang:d||void 0,...ur(h,le,!0)}),kn=r=>{h==null||h.commands.setContent(tn(r.body)??"",{emitUpdate:!1}),z==null||z.commands.setContent(r.header??"",{emitUpdate:!1}),V==null||V.commands.setContent(r.footer??"",{emitUpdate:!1}),f(r.page),c(r.styles),p(r.lang??""),gn(r.comments??[]),Me(s=>s||(r.comments??[]).some(j=>!j.resolved)),Lt(null),h&&me(h)!==!!r.track&&Ae(h,!!r.track),oe(s=>s+1),h==null||h.commands.focus("start")};async function wn(r){if(h)try{const s=r.name.toLowerCase();if(s.endsWith(".docx")){const{readDocx:N}=await ke(async()=>{const{readDocx:M}=await import("./read-B6UolWEr.js");return{readDocx:M}},__vite__mapDeps([0,1,2,3,4,5,6,7,8]),import.meta.url);kn(await N(await r.arrayBuffer())),C(r.handle?{name:r.name,handle:r.handle}:null)}else{const N=s.endsWith(".txt")?Fa(await r.text()):Aa(await r.text());kn({...wt(""),body:{type:"doc",content:[]}}),h.commands.setContent(N,{emitUpdate:!1}),C(null)}const j=r.name.replace(/\.(txt|html?)$/i,".docx");w(j),ge.current.fileName=j,Dt.current=!1,y(!1),Be()}catch(s){alert(`${n("letter.openFailed")} ${r.name}
${String(s)}`)}}S.useEffect(()=>{h&&z&&V&&a&&wn(a)},[h,z,V]);const st=r=>{!Dt.current&&!m?wn(r):t.openModule("letter",r)},qt=async()=>{const{letterToDocx:r}=await ke(async()=>{const{letterToDocx:s}=await import("./write-B1YsuFR8.js");return{letterToDocx:s}},__vite__mapDeps([9,1,2,3,4,5,6,7,8]),import.meta.url);return new Blob([await r(zr(),Z,ft())],{type:vt})},lt=async(r=!1)=>{if(!h)return;const s=m.toLowerCase().endsWith(".docx")?m:`${De()}.docx`,j=await t.saveFile(s,qt,vt,{target:v,saveAs:r});j&&(C(j),w(j.name),ge.current.fileName=j.name,y(!1),Be())},Sn=S.useRef(async()=>null);Sn.current=async()=>{var j;if(!h)return null;const r=!!(v!=null&&v.handle)&&m.toLowerCase().endsWith(".docx");if(!r&&!((j=t.cloudOn)!=null&&j.call(t)))return null;const s=await t.saveFile(r?m:`${De()}.docx`,qt,vt,{target:r?v:void 0,quiet:!0});return s&&y(!1),s},S.useEffect(()=>(t.autoSave(()=>Sn.current()),()=>t.autoSave(null)),[t]),S.useEffect(()=>{var r;return(r=t.translator)==null||r.call(t,async s=>{let j=0;for(const N of[h,z,V]){if(!N||N.isDestroyed)continue;const M=[];if(N.state.doc.descendants((D,ee)=>{D.isText&&new RegExp("\\p{L}{2,}","u").test(D.text??"")&&M.push({from:ee,to:ee+D.nodeSize,text:D.text,marks:D.marks})}),!M.length)continue;const L=await s(M.map(D=>D.text)),q=N.state.tr;for(let D=M.length-1;D>=0;D--)L[D]&&L[D]!==M[D].text&&(q.replaceWith(M[D].from,M[D].to,N.schema.text(L[D],M[D].marks)),j++);q.docChanged&&N.view.dispatch(Mi(q))}return j}),()=>{var s;return(s=t.translator)==null?void 0:s.call(t,null)}},[t,h,z,V]);const Vr=r=>{h&&(r==="docx"?lt(!0):r==="pdf"?ot():r==="html"?t.saveFile(`${De()}.html`,Na(Z,h.getHTML(),Kn(b,l,"")+Bn("body"),l.color),"text/html",{saveAs:!0}):t.saveFile(`${De()}.txt`,h.getText({blockSeparator:`

`}),"text/plain",{saveAs:!0}))},_r=async r=>{const s=await t.recent.open(r.id);s?st(s):alert(n("home.recentMissing"))},ct=S.useRef(null),[Jr,Fn]=S.useState(!1);S.useEffect(()=>{const r=()=>{const s=P;if(!ct.current||!s||s.state.selection.empty)return;const j=s.chain().unsetAllMarks();for(const N of ct.current.marks)j.setMark(N.type,N.attrs);j.run(),ct.current=null,Fn(!1)};return document.addEventListener("mouseup",r),()=>document.removeEventListener("mouseup",r)},[P]);const An=r=>r==="header"?z:V,Nn=r=>{const s=An(r);s&&(s.isEmpty&&s.commands.setContent({type:"doc",content:[{type:"paragraph"}]}),s.commands.focus("end"),ze(r))},Je=S.useRef(null),Hr=()=>{if(Je.current){Je.current.stop();return}const r=window,s=r.SpeechRecognition??r.webkitSpeechRecognition;if(!s){alert(n("letter.dictateUnsupported"));return}const j=new s;j.lang=lr(d),j.continuous=!0,j.interimResults=!1,j.onresult=N=>{for(let M=N.resultIndex;M<N.results.length;M++){const L=N.results[M];if(!L.isFinal)continue;const q=L[0].transcript.trim();if(!q)continue;const D=Rt.current[Ve.current]??h,ee=(D==null?void 0:D.state.doc.textBetween(Math.max(0,D.state.selection.from-1),D.state.selection.from))??"";D==null||D.chain().focus().insertContent(`${ee&&!/\s$/.test(ee)?" ":""}${q}`).run()}},j.onerror=N=>{N.error==="not-allowed"&&alert(n("letter.dictateBlocked"))},j.onend=()=>{Je.current=null,g(!1)},j.start(),Je.current=j,g(!0)};S.useEffect(()=>()=>{var r,s;(r=Je.current)==null||r.stop(),(s=window.speechSynthesis)==null||s.cancel()},[]);const Ur=()=>{const r=window.speechSynthesis;if(!r){alert(n("letter.readAloudUnsupported"));return}if(T){r.cancel(),W(!1);return}const s=P;if(!s)return;const{from:j,to:N,empty:M}=s.state.selection,L=M?s.state.doc.textBetween(j,s.state.doc.content.size,`
`)||s.getText():s.state.doc.textBetween(j,N,`
`);if(!L.trim())return;r.cancel();const q=L.split(/\n+/).filter(D=>D.trim());q.forEach((D,ee)=>{const ue=new SpeechSynthesisUtterance(D);ue.lang=lr(d),ee===q.length-1&&(ue.onend=()=>W(!1)),r.speak(ue)}),W(!0)},Wr=()=>{var r,s;Te(!0),(s=(r=et.current)==null?void 0:r.requestFullscreen)==null||s.call(r).catch(()=>{})};S.useEffect(()=>{const r=()=>{document.fullscreenElement||Te(!1)};return document.addEventListener("fullscreenchange",r),()=>document.removeEventListener("fullscreenchange",r)},[]);const En=()=>{Te(!1),document.fullscreenElement&&document.exitFullscreen().catch(()=>{})},ut=r=>{const s=nt.current;if(!s||!_||!h)return null;try{const j=(h.view.coordsAtPos(r).top-s.getBoundingClientRect().top)/te;return Math.max(1,Math.floor(j/(xe+Ct))+1)}catch{return null}};ga(h,Z);const Tn=r=>({tabId:t.tabId,id:r,moduleId:"letter",title:Z}),dt=(r,s,j)=>{if(!h)return!1;if(s){const M=Wt(h.state.doc,s.id);if(M){if(rn(h,M,r),j&&M.node.attrs.linkTab!==j){const L=Wt(h.state.doc,s.id);L&&h.view.dispatch(h.state.tr.setNodeMarkup(L.pos,void 0,{...L.node.attrs,linkTab:j}))}return t.notify(n("letter.tableUpdated")),!0}}const N=s?{link:s.id,linkTab:j}:{};return h.chain().focus().insertContent([mn(r,N),{type:"paragraph"}]).run(),!0};S.useEffect(()=>h?t.onReceive((s,j)=>s.kind==="file"?(st(s.file),!0):s.kind==="html"?(h.chain().focus().insertContent(s.html).run(),!0):dt(s.table,s.link,j)):void 0),S.useEffect(()=>{var r;if(h){if((o==null?void 0:o.kind)==="html"){h.commands.setContent({type:"doc",content:[{type:"heading",attrs:{level:1},content:[{type:"text",text:o.title||n("letter.untitled")}]},{type:"paragraph"}]},{emitUpdate:!1}),h.chain().focus("end").insertContent(o.html).run();return}(o==null?void 0:o.kind)==="table"&&(h.commands.setContent({type:"doc",content:[{type:"heading",attrs:{level:1},content:[{type:"text",text:o.title||n("letter.untitled")}]},{type:"paragraph"}]},{emitUpdate:!1}),h.commands.focus("end"),dt(o.table,o.link,((r=o.link)==null?void 0:r.tabId)??null))}},[h]);const Gr=()=>{h&&t.openModule("stage",void 0,{kind:"html",title:Z,html:h.getHTML()})},Kr=()=>{const r=P??h,s=r&&St(r);if(!r||!s){t.notify(n("letter.clickInTable"));return}const j=ve(s.node),N=s.node.attrs.link,M=gr(N)?N:Ui();hr().ensure(M,{kind:"table",title:Z,table:j},"letter","letter"),M!==N&&r.view.dispatch(r.state.tr.setNodeMarkup(s.pos,void 0,{...s.node.attrs,link:M}));const L=s.node.attrs.linkTab;if(L&&t.tabs("class").some(ee=>ee.tabId===L)){t.send(L,{kind:"table",title:Z,table:j,link:Tn(M)}),t.showTab(L);return}const q=t.openModule("class",void 0,{kind:"table",title:Z,table:j,link:Tn(M)}),D=Wt(r.state.doc,M);q&&D&&r.view.dispatch(r.state.tr.setNodeMarkup(D.pos,void 0,{...D.node.attrs,link:M,linkTab:q}))},Yr=async r=>{if(r){const j=await t.ask(r,"table");(j==null?void 0:j.kind)==="table"?(dt(j.table,j.link,r),t.notify(n("letter.tableInserted"))):t.notify(n("letter.sheetGone"));return}const s=await t.openFile(xo);if(s)try{const[{computeSheet:j,currencyFor:N,usedRange:M},{sheetToTable:L}]=await Promise.all([ke(()=>import("./sheet-D6P9QUtY.js").then(ue=>ue.z),__vite__mapDeps([10,2,3]),import.meta.url),ke(()=>import("./table-D5Hkgf6S.js"),__vite__mapDeps([11,12,10,2,3]),import.meta.url)]);let q;if(s.name.toLowerCase().endsWith(".xlsx"))q=await(await ke(async()=>{const{readXlsx:ue}=await import("./xlsx-C9AIIeBO.js");return{readXlsx:ue}},__vite__mapDeps([13,1,2,3,14,10]),import.meta.url)).readXlsx(await s.arrayBuffer());else{const{parseCsv:ue}=await ke(async()=>{const{parseCsv:Ue}=await import("./csv-CmkhPz-z.js");return{parseCsv:Ue}},[],import.meta.url),{tableToCells:ai}=await ke(async()=>{const{tableToCells:Ue}=await import("./table-D5Hkgf6S.js");return{tableToCells:Ue}},__vite__mapDeps([11,12,10,2,3]),import.meta.url);q={sheets:[{name:s.name,widths:{},cells:ai({rows:ue(await s.text()).map(Ue=>Ue.map(oi=>({text:oi})))})}]}}const D=q.sheets[0],ee=M(D);if(ee.rows<0)return;dt(L(D,{c1:0,r1:0,c2:ee.cols,r2:ee.rows},j(D),X(),N(X(),q)),void 0,null)}catch(j){alert(`${n("letter.openFailed")} ${s.name}
${String(j)}`)}},Qr=async()=>{var j;const r=await qt(),s=new File([r],`${De()}.docx`,{type:vt});(j=navigator.canShare)!=null&&j.call(navigator,{files:[s]})?await navigator.share({files:[s],title:Z}).catch(()=>{}):lt(!0)},Bt={commandSearch:()=>O("commands"),dictate:Hr,readAloud:Ur,outline:()=>Tt(r=>(t.storage.set("outline",r?"0":"1"),!r)),focus:Wr,theme:r=>{c(r.styles),f(s=>({...s,color:r.page}))},spacing:r=>c(s=>({...s,normal:{...s.normal,...$e[r]}})),toc:()=>{if(!h)return;const r=da(h,ut,_e-(J.left+J.right)*ne);if(!r){t.notify(n("letter.tocEmpty"));return}h.chain().focus().insertContent(r).run()},callout:r=>P==null?void 0:P.chain().focus().insertContent([pa(r,Ye(l.color))]).run(),letterBlock:r=>P==null?void 0:P.chain().focus().insertContent(fa(r,d)).run(),qr:async()=>{const r=P;if(!r)return;const s=prompt(n("letter.qrPrompt"),r.getAttributes("link").href??"https://");if(!(s!=null&&s.trim()))return;const j=await aa(s.trim());r.chain().focus().insertContent({type:"image",attrs:{src:j,alt:s.trim(),width:132}}).run()},cleanUp:r=>{if(!h)return;const s=sa(h,r,d||X());t.notify(s?n("letter.cleanedUp",{n:s}):n("letter.cleanNothing"))},sort:r=>{P&&!la(P,r,d||X())&&t.notify(n("letter.sortHint"))},textToTable:()=>{P&&!ca(P)&&t.notify(n("letter.sortHint"))},tableToText:()=>{P&&!ua(P)&&t.notify(n("letter.clickInTable"))},editInClass:Kr,makeSlides:Gr,insertFromSheet:r=>void Yr(r),newSheet:()=>t.openModule("class"),openApp:r=>t.openModule(r),share:()=>void Qr(),pdf:()=>ot()},zt=r=>{gn(r),Le()},Re={newComment:()=>{if(!h)return;if(Ve.current!=="body"){t.notify(n("letter.commentBodyOnly"));return}const r=fr();if(!_i(h,r)){t.notify(n("letter.commentSelect"));return}zt([...le,{id:r,author:ft(!0),date:new Date().toISOString(),text:""}]),Me(!0),Lt(r)},deleteComment:()=>{if(!h)return;const r=en(h.state);if(!r.length){t.notify(n("letter.commentNone"));return}for(const s of r)pr(h,s);zt(le.filter(s=>!r.includes(s.id)))},comment:r=>{if(!h)return;const s=[...Ke(h.state.doc)];if(!s.length){t.notify(n("letter.commentsEmpty"));return}const{from:j,to:N}=h.state.selection,M=r>0?s.find(([,L])=>L.from>=N)??s[0]:[...s].reverse().find(([,L])=>L.to<=j)??s[s.length-1];Me(!0),Er(h,M[0]),h.commands.focus()},toggleComments:()=>Me(r=>!r),track:()=>{h&&(me(h)||ft(!0),Ae(h,!me(h)),Le(),t.notify(n(me(h)?"letter.trackOn":"letter.trackOff")))},markup:()=>Mr(r=>!r),accept:r=>{if(!h)return;const s=r?null:Ht(h);if(!r&&!s){We(h,1)||t.notify(n("letter.changesNone"));return}!Hn(h,!0,s==null?void 0:s.id)&&r&&t.notify(n("letter.changesNone")),r||We(h,1)},reject:r=>{if(!h)return;const s=r?null:Ht(h);if(!r&&!s){We(h,1)||t.notify(n("letter.changesNone"));return}!Hn(h,!1,s==null?void 0:s.id)&&r&&t.notify(n("letter.changesNone")),r||We(h,1)},change:r=>{h&&!We(h,r)&&t.notify(n("letter.changesNone"))},footnote:()=>{if(!h)return;if(Ve.current!=="body"){t.notify(n("letter.footnoteBodyOnly"));return}const r=prompt(n("letter.footnotePrompt"),"");r!=null&&r.trim()&&h.chain().focus().insertFootnote(r.trim()).run()},editFootnote:()=>{if(!h)return;const r=Vn(h.state);if(!r){t.notify(n("letter.footnoteNone"));return}const s=prompt(n("letter.footnotePrompt"),r.text);s!==null&&(s.trim()?h.chain().focus().command(({tr:j})=>(j.setNodeAttribute(r.pos,"text",s.trim()),!0)).run():h.chain().focus().setNodeSelection(r.pos).deleteSelection().run())},citeStyle:Oe,setCiteStyle:r=>{if(At(r),t.storage.set("citeStyle",r),h){const s=Vi(h,r);s&&t.notify(n("letter.citeRestyled",{n:s}))}},newCitation:r=>{if(Ve.current!=="body"){t.notify(n("letter.footnoteBodyOnly"));return}O(r?"sourceAi":"source")},cite:r=>h==null?void 0:h.chain().focus().insertCitation(r,Oe).run(),citedSources:()=>h?Jn(h.state.doc):[],bibliography:r=>{if(!h)return;const s=Jn(h.state.doc);if(!s.length){t.notify(n("letter.citeNone"));return}h.chain().focus().insertContent(zi(s,Oe,r)).run()},caption:r=>{if(!h)return;const s=prompt(n("letter.captionPrompt"),"");s!==null&&h.chain().focus().insertContent(Bi(h.state.doc,r,s.trim(),(d||X()).startsWith("fr"))).run()},tableOfFigures:()=>{if(!h)return;const r=qi(h.state.doc,ut,n("letter.tof"));if(!r){t.notify(n("letter.tofEmpty"));return}h.chain().focus().insertContent(r).run()},refTargets:()=>h?Oi(h.state.doc):[],crossRef:(r,s)=>{h&&h.chain().focus().insertContent($i(r,s,ut(r.pos+1),h.state.selection.from)).run()},markIndex:()=>{if(!h)return;const{from:r,to:s}=h.state.selection,j=h.state.doc.textBetween(r,s).trim();if(!j||!h.chain().focus().markIndexTerm(j).run()){t.notify(n("letter.indexSelect"));return}t.notify(n("letter.indexMarked",{term:j}))},insertIndex:()=>{if(!h)return;const r=Pi(h.state.doc,ut,d||X());if(!r.length){t.notify(n("letter.indexEmpty"));return}h.chain().focus().insertContent(Ii(r,n("letter.group.index"))).run()},nextFootnote:()=>{if(!h)return;const r=zn(h.state.doc);if(!r.length){t.notify(n("letter.footnoteNone"));return}const s=h.state.selection.from,j=r.find(N=>N.pos>=s+1)??r[0];h.chain().focus().setNodeSelection(j.pos).scrollIntoView().run()}},mt={fileMenu:()=>O("file"),pasteAs:async r=>{const s=P;if(!s)return;if(r==="keep"){mt.paste();return}let j="";try{j=await navigator.clipboard.readText()}catch{alert(n("letter.pasteBlocked"));return}if(!j.trim()){t.notify(n("letter.pasteEmpty"));return}const N=Pa(r,j);if(N!==null){s.chain().focus().insertContent(N).run();return}if(!t.ai.ready()){t.notify(n("letter.pasteNeedsAi")),pe(!0);return}t.notify(n("letter.pasteWorking"));try{const M=await t.ai.ask({system:"You transform text pasted into Office Letter, a word processor. Reply with only the resulting text, in Markdown when it has lists, headings or a table.",messages:[{role:"user",content:`${Ia[r]}

<text>
${j}
</text>`}]});s.chain().focus().insertContent(nn(M)).run()}catch(M){t.notify(`${n("letter.pasteFailed")} ${String(M)}`)}},pasteText:async()=>{const r=P;if(r){try{r.view.pasteText(await navigator.clipboard.readText())}catch{alert(n("letter.pasteBlocked"))}r.commands.focus()}},paste:async()=>{var s,j;const r=P;if(r){try{const N=await((j=(s=navigator.clipboard).read)==null?void 0:j.call(s)),M=N==null?void 0:N.find(L=>L.types.includes("text/html"));if(M){r.view.pasteHTML(await(await M.getType("text/html")).text());return}r.view.pasteText(await navigator.clipboard.readText())}catch{alert(n("letter.pasteBlocked"))}r.commands.focus()}},painter:()=>{const r=P;r&&(ct.current={marks:r.state.selection.$from.marks().map(s=>({type:s.type.name,attrs:s.attrs}))},Fn(!0))},image:async()=>{const r=await t.openFile(cr);if(!r||!P)return;const s=await _n(new Blob([await r.arrayBuffer()],{type:r.type||"image/png"}));P.chain().focus().setImage({src:s,alt:r.name}).run()},replaceImage:async()=>{const r=await t.openFile(cr);if(!r||!P)return;const s=await _n(new Blob([await r.arrayBuffer()],{type:r.type||"image/png"}));P.chain().focus().updateAttributes("image",{src:s,alt:r.name}).run()},link:()=>{const r=P;if(!r)return;const s=prompt(n("letter.linkPrompt"),r.getAttributes("link").href??"https://");s!==null&&(s.trim()===""?r.chain().focus().extendMarkRange("link").unsetLink().run():r.chain().focus().extendMarkRange("link").setLink({href:s.trim()}).run())},find:r=>O(r?"replace":"find"),header:()=>Nn("header"),footer:()=>Nn("footer"),pageNumber:(r,s,j)=>{const N=s.split(/(\{page\}|\{pages\})/).filter(Boolean).map(q=>q==="{page}"?{type:"pageNumber",attrs:{kind:"page"}}:q==="{pages}"?{type:"pageNumber",attrs:{kind:"pages"}}:{type:"text",text:q});if(r==="here"){P==null||P.chain().focus().insertContent(N).run();return}const M=An(r==="top"?"header":"footer");if(!M)return;const L={type:"paragraph",attrs:{textAlign:j},content:N};M.isEmpty?M.commands.setContent({type:"doc",content:[L]}):M.chain().focus("end").insertContent(N).run(),ze(r==="top"?"header":"footer"),Le(),oe(q=>q+1)},wordCount:()=>O("count"),customMargins:()=>O("margins"),...Bt,...Re,...{docTemplate:r=>{const s=pn.find(L=>L.id===r)??fn.find(L=>L.id===r);if(!s||!h)return;const j=Qt(s[fe],Zt(fe==="fr"?"fr-CA":"en-CA")),N=mr(h)||confirm(n("letter.docs.replaceAsk"));if(N?h.commands.setContent({type:"doc",content:j}):h.chain().focus().insertContent(j).run(),N&&("theme"in s||Ye(l.color))){const L=Qe.find(q=>q.id===("theme"in s?s.theme:"office"));L&&Bt.theme(L)}const M=un(h,Nr(cn(h.state.doc).map(L=>L.label)));Xt(h)||h.commands.focus("start"),t.notify(M?n("letter.docs.autoFilled",{n:M}):n("letter.docs.inserted"))},docLang:r=>{Et(r),t.storage.set("docLang",r)},letterPart:r=>{const s=P;s&&s.chain().focus().insertContent(Qt(Ba(r,fe),Zt(fe==="fr"?"fr-CA":"en-CA"))).run()},fillFields:()=>O("fill"),nextField:()=>{Xt(h)||t.notify(n("letter.docs.noFields"))},profile:()=>O("profile"),docAi:r=>{pe(!0),Xe(s=>({id:r,n:((s==null?void 0:s.n)??0)+1}))}},copilot:()=>pe(r=>!r)};if(S.useEffect(()=>{if(!h)return;const r=s=>{var M,L;const j=(L=(M=s.target).closest)==null?void 0:L.call(M,".fn-ref");if(!j)return;s.preventDefault();const N=h.view.posAtDOM(j,0);h.commands.setNodeSelection(N),Re.editFootnote()};return h.view.dom.addEventListener("dblclick",r),()=>h.view.dom.removeEventListener("dblclick",r)}),S.useEffect(()=>{const r=s=>{if(!jn())return;if(s.altKey&&!s.ctrlKey&&!s.metaKey&&s.key.toLowerCase()==="q"){s.preventDefault(),O("commands");return}if(s.key==="Escape"&&he&&!document.fullscreenElement){En();return}const j=s.key.toLowerCase();if((s.ctrlKey||s.metaKey)&&s.altKey&&(s.code==="KeyM"||j==="m")){s.preventDefault(),Re.newComment();return}if((s.ctrlKey||s.metaKey)&&s.altKey&&(s.code==="KeyF"||j==="f")){s.preventDefault(),Re.footnote();return}if((s.ctrlKey||s.metaKey)&&s.shiftKey&&!s.altKey&&(s.code==="KeyE"||j==="e")){s.preventDefault(),Re.track();return}if(!(s.ctrlKey||s.metaKey)||s.altKey)return;const N=M=>{s.preventDefault(),M()};j==="s"?N(()=>lt(s.shiftKey)):j==="o"?N(async()=>{const M=await t.openFile(sn);M&&st(M)}):j==="p"?N(ot):j==="f"?N(()=>O("find")):j==="h"&&N(()=>O("replace"))};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)}),!h||!z||!V)return null;const ce=r=>`${r}px`,Zr={"--pw":ce(_e),"--ph":ce(xe),"--pg-gap":ce(Ct),"--mt":ce(J.top*ne),"--mb":ce(J.bottom*ne),"--ml":ce(J.left*ne),"--mr":ce(J.right*ne),"--hd":ce(l.headerDistance*ne),"--fd":ce(l.footerDistance*ne),"--pn":'"#"',"--pt":`"${Q.pages}"`,"--pb-label":JSON.stringify(n("letter.pageBreak")),"--link-label":JSON.stringify(n("letter.linkedToClass")),"--live-synced":JSON.stringify(n("live.synced")),"--live-pending":JSON.stringify(n("live.pending")),"--live-different":JSON.stringify(n("live.different")),background:_?void 0:l.color??void 0,transform:te!==1?`scale(${te})`:void 0},Mn=Math.round(te*100),Xr=((Rn=Qe.find(r=>r.page===l.color&&JSON.stringify(r.styles)===JSON.stringify(b)))==null?void 0:Rn.id)??null,ei=yr(h.getText()).readMinutes,ti={apps:t.apps(),sheets:t.tabs("class"),dictating:u,speaking:T,outline:Ee,linkedTable:Pr,themeId:Xr,tracking:yn,markup:bn,commentsOpen:Mt,commentHere:!!(B!=null&&B.comments.length),changeHere:!!(B!=null&&B.change),changes:(B==null?void 0:B.changes)??0,footnoteHere:!!(B!=null&&B.footnote),footnotes:(B==null?void 0:B.footnotes.length)??0,copilot:qe,docLang:fe,fields:Dr},ni=new Set(B?[...Ke(h.state.doc).keys()]:[]),Ln=le.filter(r=>ni.has(r.id)&&!r.resolved).length,ri=[...le.filter(r=>r.resolved).map(r=>`.${rt} .cmt[data-comment="${CSS.escape(r.id)}"] { background: none; border-bottom-color: transparent; }`),...((B==null?void 0:B.comments)??[]).map(r=>`.${rt} .cmt[data-comment="${CSS.escape(r)}"] { background: rgba(232, 176, 40, .42); border-bottom-color: #C8901A; }`)].join(`
`),Pe=l.watermark,ii=jo(mt,h,P,F,E,Rr),He=r=>F({zoom:typeof r=="number"?Math.min(5,Math.max(.1,r)):r,..._?{}:{layout:"print"}}),Dn=S.useRef(te);return Dn.current=te,ra(tt,()=>Dn.current,r=>He(r),{min:.1,max:5}),e.jsxs("div",{className:`letter ${rt}${Jr?" painting":""}${he?" focus-mode":""}`,ref:et,children:[e.jsxs("style",{children:[Kn(b,l,`.${rt}`),Bn(),ri]}),e.jsx(to,{editor:P,body:h,styles:b,page:l,setPage:f,lang:d,setLang:p,view:E,setView:F,actions:mt,suite:ti,proofTools:e.jsx(Li,{editor:P,ai:t.ai,lang:d,notify:r=>t.notify(r)})}),he&&e.jsx("button",{type:"button",className:"focus-exit",onClick:En,children:n("letter.focusExit")}),e.jsxs("div",{className:"letter-body",children:[e.jsx(ia,{target:tt}),Ee&&!he&&e.jsx(so,{editor:h,onClose:()=>Bt.outline()}),e.jsxs("div",{className:"canvas",ref:tt,children:[(U==="find"||U==="replace")&&e.jsx(io,{editor:h,replace:U==="replace",onClose:()=>{O(null),h.commands.focus()}}),e.jsx("div",{className:"sizer",style:{width:_?_e*te:void 0,height:_?$r*te:void 0},children:e.jsxs("div",{ref:nt,className:`sheet ${_?"print-layout":"web-layout"}${E.marks?" show-marks":""}${l.hyphenate?" hyphenate":""}${l.lineNumbers?` ln ln-${l.lineNumbers}`:""}${bn?"":" no-markup"}`,style:Zr,dir:l.rtl?"rtl":void 0,children:[_&&Array.from({length:Q.pages},(r,s)=>e.jsxs("div",{className:"page-frame",style:{top:`calc(${s} * (var(--ph) + var(--pg-gap)))`,background:l.color??void 0},children:[l.border&&e.jsx("div",{className:"page-border",style:{inset:`${l.border.space}pt`,border:`${l.border.w}pt solid ${l.border.color}`}}),Pe&&e.jsx(dr,{text:Pe.text,color:Pe.color})]},s)),!_&&Pe&&e.jsx(dr,{text:Pe.text,color:Pe.color}),e.jsx("div",{className:"hf header-area",style:{"--pn":'"1"'},"data-label":n("letter.header"),children:e.jsx(Jt,{editor:z})}),e.jsxs("div",{className:"body-area",children:[e.jsx(Jt,{editor:h}),!_&&!!(B!=null&&B.footnotes.length)&&e.jsx(wo,{notes:B.footnotes}),e.jsxs("div",{className:"tail",style:_?{height:`calc(${Q.tail}px - var(--pg-slack, 0px))`}:void 0,children:[_&&Q.notes.length>0&&e.jsx(ko,{notes:Q.notes}),e.jsx("div",{className:"hf footer-area",style:{"--pn":`"${Q.pages}"`},"data-label":n("letter.footer"),children:e.jsx(Jt,{editor:V})})]})]})]})})]}),Mt&&!he&&e.jsx(go,{editor:h,comments:le,onChange:zt,author:()=>ft(),editing:Tr,setEditing:Lt,showResolved:!1,onClose:()=>Me(!1)}),e.jsx(Di,{editor:P}),qe&&!he&&e.jsx(Ki,{host:Sa(h,Z,fe),ai:t.ai,start:Nt,onClose:()=>{pe(!1),h.commands.focus()}})]}),e.jsxs("footer",{className:"status",children:[e.jsx("span",{children:_?n("letter.pageOf",{n:qr,total:Q.pages}):n("letter.webLayout")}),e.jsx("button",{type:"button",className:"status-btn",onClick:()=>O("count"),children:$t===1?n("letter.word"):n("letter.words",{n:$t})}),$t>0&&e.jsx("span",{className:"status-read",children:n("letter.minutesRead",{n:ei})}),u&&e.jsxs("span",{className:"status-live",children:[e.jsx("i",{}),n("letter.listening")]}),yn&&e.jsx("button",{type:"button",className:"status-btn status-track",onClick:Re.track,children:n("letter.trackStatus")}),Ln>0&&!Mt&&e.jsxs("button",{type:"button",className:"status-btn",onClick:()=>Me(!0),children:[e.jsx(Ce,{name:"comment"})," ",Ln]}),e.jsxs("span",{className:"status-file",title:m||`${Z}.docx`,children:[m||`${Z}.docx`,x&&v?" •":""]}),e.jsxs("span",{className:"status-zoom",children:[e.jsx("button",{type:"button","aria-label":n("letter.zoomOut"),title:n("letter.zoomOut"),onClick:()=>He(Math.round((te-.1)*10)/10),children:"−"}),e.jsx("input",{type:"range",min:10,max:300,step:5,value:Mn,"aria-label":n("letter.zoom"),onChange:r=>He(Number(r.target.value)/100)}),e.jsx("button",{type:"button","aria-label":n("letter.zoomIn"),title:n("letter.zoomIn"),onClick:()=>He(Math.round((te+.1)*10)/10),children:"+"}),e.jsxs("span",{className:"pct",children:[Mn,"%"]}),e.jsx("button",{type:"button",className:"fit","aria-label":n("ui.fitAll"),title:n("ui.fitAll"),onClick:()=>He("page"),children:e.jsx(Ce,{name:"onepage",size:13})})]})]}),U==="file"&&e.jsx(Yi,{fileName:m||`${Z}.docx`,onClose:()=>O(null),onNew:()=>t.openModule("letter"),onOpen:async()=>{const r=await t.openFile(sn);r&&st(r)},onSave:()=>void lt(),onPrint:ot,saveChoices:[{id:"docx",icon:"save",label:n("letter.format.docx"),hint:".docx"},{id:"pdf",icon:"pdf",label:"PDF",hint:n("letter.format.pdfHint")},{id:"html",icon:"web",label:n("letter.format.html"),hint:".html"},{id:"txt",icon:"left",label:n("letter.format.txt"),hint:".txt"}],onSaveAs:Vr,listRecent:t.recent.list,onOpenRecent:r=>void _r(r)}),U==="count"&&e.jsx(ao,{editor:h,pages:Q.pages,onClose:()=>O(null)}),U==="margins"&&e.jsx(oo,{page:l,onApply:f,onClose:()=>O(null)}),U==="fill"&&e.jsx(mo,{editor:h,onClose:()=>{O(null),h.commands.focus()},onDone:r=>t.notify(r?n("letter.docs.filled",{n:r}):n("letter.docs.noFields"))}),U==="profile"&&e.jsx(po,{onClose:()=>O(null)}),(U==="source"||U==="sourceAi")&&e.jsx(ho,{shell:t,aiFirst:U==="sourceAi",onClose:()=>{O(null),h.commands.focus()},onDone:r=>{setTimeout(()=>mt.cite(r))}}),U==="commands"&&e.jsx(lo,{commands:ii,onClose:()=>{O(null),P==null||P.commands.focus()}})]})}function jo(t,a,o,i,l,f){const b=()=>o.chain().focus(),c={home:n("letter.tab.home"),insert:n("letter.tab.insert"),design:n("letter.tab.design"),layout:n("letter.tab.layout"),review:n("letter.tab.review"),view:n("letter.tab.view"),smart:n("letter.tab.smart"),docs:n("letter.tab.docs"),oi1:"Office In 1",file:n("letter.tab.file"),table:n("letter.tab.table")},d=(p,m,w,v,C,x,y)=>({id:p,label:m,group:w,run:()=>{v()},icon:C,keys:x,disabled:y});return[d("save",n("letter.save"),c.file,()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"s",ctrlKey:!0})),"save","Ctrl+S"),d("file",n("letter.tab.file"),c.file,t.fileMenu,"open"),d("pdf",n("letter.savePdf"),c.file,t.pdf,"pdf","Ctrl+P"),d("share",n("letter.share"),c.oi1,t.share,"share"),d("bold",n("letter.bold"),c.home,()=>b().toggleBold().run(),void 0,"Ctrl+B"),d("italic",n("letter.italic"),c.home,()=>b().toggleItalic().run(),void 0,"Ctrl+I"),d("underline",n("letter.underline"),c.home,()=>b().toggleUnderline().run(),void 0,"Ctrl+U"),d("strike",n("letter.strike"),c.home,()=>b().toggleStrike().run()),d("bullets",n("letter.bullets"),c.home,()=>b().toggleBulletList().run(),"bullets"),d("numbers",n("letter.numbers"),c.home,()=>b().toggleOrderedList().run(),"numbers"),d("left",n("letter.alignLeft"),c.home,()=>b().setTextAlign("left").run(),"left"),d("center",n("letter.alignCenter"),c.home,()=>b().setTextAlign("center").run(),"center"),d("right",n("letter.alignRight"),c.home,()=>b().setTextAlign("right").run(),"right"),d("justify",n("letter.justify"),c.home,()=>b().setTextAlign("justify").run(),"justify"),d("h1",n("letter.heading1"),c.home,()=>b().setHeading({level:1}).run()),d("h2",n("letter.heading2"),c.home,()=>b().setHeading({level:2}).run()),d("h3",n("letter.heading3"),c.home,()=>b().setHeading({level:3}).run()),d("clear",n("letter.clearFormatting"),c.home,()=>b().unsetAllMarks().run(),"clear"),d("find",n("letter.find"),c.home,()=>t.find(!1),"find","Ctrl+F"),d("replace",n("letter.replace"),c.home,()=>t.find(!0),"replace","Ctrl+H"),d("dictate",n("letter.dictate"),c.home,t.dictate,"mic"),d("table",n("letter.table"),c.insert,()=>b().insertTable({rows:3,cols:3,withHeaderRow:!1}).run(),"table"),d("fromClass",n("letter.fromSheetFile"),c.insert,()=>t.insertFromSheet(null),"sheet"),d("image",n("letter.image"),c.insert,t.image,"image"),d("link",n("letter.link"),c.insert,t.link,"link"),d("pagebreak",n("letter.pageBreak"),c.insert,()=>a.chain().focus().setPageBreak().run(),"pagebreak","Ctrl+Enter"),d("toc",n("letter.toc"),c.insert,t.toc,"toc"),d("note",`${n("letter.callout")}: ${n("letter.callout.note")}`,c.insert,()=>t.callout("note"),"callout"),d("tip",`${n("letter.callout")}: ${n("letter.callout.tip")}`,c.insert,()=>t.callout("tip"),"callout"),d("warning",`${n("letter.callout")}: ${n("letter.callout.warning")}`,c.insert,()=>t.callout("warning"),"callout"),d("letterBlock",n("letter.letterBlock.full"),c.insert,()=>t.letterBlock("full"),"envelope"),d("closing",n("letter.letterBlock.closing"),c.insert,()=>t.letterBlock("closing"),"signature"),...[...pn,...fn].map(p=>d(`doc-${p.id}`,p.title[X()],c.docs,()=>t.docTemplate(p.id),p.cat==="cv"?"cv":"envelope")),d("docFill",n("letter.docs.fill"),c.docs,t.fillFields,"fill"),d("docNext",n("letter.docs.nextField"),c.docs,t.nextField,"next"),d("docProfile",n("letter.docs.profile"),c.docs,t.profile,"user"),d("docAiWrite",n("letter.docs.aiWrite"),c.docs,()=>t.docAi("docWrite"),"sparkle"),d("qr",n("letter.qr"),c.insert,t.qr,"qr"),d("header",n("letter.header"),c.insert,t.header,"header"),d("footer",n("letter.footer"),c.insert,t.footer,"footer"),d("pagenum",n("letter.pageNumber.bottomTotal"),c.insert,()=>t.pageNumber("bottom",n("letter.pageXofY"),"center"),"pagenum"),d("date",n("letter.date"),c.insert,()=>b().insertContent(new Date().toLocaleDateString(void 0,{dateStyle:"long"})).run(),"date"),...Qe.map(p=>d(`theme-${p.id}`,`${n("letter.group.themes")}: ${n(p.name)}`,c.design,()=>t.theme(p),"theme")),d("margins",n("letter.margins.custom"),c.layout,t.customMargins,"margins"),d("count",n("letter.wordCount"),c.review,t.wordCount,"count"),d("newComment",n("letter.commentNew"),c.review,t.newComment,"commentnew","Ctrl+Alt+M"),d("comments",n("letter.commentsShow"),c.review,t.toggleComments,"comment"),d("track",n("letter.track"),c.review,t.track,"track","Ctrl+Shift+E"),d("acceptAll",n("letter.acceptAll"),c.review,()=>t.accept(!0),"accept"),d("rejectAll",n("letter.rejectAll"),c.review,()=>t.reject(!0),"reject"),d("nextChange",n("letter.changeNext"),c.review,()=>t.change(1),"next"),d("footnote",n("letter.footnoteInsert"),n("letter.tab.references"),t.footnote,"footnote","Ctrl+Alt+F"),d("read",n("letter.readAloud"),c.review,t.readAloud,"speak"),d("outline",n("letter.outline"),c.view,t.outline,"outline"),d("focus",n("letter.focus"),c.view,t.focus,"focus"),d("marks",n("letter.showMarks"),c.view,()=>i({marks:!l.marks}),"marks"),d("web",n("letter.webLayout"),c.view,()=>i({layout:"web"}),"web"),d("print",n("letter.printLayout"),c.view,()=>i({layout:"print"}),"print"),d("cleanAll",n("letter.cleanUp.all"),c.smart,()=>t.cleanUp("all"),"clean"),d("quotes",n("letter.cleanUp.quotes"),c.smart,()=>t.cleanUp("quotes"),"clean"),d("sortAZ",n("letter.sortAZ"),c.smart,()=>t.sort(1),"sort"),d("sortZA",n("letter.sortZA"),c.smart,()=>t.sort(-1),"sort"),d("textToTable",n("letter.textToTable"),c.smart,t.textToTable,"texttable"),d("tableToText",n("letter.tableToText"),c.table,t.tableToText,"texttable",void 0,!f),d("editInClass",n("letter.editInClass"),c.oi1,t.editInClass,"sheet",void 0,!f),d("newSheet",n("letter.newSheet"),c.oi1,t.newSheet,"sheet"),d("makeSlides",n("letter.makeSlides"),c.oi1,t.makeSlides,"stage"),d("prodfos",n("letter.openProdfos"),c.oi1,()=>t.openApp("prodfos"),"prodfos")]}function dr({text:t,color:a}){return e.jsx("div",{className:"watermark","aria-hidden":"true",children:e.jsx("span",{style:{color:a,fontSize:`${Math.max(36,Math.min(120,900/Math.max(t.length,1)))}pt`},children:t})})}function ko({notes:t}){const a=S.useRef(null);return S.useLayoutEffect(()=>{var o;(o=a.current)==null||o.replaceChildren(Ji(t))},[t]),e.jsx("div",{ref:a,className:"doc-text tail-notes"})}function wo({notes:t}){return e.jsx("div",{className:"doc-text notes-end","aria-label":n("letter.footnotes"),children:t.map(a=>e.jsxs("div",{className:"fn-note",children:[e.jsx("sup",{children:a.n})," ",a.text]},a.n))})}const Do={id:"letter",extensions:sn,mount(t,a,o,i){const l=ui.createRoot(t);return l.render(e.jsx(vo,{shell:a,file:o,handoff:i})),{unmount:()=>l.unmount()}}};export{Do as default};
