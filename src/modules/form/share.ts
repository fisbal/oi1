// A form to send to people: one HTML file that opens in any browser, on any phone, with no account and no server.
// The person fills it in; the page checks the answers and gives an answer code to send back (e-mail, message, copy).
// In 1 Form reads the codes back ("Import answers") into the results. Everything the person typed is shown with
// textContent only, and the form itself travels as JSON with "<" escaped, so nothing in it can run as code.

import type { Form } from './model';
import { formKey } from './model';
import type { FormTheme } from './templates';

export interface ShareWords {
  send: string; required: string; email: string; phone: string; url: string; number: string; rows: string;
  thanks: string; code: string; copy: string; copied: string; mail: string; yes: string; no: string; other: string;
  agree: string[]; pick: string; score: string; first: string; last: string; street: string; city: string; zip: string; country: string; made: string;
}

export function shareHtml(form: Form, theme: FormTheme, words: ShareWords, lang: string, mailTo = ''): string {
  const data = JSON.stringify({ key: formKey(form), form: { ...form, replies: [] }, theme, words, mailTo }).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, ' ');
  const title = form.title.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return `<!doctype html>
<html lang="${lang.replace(/[^a-z-]/gi, '')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<title>${title}</title>
<style>
*{box-sizing:border-box}body{margin:0;font:16px/1.45 ${JSON.stringify(form.font).slice(1, -1).replace(/[^\w ,-]/g, '')},Inter,Arial,sans-serif;background:${theme.page};color:#222}
main{max-width:720px;margin:0 auto;padding:16px}.head{border-radius:14px;padding:22px;background:${theme.head};color:${theme.ink ?? '#fff'};margin-bottom:12px}
.head h1{margin:0 0 6px;font-size:26px;overflow-wrap:anywhere}.head p{margin:0;white-space:pre-wrap}
.q{background:#fff;border-radius:12px;padding:16px;margin:10px 0;box-shadow:0 1px 3px rgba(0,0,0,.08);border-left:4px solid transparent}
.q.bad{border-left-color:#D32F2F}.q h2{font-size:16px;margin:0 0 4px;overflow-wrap:anywhere}.q .req{color:#D32F2F}.q small{display:block;color:#666;margin-bottom:8px}
.sec{background:transparent;box-shadow:none;padding:8px 4px}.sec h2{font-size:20px;color:${theme.accent}}
input[type=text],input[type=email],input[type=tel],input[type=url],input[type=number],input[type=date],input[type=time],textarea,select{width:100%;padding:10px;border:1px solid #bbb;border-radius:8px;font:inherit;background:#fff}
label.o{display:flex;gap:10px;align-items:center;padding:8px 6px;border-radius:8px;cursor:pointer}label.o:hover{background:#f3f3f3}
input[type=radio],input[type=checkbox]{width:20px;height:20px;accent-color:${theme.accent}}
.stars button,.nums button{font:inherit;border:1px solid #ccc;background:#fff;border-radius:8px;min-width:40px;min-height:40px;margin:2px;cursor:pointer}
.stars button{font-size:24px;border:0;background:none;color:#ccc}.stars button.on{color:#FFB300}.nums button.on{background:${theme.accent};color:#fff;border-color:${theme.accent}}
.nums{display:flex;flex-wrap:wrap}.ends{display:flex;justify-content:space-between;color:#666;font-size:13px}
table{border-collapse:collapse;width:100%}td,th{padding:6px;text-align:center;font-size:14px}th:first-child,td:first-child{text-align:left}
.rank li{display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #ddd;border-radius:8px;margin:4px 0;background:#fafafa}.rank li span{flex:1}
.rank button{border:1px solid #ccc;background:#fff;border-radius:6px;min-width:36px;min-height:36px;cursor:pointer}
.err{color:#D32F2F;font-size:14px;margin-top:6px}.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.send{display:block;width:100%;margin:16px 0;padding:14px;border:0;border-radius:10px;background:${theme.accent};color:#fff;font:600 17px/1 inherit;cursor:pointer}
.done{background:#fff;border-radius:12px;padding:18px}.done textarea{font:12px monospace;height:90px}.done .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.done .row a,.done .row button{flex:1;text-align:center;padding:12px;border-radius:8px;border:0;background:${theme.accent};color:#fff;font:inherit;text-decoration:none;cursor:pointer}
.bar{position:sticky;top:0;height:5px;background:#ddd;border-radius:3px;overflow:hidden}.bar i{display:block;height:100%;background:${theme.accent};width:0}
footer{text-align:center;color:#888;font-size:12px;margin:20px 0}
@media (max-width:480px){.two{grid-template-columns:1fr}main{padding:10px}}
</style></head><body><main id="app"></main>
<script id="data" type="application/json">${data}</script>
<script>
(function(){
var D=JSON.parse(document.getElementById('data').textContent),F=D.form,W=D.words,A={},app=document.getElementById('app');
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
function empty(a){return a==null||a===''||(Array.isArray(a)&&!a.length)||(typeof a==='object'&&!Array.isArray(a)&&!Object.keys(a).some(function(k){return a[k]}))}
function prob(q){var a=A[q.id];if(q.type==='section')return'';if(empty(a))return q.required?W.required:'';if(q.type==='consent'&&q.required&&a!=='yes')return W.required;var s=typeof a==='string'?a.trim():'';
if(q.type==='email'&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(s))return W.email;if(q.type==='phone'&&!/^[+()\\d][\\d\\s().-]{5,}$/.test(s))return W.phone;
if(q.type==='url'&&!/^(https?:\\/\\/)?[\\w-]+(\\.[\\w-]+)+(\\/\\S*)?$/i.test(s))return W.url;if(q.type==='number'&&!isFinite(Number(String(a).replace(',','.'))))return W.number;
if(q.type==='matrix'&&q.required&&q.rows.some(function(r){return!a[r]}))return W.rows;return''}
var head=el('div','head');head.appendChild(el('h1',null,F.title));if(F.description)head.appendChild(el('p',null,F.description));app.appendChild(head);
var bar=el('div','bar'),bi=el('i');bar.appendChild(bi);if(F.progress)app.appendChild(bar);
var form=el('form');form.noValidate=true;app.appendChild(form);var boxes={};
function upd(){var qs=F.questions.filter(function(q){return q.type!=='section'});var n=qs.filter(function(q){return!empty(A[q.id])}).length;bi.style.width=(qs.length?Math.round(n*100/qs.length):0)+'%'}
function set(q,v){A[q.id]=v;upd();var b=boxes[q.id];if(b&&b.classList.contains('bad')&&!prob(q)){b.classList.remove('bad');var e=b.querySelector('.err');if(e)e.remove()}}
function input(q,type){var i=el('input');i.type=type;i.setAttribute('aria-label',q.title);i.oninput=function(){set(q,i.value)};return i}
function nums(q,from,to){var w=el('div','nums');for(var n=from;n<=to;n++)(function(n){var b=el('button',null,String(n));b.type='button';b.onclick=function(){set(q,n);[].forEach.call(w.children,function(c){c.classList.toggle('on',c===b)})};w.appendChild(b)})(n);return w}
F.questions.forEach(function(q){
  var box=el('div','q'+(q.type==='section'?' sec':''));boxes[q.id]=box;var h=el('h2',null,q.title);if(q.required){h.appendChild(document.createTextNode(' '));h.appendChild(el('span','req','*'))}box.appendChild(h);
  if(q.help)box.appendChild(el('small',null,q.help));var t=q.type;
  if(t==='short')box.appendChild(input(q,'text'));else if(t==='email')box.appendChild(input(q,'email'));else if(t==='phone')box.appendChild(input(q,'tel'));
  else if(t==='url')box.appendChild(input(q,'url'));else if(t==='number')box.appendChild(input(q,'number'));else if(t==='date')box.appendChild(input(q,'date'));else if(t==='time')box.appendChild(input(q,'time'));
  else if(t==='long'){var ta=el('textarea');ta.rows=4;ta.setAttribute('aria-label',q.title);ta.oninput=function(){set(q,ta.value)};box.appendChild(ta)}
  else if(t==='choice'||t==='checks'||t==='yesno'||t==='consent'){var opts=t==='yesno'?[['yes',W.yes],['no',W.no]]:t==='consent'?[['yes',W.agree[0]]]:q.options.map(function(o){return[o,o]});
    if(q.other&&t!=='yesno'&&t!=='consent')opts.push(['__other',W.other]);var multi=t==='checks'||t==='consent';
    opts.forEach(function(o){var l=el('label','o'),i=el('input');i.type=multi?'checkbox':'radio';i.name=q.id;i.value=o[0];l.appendChild(i);l.appendChild(el('span',null,o[1]));
      i.onchange=function(){var all=[].slice.call(box.querySelectorAll('input[name="'+q.id+'"]:checked')).map(function(x){return x.value==='__other'?(box.querySelector('.oth').value||W.other):x.value});set(q,t==='consent'?(all.length?'yes':''):multi?all:all[0]||'')};box.appendChild(l)});
    if(q.other&&t!=='yesno'&&t!=='consent'){var ot=el('input','oth');ot.type='text';ot.setAttribute('aria-label',W.other);ot.oninput=function(){var c=box.querySelector('input[value="__other"]');c.checked=!!ot.value||c.checked;c.onchange()};box.appendChild(ot)}}
  else if(t==='dropdown'){var s=el('select');s.setAttribute('aria-label',q.title);s.appendChild(el('option',null,W.pick)).value='';q.options.forEach(function(o){s.appendChild(el('option',null,o)).value=o});s.onchange=function(){set(q,s.value)};box.appendChild(s)}
  else if(t==='rating'){var w=el('div','stars');for(var n=1;n<=Math.max(3,Math.min(10,q.max));n++)(function(n){var b=el('button',null,'★');b.type='button';b.setAttribute('aria-label',String(n));b.onclick=function(){set(q,n);[].forEach.call(w.children,function(c,i){c.classList.toggle('on',i<n)})};w.appendChild(b)})(n);box.appendChild(w)}
  else if(t==='scale'||t==='nps'){box.appendChild(nums(q,q.min,q.max));if(q.lowLabel||q.highLabel){var e=el('div','ends');e.appendChild(el('span',null,q.lowLabel));e.appendChild(el('span',null,q.highLabel));box.appendChild(e)}}
  else if(t==='likert'){W.agree.slice(1).forEach(function(lbl,i){var l=el('label','o'),r=el('input');r.type='radio';r.name=q.id;r.onchange=function(){set(q,String(5-i))};l.appendChild(r);l.appendChild(el('span',null,lbl));box.appendChild(l)})}
  else if(t==='slider'){var r=el('input'),out=el('b',null,'');r.type='range';r.min=q.min;r.max=q.max;r.style.width='100%';r.setAttribute('aria-label',q.title);r.oninput=function(){out.textContent=r.value;set(q,Number(r.value))};box.appendChild(r);box.appendChild(out)}
  else if(t==='ranking'){var ol=el('ol','rank'),cur=q.options.slice();function draw(){ol.textContent='';cur.forEach(function(o,i){var li=el('li');li.appendChild(el('span',null,o));['↑','↓'].forEach(function(arw,d){var b=el('button',null,arw);b.type='button';b.setAttribute('aria-label',arw);b.onclick=function(){var j=d?i+1:i-1;if(j<0||j>=cur.length)return;var x=cur[i];cur[i]=cur[j];cur[j]=x;set(q,cur.slice());draw()};li.appendChild(b)});ol.appendChild(li)})}draw();box.appendChild(ol)}
  else if(t==='matrix'){var tb=el('table'),tr=el('tr');tr.appendChild(el('th'));q.options.forEach(function(o){tr.appendChild(el('th',null,o))});tb.appendChild(tr);var val={};
    q.rows.forEach(function(rw){var r2=el('tr');r2.appendChild(el('td',null,rw));q.options.forEach(function(o){var c=el('td'),i=el('input');i.type='radio';i.name=q.id+'|'+rw;i.setAttribute('aria-label',rw+': '+o);i.onchange=function(){val[rw]=o;set(q,Object.assign({},val))};c.appendChild(i);r2.appendChild(c)});tb.appendChild(r2)});box.appendChild(tb)}
  else if(t==='name'||t==='address'){var parts=t==='name'?[['first',W.first],['last',W.last]]:[['street',W.street],['city',W.city],['zip',W.zip],['country',W.country]],g=el('div','two'),v={};
    parts.forEach(function(p){var i=el('input');i.type='text';i.placeholder=p[1];i.setAttribute('aria-label',p[1]);i.oninput=function(){v[p[0]]=i.value;set(q,Object.assign({},v))};g.appendChild(i)});box.appendChild(g)}
  form.appendChild(box)});
var send=el('button','send',W.send);send.type='submit';form.appendChild(send);
form.onsubmit=function(e){e.preventDefault();var first=null;F.questions.forEach(function(q){var b=boxes[q.id],p=prob(q),old=b.querySelector('.err');if(old)old.remove();b.classList.toggle('bad',!!p);if(p){b.appendChild(el('div','err',p));if(!first)first=b}});
  if(first){first.scrollIntoView({behavior:'smooth',block:'center'});return}
  var json=JSON.stringify({f:D.key,a:A,t:new Date().toISOString()}),code='OI1F:'+btoa(unescape(encodeURIComponent(json)));
  app.textContent='';var d=el('div','done');d.appendChild(el('h2',null,F.thanks||W.thanks));
  if(F.quiz){var got=0,tot=0;F.questions.forEach(function(q){if(!q.correct||!q.correct.length||q.type==='section')return;tot+=q.points;var a=A[q.id],f=function(s){return String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase()};
    if(Array.isArray(a)){if(a.length===q.correct.length&&a.every(function(x){return q.correct.indexOf(x)>=0}))got+=q.points}else if(a!=null&&q.correct.map(f).indexOf(f(a))>=0)got+=q.points});d.appendChild(el('p',null,W.score.replace('{got}',got).replace('{total}',tot)))}
  d.appendChild(el('p',null,W.code));var ta=el('textarea');ta.readOnly=true;ta.value=code;ta.setAttribute('aria-label',W.code);d.appendChild(ta);var row=el('div','row');
  var cp=el('button',null,W.copy);cp.type='button';cp.onclick=function(){ta.select();try{navigator.clipboard.writeText(code)}catch(x){document.execCommand('copy')}cp.textContent=W.copied};row.appendChild(cp);
  var m=el('a',null,W.mail);m.href='mailto:'+encodeURIComponent(D.mailTo||'')+'?subject='+encodeURIComponent(F.title)+'&body='+encodeURIComponent(code);row.appendChild(m);d.appendChild(row);app.appendChild(d);window.scrollTo(0,0)};
var foot=el('footer',null,W.made);document.body.appendChild(foot);upd();
})();
</script></body></html>`;
}
