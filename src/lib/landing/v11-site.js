// @ts-nocheck
// Startseite v11, Verhalten 1:1 aus der Designer-Lieferung (website-v11.js).
// Tabula Website v10 — Verhalten aus Tabula-SaaS-Studio_final.html
window.SbSiteInit = function () {
  const run = document.getElementById('run');
  if (!run || run.dataset.bound) return;
  run.dataset.bound = '1';
  const q = document.getElementById('query');
  if (q && !q.value) q.value = 'SELECT title, year\nFROM books\nWHERE year > 2010\nORDER BY year;';
  (() => {
    const pre = document.querySelector('.code-hl'), nums = document.querySelector('.code-input .line-numbers');
    if (!q || !pre) return;
    const KW = /^(SELECT|FROM|WHERE|ORDER|GROUP|BY|HAVING|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ASC|DESC|LIMIT|OFFSET|DISTINCT|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END|UNION|ALL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|PRIMARY|KEY|FOREIGN|REFERENCES)$/i;
    const FN = /^(COUNT|SUM|AVG|MIN|MAX|COALESCE|ROUND|LOWER|UPPER|LENGTH)$/i;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const hl = src => src.replace(/(--[^\n]*)|('(?:[^']|'')*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([<>=!]=?|<>|[*,;().+\-\/])|([^])/g, (m, c, s, n, w, o) => {
      if (c) return '<span class="c">' + esc(c) + '</span>';
      if (s) return '<span class="s">' + esc(s) + '</span>';
      if (n) return '<span class="n">' + n + '</span>';
      if (w) return KW.test(w) ? '<span class="k">' + w + '</span>' : FN.test(w) ? '<span class="f">' + w + '</span>' : w;
      if (o) return '<span class="o">' + esc(o) + '</span>';
      return esc(m);
    });
    const sync = () => {
      pre.innerHTML = hl(q.value) + '\n';
      const lines = Math.max(4, q.value.split('\n').length);
      if (nums) nums.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
      pre.scrollTop = q.scrollTop; pre.scrollLeft = q.scrollLeft;
    };
    q.addEventListener('input', sync);
    q.addEventListener('scroll', () => { pre.scrollTop = q.scrollTop; pre.scrollLeft = q.scrollLeft; });
    sync();
  })();

(()=>{
const root=document.documentElement,query=document.getElementById('query'),button=document.getElementById('run'),feedback=document.getElementById('feedback');
const books=[{title:'Refactoring',year:2018},{title:'Clean Code',year:2008},{title:'Database Internals',year:2019},{title:'The Pragmatic Programmer',year:1999},{title:'Designing Data-Intensive Apps',year:2017}];
const text=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function execute(){
 const sql=query.value.trim().replace(/;\s*$/,'').replace(/\s+/g,' ');
 const match=/^SELECT\s+(\*|(?:title|year)(?:\s*,\s*(?:title|year))?)\s+FROM\s+books(?:\s+WHERE\s+year\s*(>=|<=|<>|!=|=|>|<)\s*(\d{1,4}))?(?:\s+ORDER\s+BY\s+year(?:\s+(ASC|DESC))?)?$/i.exec(sql);
 feedback.hidden=false;
 if(!match){feedback.className='feedback error';feedback.textContent='Diese Demo versteht SELECT title, year FROM books, optional WHERE year > 2010 und ORDER BY year. Prüfe die Schreibweise.';document.getElementById('result-count').textContent='Abfrage prüfen';query.setAttribute('aria-invalid','true');return;}
 query.removeAttribute('aria-invalid');let rows=books.slice();const columns=match[1]==='*'?['title','year']:match[1].toLowerCase().split(',').map(s=>s.trim());
 if(match[2]){const year=Number(match[3]);const compare={'>':v=>v>year,'<':v=>v<year,'>=':v=>v>=year,'<=':v=>v<=year,'=':v=>v===year,'<>':v=>v!==year,'!=':v=>v!==year};rows=rows.filter(b=>compare[match[2]](b.year));}
 if(/ORDER BY/i.test(sql))rows.sort((a,b)=>(a.year-b.year)*(match[4]?.toUpperCase()==='DESC'?-1:1));
 document.getElementById('result-count').textContent=rows.length+' '+(rows.length===1?'Zeile':'Zeilen')+' · Demo';
 document.getElementById('result-content').innerHTML=rows.length?'<table><thead><tr>'+columns.map(c=>'<th>'+text(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+columns.map(c=>'<td>'+text(row[c])+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<div class="result-empty">Keine Bücher passen zu dieser Bedingung.</div>';
 const correct=columns.length===2&&columns[0]==='title'&&columns[1]==='year'&&rows.length===3&&rows.map(r=>r.year).join(',')==='2017,2018,2019';feedback.className='feedback';feedback.textContent=correct?'✓ Richtig gelöst. Titel, Jahre und Reihenfolge stimmen.':rows.length?'✓ Abfrage ausgeführt. Vergleiche dein Ergebnis mit der Aufgabe.':'✓ Abfrage ausgeführt. Ein leeres Ergebnis ist kein SQL-Fehler.';
 button.textContent='↻ Erneut ausführen';
}
button.addEventListener('click',execute);query.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();execute();}});
document.getElementById('hint-toggle').addEventListener('click',event=>{const panel=document.getElementById('hint');panel.hidden=!panel.hidden;event.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));});
document.querySelector('.theme').addEventListener('click',event=>{const dark=root.dataset.theme!=='dark';root.dataset.theme=dark?'dark':'light';event.currentTarget.setAttribute('aria-pressed',String(dark));event.currentTarget.setAttribute('aria-label',dark?'Light Mode aktivieren':'Dark Mode aktivieren');});
const dialog=document.getElementById('teacher-dialog'),teacherInfo=document.getElementById('teacher-info');if(dialog&&teacherInfo)teacherInfo.addEventListener('click',()=>dialog.showModal());
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
if(!reduced.matches&&'IntersectionObserver' in window){root.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));}
reduced.addEventListener('change',event=>{if(event.matches)root.classList.remove('motion-ready');});
})();


