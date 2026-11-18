const $=id=>document.getElementById(id);
const today=new Date();
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
let currentMonth=monthKey(today), data={};
const fresh=()=>({deposits:[],meals:{},rate:50,cook:230,showFinal:false,final:null});

function normalizeMonth(s){
 if(!s || typeof s!=="object") return fresh();
 if(!Array.isArray(s.deposits)) s.deposits=[];
 if(!s.meals || typeof s.meals!=="object") s.meals={};
 // Older versions allowed a gas charge on every deposit. Keep one monthly
 // charge (prefer the first deposit's value; otherwise carry the first
 // non-zero legacy charge forward) and clear it from all later deposits.
 if(s.deposits.length){
  let firstGas=num(s.deposits[0].gas);
  if(firstGas===0){
   const legacyGas=s.deposits.find(d=>num(d.gas)>0);
   if(legacyGas) firstGas=num(legacyGas.gas);
  }
  s.deposits.forEach((d,i)=>{d.gas=i===0?String(firstGas):"0";});
 }
 s.showFinal=Boolean(s.showFinal||s.settled||s.final!==null&&s.final!==undefined);
 s.settled=false; // migrate old permanently-locked months to editable preview mode
 if(s.rate===undefined) s.rate=50;
 if(s.cook===undefined) s.cook=230;
 return s;
}

