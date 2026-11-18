const $=id=>document.getElementById(id);
const today=new Date();
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
let currentMonth=monthKey(today), data={}, settled=false;
const fresh=()=>({deposits:[],meals:{},rate:50,cook:230,settled:false,final:null});
function load(){try{data=JSON.parse(localStorage.getItem("falconMessTracker")||"{}")}catch{data={}};if(!data[currentMonth])data[currentMonth]=fresh();render()}
function save(){localStorage.setItem("falconMessTracker",JSON.stringify(data))}
function state(){return data[currentMonth]}
function daysInMonth(){let [y,m]=currentMonth.split("-").map(Number);return new Date(y,m,0).getDate()}
function num(v){return Number(v)||0}
function stats(){
 const s=state(),dep=s.deposits.reduce((a,d)=>a+num(d.amount),0),gas=s.deposits.reduce((a,d)=>a+num(d.gas),0);
 const budget=dep-gas,rate=Math.max(1,num(s.rate)||50);
 const used=Object.values(s.meals).reduce((a,v)=>a+(v==="Both"?2:(v==="Morning"||v==="Night"?1:0)),0);
 return {dep,gas,budget,rate,used,available:Math.max(0,Math.floor(budget/rate)),remainingMoney:budget-used*rate,remaining:Math.max(0,Math.floor((budget-used*rate)/rate))};
}
function render(){
 const s=state(),st=stats();$("month").value=currentMonth;$("rate").value=s.rate;$("cook").value=s.cook;
 $("available").textContent=st.available;$("consumed").textContent=st.used;$("remaining").textContent=st.remaining;
 const lock=s.settled;$("rate").disabled=lock;$("cook").disabled=lock;$("addDeposit").disabled=lock;
 $("deposits").innerHTML=s.deposits.length?s.deposits.map((d,i)=>`<div class="panel"><div class="deposit-title">Deposit #${i+1}<button class="danger" data-remove="${i}" ${lock?"disabled":""}>Remove</button></div><div class="grid2"><div><label>Deposit Amount (₹)</label><input type="number" min="0" data-dep="${i}" data-field="amount" value="${esc(d.amount)}" ${lock?"disabled":""}></div><div><label>Gas Charge (₹)</label><input type="number" min="0" data-dep="${i}" data-field="gas" value="${esc(d.gas)}" ${lock?"disabled":""}></div></div><p class="muted">Net Meal Budget: ₹${num(d.amount)-num(d.gas)}</p></div>`).join(""):'<div class="panel muted">No deposits added yet.</div>';
 let html="";for(let d=1;d<=daysInMonth();d++){let v=s.meals[d]||"Off",count=v==="Both"?2:(v==="Morning"||v==="Night"?1:0);html+=`<div class="day"><div class="daytop"><span>Day ${d}</span><span>${v}</span></div><div class="choices">${["Morning","Night","Both","Off"].map(x=>`<button data-day="${d}" data-value="${x}" class="${v===x?"active":""}" ${lock?"disabled":""}>${x}</button>`).join("")}</div><div class="dayfoot"><span>Meals: ${count}</span><span>Cost: ₹${count*st.rate}</span></div></div>`}
 $("days").innerHTML=html;
 if(lock){let f=s.final;$("settlement").innerHTML=`<div class="result"><b class="${f>=0?"refund":"due"}">${f>=0?"REFUND":"DUE"}</b><strong class="${f>=0?"refund":"due"}">₹${Math.abs(f)}</strong><div class="muted">${f>=0?"This amount is refundable to you.":"This amount is payable by you."}<br>Cook Charge ₹${num(s.cook)} has been deducted.</div><p>✓ Month Settled</p></div>`}
 else $("settlement").innerHTML='<div class="muted">After the last day of the month, calculate your final balance here.</div><button class="primary full" id="settle">Calculate Final Result</button>';
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("month").value=currentMonth;$("month").addEventListener("change",e=>{currentMonth=e.target.value||monthKey(today);if(!data[currentMonth])data[currentMonth]=fresh();$("reportArea").hidden=true;save();render()});
$("rate").addEventListener("change",e=>{state().rate=Math.max(1,num(e.target.value)||50);save();render()});
$("cook").addEventListener("change",e=>{state().cook=Math.max(0,num(e.target.value));save();render()});
$("addDeposit").addEventListener("click",()=>{state().deposits.push({amount:"1000",gas:"150"});save();render()});
$("deposits").addEventListener("change",e=>{let i=e.target.dataset.dep,f=e.target.dataset.field;if(i!==undefined&&f){state().deposits[Number(i)][f]=e.target.value;save();render()}});
$("deposits").addEventListener("click",e=>{let i=e.target.dataset.remove;if(i!==undefined){state().deposits.splice(Number(i),1);save();render()}});
$("days").addEventListener("click",e=>{let d=e.target.dataset.day,v=e.target.dataset.value;if(d&&!state().settled){state().meals[d]=v;save();render()}});
$("settlement").addEventListener("click",e=>{if(e.target.id!=="settle")return;let st=stats();state().final=st.remainingMoney-num(state().cook);state().settled=true;save();render()});
$("report").addEventListener("click",()=>{let s=state(),st=stats(),lines=[`Mess Meal Tracker — ${currentMonth}`,`Deposits: ₹${st.dep}`,`Gas: ₹${st.gas}`,`Meal budget: ₹${st.budget}`,`Meals available: ${st.available}`,`Meals consumed: ${st.used}`,`Remaining meals: ${st.remaining}`,`Meal expenses: ₹${st.used*st.rate}`,s.settled?`${s.final>=0?"Refund":"Due"}: ₹${Math.abs(s.final)}`:"Final settlement not calculated",...Array.from({length:daysInMonth()},(_,i)=>`Day ${i+1}: ${s.meals[i+1]||"Off"}`)];$("reportArea").hidden=false;$("reportArea").innerHTML=`<b>Monthly Report</b><pre style="white-space:pre-wrap;color:#dbeafe;font:13px system-ui">${esc(lines.join("\n"))}</pre><button id="copyReport" class="full">Copy Report</button>`;$("copyReport").onclick=async()=>{await navigator.clipboard.writeText(lines.join("\n"));$("copyReport").textContent="Copied!"}});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
load();