(()=>{
const graphic=document.querySelector('.motion-hero'),stage=graphic.querySelector('.motion-stage'),buttons=[...graphic.querySelectorAll('[data-motion-step]')],pause=document.createElement('button');
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
let step=0,timer=null,typing=null,paused=false,visible=true,previousCode='';
const queries=['SELECT title, year\nFROM books;','WHERE year > 2010','ORDER BY year ASC','✓ 3 passende Bücher'];
function stop(){clearTimeout(timer);clearTimeout(typing);timer=null;typing=null;graphic.querySelector('.motion-query-code').textContent=queries[step];}
function typeQuery(value){clearTimeout(typing);const target=graphic.querySelector('.motion-query-code');if(reduce.matches||paused){target.textContent=value;return;}let index=0;target.textContent='';function next(){target.textContent=value.slice(0,++index);if(index<value.length)typing=setTimeout(next,25);}next();}
function render(value){step=value;graphic.dataset.step=String(step);graphic.querySelector('.motion-status').textContent='0'+(step+1)+' / 04';buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===step)));if(previousCode!==queries[step]){previousCode=queries[step];typeQuery(queries[step]);}}
function start(){clearTimeout(timer);if(paused||reduce.matches||!visible||document.hidden)return;timer=setTimeout(()=>{render((step+1)%4);start();},3000);}
function updatePause(){graphic.dataset.paused=String(paused||reduce.matches||!visible||document.hidden);pause.setAttribute('aria-pressed',String(paused||reduce.matches));pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'Animation abspielen':'Animation pausieren');pause.disabled=reduce.matches;if(reduce.matches)pause.setAttribute('aria-label','Reduzierte Bewegung aktiviert');}
function connect(){const box=stage.getBoundingClientRect();if(!box.width||!box.height)return;graphic.querySelector('.motion-wires').setAttribute('viewBox','0 0 '+box.width+' '+box.height);const source=graphic.querySelector('.motion-source').getBoundingClientRect(),query=graphic.querySelector('.motion-query').getBoundingClientRect(),result=graphic.querySelector('.motion-output').getBoundingClientRect();const x1=source.right-box.left,y1=source.top-box.top+55,x2=query.left-box.left,y2=query.top-box.top+query.height/2;const a='M '+x1+' '+y1+' C '+(x1+22)+' '+y1+' '+(x2-22)+' '+y2+' '+x2+' '+y2;const sx=query.left-box.left+query.width/2,sy=query.bottom-box.top,tx=result.left-box.left+result.width/2,ty=result.top-box.top;const b='M '+sx+' '+sy+' C '+sx+' '+(sy+35)+' '+tx+' '+(ty-35)+' '+tx+' '+ty;graphic.querySelectorAll('.wire-first').forEach(path=>path.setAttribute('d',a));graphic.querySelectorAll('.wire-second').forEach(path=>path.setAttribute('d',b));}
pause.addEventListener('click',()=>{paused=!paused;stop();updatePause();if(paused)graphic.querySelector('.motion-query-code').textContent=queries[step];else start();});
buttons.forEach((button,index)=>button.addEventListener('click',()=>{stop();render(index);start();}));
if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)stop();else start();updatePause();},{threshold:.15}).observe(graphic);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();updatePause();});
reduce.addEventListener('change',()=>{stop();if(reduce.matches)render(3);updatePause();start();});
stage.addEventListener('pointermove',event=>{if(!fine.matches||reduce.matches)return;const box=stage.getBoundingClientRect(),x=(event.clientX-box.left)/box.width-.5,y=(event.clientY-box.top)/box.height-.5;stage.style.setProperty('--motion-rx',(-y*3)+'deg');stage.style.setProperty('--motion-ry',(x*4)+'deg');});stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--motion-rx','0deg');stage.style.setProperty('--motion-ry','0deg');});
const wireResize=new ResizeObserver(connect);wireResize.observe(stage);wireResize.observe(graphic.querySelector('.motion-query'));render(reduce.matches?3:0);updatePause();start();requestAnimationFrame(connect);
document.getElementById('run').addEventListener('click',()=>{const studio=document.querySelector('.studio');studio.classList.remove('just-ran');void studio.offsetWidth;studio.classList.add('just-ran');document.querySelectorAll('#result-content tbody tr').forEach(row=>row.classList.add('result-arrive'));});
})();