function load(){
 try{data=JSON.parse(localStorage.getItem("falconMessTracker")||"{}")}catch{data={}}
 Object.keys(data).forEach(k=>data[k]=normalizeMonth(data[k]));
 if(!data[currentMonth])data[currentMonth]=fresh();
 save();
 render();
}
function save(){localStorage.setItem("falconMessTracker",JSON.stringify(data))}
function state(){return data[currentMonth]}
function daysInMonth(){let [y,m]=currentMonth.split("-").map(Number);return new Date(y,m,0).getDate()}
function num(v){return Number(v)||0}
function stats(){
 const s=state(),dep=s.deposits.reduce((a,d)=>a+num(d.amount),0);
 const gas=s.deposits.length?num(s.deposits[0].gas):0;
 const budget=dep-gas,rate=Math.max(1,num(s.rate)||50);
 const used=Object.values(s.meals).reduce((a,v)=>a+(v==="Both"?2:(v==="Morning"||v==="Night"?1:0)),0);
 return {dep,gas,budget,rate,used,available:Math.max(0,Math.floor(budget/rate)),remainingMoney:budget-used*rate,remaining:Math.max(0,Math.floor((budget-used*rate)/rate))};
}
function render(){
 const s=state(),st=stats();
 $("month").value=currentMonth;$("rate").value=s.rate;$("cook").value=s.cook;
 $("available").textContent=st.available;$("consumed").textContent=st.used;$("remaining").textContent=st.remaining;
 $("rate").disabled=false;$("cook").disabled=false;$("addDeposit").disabled=false;
 $("deposits").innerHTML=s.deposits.length?s.deposits.map((d,i)=>`<div class="panel"><div class="deposit-title">Deposit #${i+1}<button class="danger" data-remove="${i}">Remove</button></div><div class="grid2"><div><label>Deposit Amount (₹)</label><input type="number" min="0" data-dep="${i}" data-field="amount" value="${esc(d.amount)}"></div><div><label>Gas Charge (₹) ${i===0?"(monthly – first deposit only)":"(not charged again)"}</label><input type="number" min="0" data-dep="${i}" data-field="gas" value="${i===0?esc(d.gas):"0"}" ${i===0?"":"disabled"}></div></div><p class="muted">Net Deposit: ₹${num(d.amount)-(i===0?num(d.gas):0)}</p></div>`).join(""):'<div class="panel muted">No deposits added yet.</div>';
 let html="";
 for(let d=1;d<=daysInMonth();d++){
  let v=s.meals[d]||"Off",count=v==="Both"?2:(v==="Morning"||v==="Night"?1:0);
  html+=`<div class="day"><div class="daytop"><span>Day ${d}</span><span>${v}</span></div><div class="choices">${["Morning","Night","Both","Off"].map(x=>`<button data-day="${d}" data-value="${x}" class="${v===x?"active":""}">${x}</button>`).join("")}</div><div class="dayfoot"><span>Meals: ${count}</span><span>Cost: ₹${count*st.rate}</span></div></div>`;
 }
 $("days").innerHTML=html;
 if(s.showFinal){
  const final=st.remainingMoney-num(s.cook);
  s.final=final;
  $("settlement").innerHTML=`<div class="result"><b class="${final>=0?"refund":"due"}">${final>=0?"REFUND":"DUE"}</b><strong class="${final>=0?"refund":"due"}">₹${Math.abs(final)}</strong><div class="muted">${final>=0?"This amount is refundable to you.":"This amount is payable by you."}<br>Meals consumed: ${st.used}<br>Gas charge deducted once: ₹${st.gas}<br>Cook Charge ₹${num(s.cook)} has been deducted.<br><br>This is a preview. Your dashboard and entries remain editable.</div><button class="full" id="backDashboard">Back to Dashboard</button><button class="primary full" id="settle">Recalculate Final Result</button></div>`;
 }else{
  $("settlement").innerHTML='<div class="muted">Calculate anytime to preview your current Due or Refund. This will not lock your month.</div><button class="primary full" id="settle">Calculate Final Result</button>';
 }
 save();
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

$("month").value=currentMonth;
$("month").addEventListener("change",e=>{
 currentMonth=e.target.value||monthKey(today);
 if(!data[currentMonth])data[currentMonth]=fresh();
 $("reportArea").hidden=true;save();render();
});
$("rate").addEventListener("change",e=>{state().rate=Math.max(1,num(e.target.value)||50);save();render()});
$("cook").addEventListener("change",e=>{state().cook=Math.max(0,num(e.target.value));save();render()});
$("addDeposit").addEventListener("click",()=>{
 const s=state();
 s.deposits.push({amount:"1000",gas:s.deposits.length?"0":"150"});
 save();render();
});
$("deposits").addEventListener("change",e=>{
 let i=e.target.dataset.dep,f=e.target.dataset.field;
 if(i===undefined||!f)return;
 i=Number(i);
 if(f==="gas"&&i!==0)return;
 state().deposits[i][f]=e.target.value;save();render();
});
$("deposits").addEventListener("click",e=>{
 let i=e.target.dataset.remove;
 if(i===undefined)return;
 const s=state();i=Number(i);
 const removed=s.deposits.splice(i,1)[0];
 if(i===0&&s.deposits.length)s.deposits[0].gas=String(num(removed.gas));
 save();render();
});
$("days").addEventListener("click",e=>{
 let d=e.target.dataset.day,v=e.target.dataset.value;
 if(d){state().meals[d]=v;save();render()}
});
$("settlement").addEventListener("click",e=>{
 if(e.target.id==="settle"){state().showFinal=true;save();render()}
 if(e.target.id==="backDashboard"){$("available").scrollIntoView({behavior:"smooth",block:"center"})}
});
$("report").addEventListener("click",()=>{
 let s=state(),st=stats(),final=st.remainingMoney-num(s.cook);
 let lines=[`Mess Meal Tracker — ${currentMonth}`,`Deposits: ₹${st.dep}`,`Gas: ₹${st.gas}`,`Meal budget: ₹${st.budget}`,`Meals available: ${st.available}`,`Meals consumed: ${st.used}`,`Remaining meals: ${st.remaining}`,`Meal expenses: ₹${st.used*st.rate}`,s.showFinal?`${final>=0?"Refund":"Due"}: ₹${Math.abs(final)} (preview)`:"Final settlement not calculated",...Array.from({length:daysInMonth()},(_,i)=>`Day ${i+1}: ${s.meals[i+1]||"Off"}`)];
 $("reportArea").hidden=false;
 $("reportArea").innerHTML=`<b>Monthly Report</b><pre style="white-space:pre-wrap;color:#dbeafe;font:13px system-ui">${esc(lines.join("\n"))}</pre><button id="copyReport" class="full">Copy Report</button>`;
 $("copyReport").onclick=async()=>{await navigator.clipboard.writeText(lines.join("\n"));$("copyReport").textContent="Copied!"};
});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
load();
