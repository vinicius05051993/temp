"use strict";
const TZ="America/Sao_Paulo";
const events=[
 {id:"evt-001",title:"Convenção Maple Bear 2026",start:"2026-11-23T09:00:00",end:"2026-11-23T17:00:00",location:"Centro de Convenções, São Paulo - SP",description:"Encontro anual com representantes das escolas Maple Bear para alinhamento estratégico e planejamento.",category:"Convenção",color:"#d71920"},
 {id:"evt-002",title:"Reunião de lideranças regionais",start:"2026-11-24T10:00:00",end:"2026-11-24T11:30:00",location:"Online",description:"Alinhamento das lideranças regionais.",category:"Reunião",color:"#7856a8"},
 {id:"evt-003",title:"Webinar: Novas Diretrizes Pedagógicas",start:"2026-11-25T14:00:00",end:"2026-11-25T15:00:00",location:"Online",description:"Apresentação das novas diretrizes pedagógicas.",category:"Webinar",color:"#2f6fbd"},
 {id:"evt-004",title:"Treinamento – Plataforma Educacional",start:"2026-11-26T10:00:00",end:"2026-11-26T12:00:00",location:"Online",description:"Treinamento para utilização da plataforma educacional.",category:"Treinamento",color:"#27834a"},
 {id:"evt-005",title:"Prazo final para inscrições",start:"2026-11-27T08:00:00",end:"2026-11-27T18:00:00",location:"Portal Maple Bear",description:"Último dia para concluir as inscrições.",category:"Prazo",color:"#7856a8"},
 {id:"evt-006",title:"Encontro de coordenadores",start:"2026-11-28T09:00:00",end:"2026-11-28T12:00:00",location:"São Paulo - SP",description:"Encontro presencial de coordenadores.",category:"Presencial",color:"#d71920"},
 {id:"evt-007",title:"Workshop de tecnologia educacional",start:"2026-12-02T13:30:00",end:"2026-12-02T16:30:00",location:"Online",description:"Workshop sobre ferramentas digitais para educação.",category:"Workshop",color:"#27834a"},
 {id:"evt-008",title:"Webinar para famílias",start:"2026-12-04T18:00:00",end:"2026-12-04T19:00:00",location:"Online",description:"Conversa sobre a jornada de aprendizagem.",category:"Webinar",color:"#2f6fbd"},
 {id:"evt-009",title:"Reunião de planejamento",start:"2026-11-25T09:00:00",end:"2026-11-25T10:00:00",location:"Online",description:"Reunião adicional no mesmo dia para demonstrar múltiplos eventos.",category:"Reunião",color:"#7856a8"}
];
const $=id=>document.getElementById(id);
const parseLocal=s=>{const [d,t]=s.split("T");const [y,m,day]=d.split("-").map(Number);const [h,mi,se]=t.split(":").map(Number);return new Date(y,m-1,day,h,mi,se||0)};
const pad=n=>String(n).padStart(2,"0");
const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDate=s=>new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(parseLocal(s));
const fmtTime=s=>new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(parseLocal(s));
const monthFmt=new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"});
let view=new Date(2026,10,1), selected="2026-11-23";
function googleDate(s){return s.replaceAll("-","").replaceAll(":","")}
function googleUrl(e){
 const p=new URLSearchParams({action:"TEMPLATE",text:e.title,dates:`${googleDate(e.start)}/${googleDate(e.end)}`,details:`${e.description}\n\nCódigo do evento: ${e.id}`,location:e.location,ctz:TZ});
 return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
function showDetail(e){
 selected=key(parseLocal(e.start));
 const content=$("modal-content");content.replaceChildren();
 const title=document.createElement("div");title.className="modal-event-title";title.textContent=e.title;
 const date=document.createElement("p");date.className="modal-meta";date.textContent=`📅 ${fmtDate(e.start)}`;
 const time=document.createElement("p");time.className="modal-meta";time.textContent=`🕒 ${fmtTime(e.start)} – ${fmtTime(e.end)}`;
 const loc=document.createElement("p");loc.className="modal-meta";loc.textContent=`📍 ${e.location}`;
 const category=document.createElement("p");category.className="modal-meta";category.textContent=`Categoria: ${e.category}`;
 const desc=document.createElement("p");desc.className="modal-description";desc.textContent=e.description;
 content.append(title,date,time,loc,category,desc);
 const actions=$("modal-actions");actions.replaceChildren();
 const btn=document.createElement("a");btn.className="add-button";btn.href=googleUrl(e);btn.target="_blank";btn.rel="noopener noreferrer";
 btn.innerHTML='<span class="g-icon">G</span> Adicionar à minha Google Agenda';
 actions.appendChild(btn);
 $("event-modal").classList.add("open");$("modal-close").focus();renderCalendar();
}
function renderCalendar(){
 $("month-title").textContent=monthFmt.format(view).replace(/^./,c=>c.toUpperCase());
 const cal=$("calendar");while(cal.children.length>7)cal.removeChild(cal.lastChild);
 const first=new Date(view.getFullYear(),view.getMonth(),1);
 const start=new Date(first);start.setDate(first.getDate()-first.getDay());
 const today=key(new Date());
 for(let i=0;i<42;i++){
  const d=new Date(start);d.setDate(start.getDate()+i);const k=key(d);
  const cell=document.createElement("div");cell.className="day";
  if(d.getMonth()!==view.getMonth())cell.classList.add("outside");
  if(k===today)cell.classList.add("today");
  if(k===selected)cell.classList.add("selected");
  const num=document.createElement("div");num.className="day-number";num.textContent=d.getDate();cell.appendChild(num);
  const dayEvents=events.filter(e=>key(parseLocal(e.start))===k).sort((a,b)=>a.start.localeCompare(b.start));
  dayEvents.slice(0,3).forEach(e=>{
   const pill=document.createElement("button");pill.className="event-pill";pill.style.background=e.color;
   pill.textContent=`${fmtTime(e.start)} ${e.title}`;pill.title=e.title;
   pill.addEventListener("click",ev=>{ev.stopPropagation();showDetail(e)});
   cell.appendChild(pill);
  });
  if(dayEvents.length>3){const more=document.createElement("div");more.className="more-events";more.textContent=`+${dayEvents.length-3} eventos`;cell.appendChild(more)}
  cell.addEventListener("click",()=>{selected=k;renderCalendar();const dayEvents=events.filter(e=>key(parseLocal(e.start))===k);if(dayEvents.length)showDetail(dayEvents[0]);else{$("selected-date").textContent=new Intl.DateTimeFormat("pt-BR",{dateStyle:"full"}).format(d);$("event-detail").className="detail-empty";$("event-detail").textContent="Nenhum evento cadastrado para este dia."}});
  cal.appendChild(cell);
 }
}
function renderUpcoming(){
 const box=$("upcoming");
 events.slice().sort((a,b)=>a.start.localeCompare(b.start)).forEach(e=>{
  const row=document.createElement("div");row.className="list-event";row.tabIndex=0;
  const dt=parseLocal(e.start);const date=document.createElement("div");date.className="date-box";
  const day=document.createElement("strong");day.textContent=pad(dt.getDate());const mon=document.createElement("span");mon.textContent=new Intl.DateTimeFormat("pt-BR",{month:"short"}).format(dt).replace(".","");
  date.append(day,mon);
  const info=document.createElement("div");info.className="list-info";const title=document.createElement("strong");title.textContent=e.title;const small=document.createElement("small");small.textContent=`${fmtTime(e.start)} · ${e.category}`;
  info.append(title,small);row.append(date,info);row.addEventListener("click",()=>{view=new Date(dt.getFullYear(),dt.getMonth(),1);showDetail(e)});row.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();view=new Date(dt.getFullYear(),dt.getMonth(),1);showDetail(e)}});box.appendChild(row);
 });
}
$("prev").addEventListener("click",()=>{view.setMonth(view.getMonth()-1);renderCalendar()});
$("next").addEventListener("click",()=>{view.setMonth(view.getMonth()+1);renderCalendar()});
$("today").addEventListener("click",()=>{view=new Date();selected=key(new Date());renderCalendar()});
function closeModal(){$("event-modal").classList.remove("open")}
$("modal-close").addEventListener("click",closeModal);
$("event-modal").addEventListener("click",ev=>{if(ev.target===$("event-modal"))closeModal()});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape")closeModal()});
renderUpcoming();renderCalendar();