(()=>{
const section=document.getElementById('zusammenhaenge'),pin=section.querySelector('.join-scroll-pin'),visual=section.querySelector('.join-demo-visual');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-height:560px)');
const buttons=[...section.querySelectorAll('[data-join-phase]')],activePaths=[...section.querySelectorAll('.join-wire-active')],basePaths=[...section.querySelectorAll('.join-wire-base')];
activePaths.forEach(path=>path.setAttribute('pathLength','1'));
let manual=0,override=false,scheduled=false,lastPhase=-1;
const clamp=x=>Math.max(0,Math.min(1,x));const phasePoints=[0,.5,1];
const copy=[['Daten stehen getrennt.','Die Bücher kennen nur die Nummer ihres Verlags. Der Name steht in einer zweiten Tabelle.','Zwei getrennte Tabellen'],['Der Schlüssel verbindet.','publisher_id im Buch passt zur id des Verlags. Dieselbe Verlagsnummer kann zu mehreren Büchern gehören.','Passende Schlüssel werden verbunden'],['Die Antwort steht zusammen.','Das Ergebnis enthält zu jedem Buch den passenden Verlagsnamen. Ein JOIN macht den Zusammenhang sichtbar.','Gemeinsames Ergebnis']];
function connectors(){const svg=section.querySelector('.join-scroll-wires'),box=svg.getBoundingClientRect();if(!box.width||!box.height)return;svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height);const left=[...section.querySelectorAll('.join-book-table .join-source-row b')],right=[...section.querySelectorAll('.join-publisher-table .join-source-row b')];left.forEach((key,i)=>{const from=key.getBoundingClientRect(),to=right[i===0?0:1].getBoundingClientRect();const x1=from.right-box.left,y1=from.top+from.height/2-box.top,x2=to.left-box.left,y2=to.top+to.height/2-box.top;const bend=(x2-x1)*.55;const d='M '+x1+' '+y1+' C '+(x1+bend)+' '+y1+' '+(x2-bend)+' '+y2+' '+x2+' '+y2;activePaths[i].setAttribute('d',d);basePaths[i].setAttribute('d',d);});}
function render(p){const ease=x=>x*x*(3-2*x),seg=(a,b)=>ease(clamp((p-a)/(b-a)));const lines=seg(.24,.42),result=seg(.58,.76),phase=p<.33?0:p<.67?1:2;visual.style.setProperty('--join-progress',p);visual.style.setProperty('--join-lines',lines);visual.style.setProperty('--join-keys',lines);visual.style.setProperty('--join-move',seg(.24,.42));visual.style.setProperty('--join-result',result);visual.dataset.joinProgress=p.toFixed(3);section.querySelector('.join-result-reveal').setAttribute('aria-hidden',String(result<.99));if(phase!==lastPhase){lastPhase=phase;visual.dataset.phase=String(phase);[section.querySelector('.join-story-step'),section.querySelector('.join-visual-label')].forEach(el=>{el.classList.remove('swap');void el.offsetWidth;el.classList.add('swap');});section.querySelector('.join-step-number').textContent='0'+(phase+1);section.querySelector('.join-step-title').textContent=copy[phase][0];section.querySelector('.join-step-copy').textContent=copy[phase][1];section.querySelector('.join-visual-label').textContent=copy[phase][2];section.querySelector('.join-component-counter').textContent='0'+(phase+1)+' / 03';buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===phase)));}connectors();}
function paint(){scheduled=false;if(reduced.matches||compact.matches||override)render(phasePoints[manual]);else{const range=Math.max(1,section.offsetHeight-pin.offsetHeight);render(clamp((89-section.getBoundingClientRect().top)/range));}}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(paint);}}
buttons.forEach((button,i)=>button.addEventListener('click',()=>{manual=i;override=true;paint();}));
document.addEventListener('scroll',schedule,{capture:true,passive:true});addEventListener('wheel',()=>{override=false;},{passive:true});addEventListener('touchmove',()=>{override=false;},{passive:true});addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))override=false;});
new ResizeObserver(schedule).observe(pin);addEventListener('resize',schedule);reduced.addEventListener('change',()=>{if(reduced.matches)manual=2;schedule();});compact.addEventListener('change',schedule);
if(reduced.matches)manual=2;paint();
})();


