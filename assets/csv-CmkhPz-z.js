function a(l,i){const s=l.replace(/^﻿/,""),e=i??p(s),u=[];let r=[],t="",c=!1;for(let o=0;o<s.length;o++){const n=s[o];c?n==='"'?s[o+1]==='"'?(t+='"',o++):c=!1:t+=n:n==='"'&&t===""?c=!0:n===e?(r.push(t),t=""):n===`
`||n==="\r"?(n==="\r"&&s[o+1]===`
`&&o++,r.push(t),u.push(r),r=[],t=""):t+=n}return(t!==""||r.length)&&(r.push(t),u.push(r)),u}function p(l){const i=l.split(/\r?\n/,5).join(`
`),s=["	",";",","].map(e=>[e,i.split(e).length-1]).sort((e,u)=>u[1]-e[1]);return s[0][1]>0?s[0][0]:","}function f(l,i=","){const s=e=>/["\r\n]/.test(e)||e.includes(i)||/^\s|\s$/.test(e)?`"${e.replace(/"/g,'""')}"`:e;return l.map(e=>e.map(s).join(i)).join(`\r
`)}export{a as parseCsv,f as toCsv};