(()=>{
const section=document.getElementById('lehrkraefte');if(!section||!section.querySelector('.t-visual'))return;
const pin=section.querySelector('.t-scroll-pin'),visual=section.querySelector('.t-visual'),steps=[...section.querySelectorAll('[data-t-step]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-height:560px)');
const labels=['Klasse verbinden','Fortschritt live','Mia K. · Details','Live-Quiz am Beamer'];
let manual=0,override=false,last=-1,scheduled=false;
function render(p,phase){visual.style.setProperty('--t-p',p.toFixed(3));if(phase===last)return;last=phase;visual.dataset.tPhase=String(phase);steps.forEach((s,i)=>{s.classList.toggle('on',i===phase);s.setAttribute('aria-pressed',String(i===phase));});section.querySelector('.t-visual-label').textContent=labels[phase];window.SbOwl&&window.SbOwl(section.querySelector('.t-owl'),['wave','lookaround','hint','quiz'][phase]);section.querySelector('.t-counter').textContent='0'+(phase+1)+' / 04';}
function paint(){scheduled=false;if(reduced.matches||compact.matches||override){render((manual+1)/4,manual);return;}const range=Math.max(1,section.offsetHeight-pin.offsetHeight);const p=Math.max(0,Math.min(1,(89-section.getBoundingClientRect().top)/range));render(p,Math.min(3,Math.floor(p*4)));}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(paint);}}
steps.forEach((b,i)=>b.addEventListener('click',()=>{manual=i;override=true;paint();}));
document.addEventListener('scroll',()=>{schedule();},{capture:true,passive:true});
addEventListener('wheel',()=>{override=false;},{passive:true});addEventListener('touchmove',()=>{override=false;},{passive:true});
addEventListener('resize',schedule);compact.addEventListener('change',schedule);paint();
})();
(()=>{
const section=document.getElementById('lernpfad');if(!section||!section.querySelector('.path-pin'))return;
const pin=section.querySelector('.path-pin'),tracks=[...section.querySelectorAll('details.track')],bars=[...section.querySelectorAll('.path-steps i')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-height:560px)');
let last=-1,scheduled=false,programmatic=false,override=false;
const owl=section.querySelector('.path-owl'),owlKeys=['typing','thinking','graduate'];
function setOpen(idx){if(idx===last)return;last=idx;programmatic=true;const narrow=matchMedia('(max-width:760px)').matches;tracks.forEach((t,i)=>{t.open=narrow?i===idx:i<=idx;});window.SbOwl&&window.SbOwl(owl,owlKeys[idx]);bars.forEach((b,i)=>b.classList.toggle('on',i<=idx));setTimeout(()=>{programmatic=false;},0);}
function paint(){scheduled=false;if(reduced.matches||compact.matches){pin.style.top='';return;}const top=Math.min(89,innerHeight-pin.offsetHeight-12);pin.style.top=top+'px';if(override)return;const range=Math.max(1,section.offsetHeight-pin.offsetHeight);const p=Math.max(0,Math.min(.999,(top-section.getBoundingClientRect().top)/range));setOpen(Math.min(tracks.length-1,Math.floor(p*tracks.length)));}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(paint);}}
tracks.forEach(t=>t.addEventListener('toggle',()=>{if(!programmatic)override=true;}));
document.addEventListener('scroll',()=>{schedule();},{capture:true,passive:true});
addEventListener('wheel',()=>{override=false;},{passive:true});addEventListener('touchmove',()=>{override=false;},{passive:true});
addEventListener('resize',schedule);paint();
})();
};

export {};
