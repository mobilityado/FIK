const API_URL = window.APP_CONFIG?.API_URL || '';
const chat = document.querySelector('#chat');
const form = document.querySelector('#inputForm');
const input = document.querySelector('#messageInput');
const sendBtn = document.querySelector('#sendBtn');
const actions = document.querySelector('#quickActions');
const restartBtn = document.querySelector('#restartBtn');
const progressBar = document.querySelector('#progressBar');
const progressLabel = document.querySelector('#progressLabel');
const installBtn = document.querySelector('#installBtn');
const statsBtn = document.querySelector('#statsBtn');
const statsModal = document.querySelector('#statsModal');
const statsBody = document.querySelector('#statsBody');
const closeStats = document.querySelector('#closeStats');

let deferredPrompt = null;
let state = { step: 'clave', clave: '', empleado: null, marca: null, corrida: null, minPP: null };

const BUS_AVATAR = `<div class="bus-avatar" aria-hidden="true"><svg viewBox="0 0 64 64"><rect x="10" y="12" width="44" height="36" rx="10" fill="currentColor"/><rect x="15" y="17" width="34" height="15" rx="5" fill="#fff" opacity=".92"/><circle cx="22" cy="51" r="5" fill="#25104e"/><circle cx="43" cy="51" r="5" fill="#25104e"/><circle cx="22" cy="39" r="3" fill="#fff"/><circle cx="42" cy="39" r="3" fill="#fff"/><path d="M25 25h14" stroke="#6543d8" stroke-width="3" stroke-linecap="round"/></svg><span></span></div>`;

function money(value){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(Number(value)||0)}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function setProgress(value, label){
  const n=Math.max(0,Math.min(100,Number(value)||0));
  progressBar.style.width=`${n}%`; progressBar.parentElement.setAttribute('aria-valuenow',String(n));
  progressLabel.textContent=label;
}
function addMessage(html, who='bot'){
  const row=document.createElement('div'); row.className=`row ${who}`;
  if(who==='bot') row.innerHTML=`${BUS_AVATAR}<div class="bubble">${html}</div>`;
  else row.innerHTML=`<div class="bubble">${escapeHtml(html)}</div>`;
  chat.appendChild(row); chat.scrollTop=chat.scrollHeight;
}
function showTyping(){const r=document.createElement('div');r.id='typing';r.className='row bot';r.innerHTML=`${BUS_AVATAR}<div class="bubble typing"><i></i><i></i><i></i></div>`;chat.appendChild(r);chat.scrollTop=chat.scrollHeight}
function hideTyping(){document.querySelector('#typing')?.remove()}
function setBusy(b){input.disabled=b;sendBtn.disabled=b}
function setInput(placeholder,mode='text'){input.placeholder=placeholder;input.inputMode=mode;input.value='';setTimeout(()=>input.focus(),50)}
function setActions(items=[]){actions.innerHTML='';items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=item.label;b.onclick=item.onClick;actions.appendChild(b)})}

async function api(params){
  if(!API_URL) throw new Error('La URL de la API no está configurada.');
  const url=new URL(API_URL);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res=await fetch(url.toString(),{redirect:'follow'});if(!res.ok)throw new Error('No fue posible conectar con el servidor.');return res.json();
}

async function askClave(value){
  state.clave=String(value).trim();addMessage(state.clave,'user');setBusy(true);setProgress(18,'Validando empleado…');showTyping();
  try{
    const data=await api({accion:'validarEmpleado',clave:state.clave});hideTyping();
    if(!data.ok){setProgress(0,'Esperando tu clave');addMessage(`🤔 ${escapeHtml(data.mensaje)}`);setInput('Escribe nuevamente tu clave','numeric');return}
    state.empleado=data.empleado;state.step='marca';setProgress(38,'Empleado identificado');
    statsBtn.hidden=data.empleado.rol!=='ADMIN';
    addMessage(`👋 ¡Hola, <strong>${escapeHtml(data.empleado.nombre)}</strong>! Soy <strong>FactorBot</strong>, tu asistente de consulta.<br><br>Selecciona la marca que deseas revisar.`);
    setInput('Selecciona una marca');input.disabled=true;sendBtn.disabled=true;
    setActions(data.empleado.marcas.map(m=>({label:m.nombre,onClick:()=>chooseMarca(m)})));
  }catch(e){hideTyping();setProgress(0,'Sin conexión');addMessage(`⚠️ ${escapeHtml(e.message)} Revisa la URL de la API en <strong>config.js</strong>.`)}finally{if(state.step==='clave')setBusy(false)}
}

async function chooseMarca(marca){
  state.marca=marca;addMessage(marca.nombre,'user');setActions([]);setBusy(true);setProgress(55,'Cargando corridas…');showTyping();
  try{
    const data=await api({accion:'corridas',clave:state.clave,marca:marca.codigo});hideTyping();
    if(!data.ok)throw new Error(data.mensaje);
    state.step='corrida';setProgress(68,'Corridas disponibles');addMessage(`Estas son las corridas disponibles para <strong>${escapeHtml(marca.nombre)}</strong>. Elige una:`);
    setActions(data.corridas.map(c=>({label:c,onClick:()=>chooseCorrida(c)})));
    setInput('Selecciona una corrida');input.disabled=true;sendBtn.disabled=true;
  }catch(e){hideTyping();addMessage(`⚠️ ${escapeHtml(e.message)}`);showBrandMenu()}finally{setBusy(false)}
}

function chooseCorrida(corrida){
  state.corrida=corrida;state.step='ingreso';addMessage(corrida,'user');setActions([]);setProgress(82,'Esperando ingreso sin IVA');
  addMessage(`Perfecto. Dime cuánto ingreso realizaste en tu cuenta <strong>sin IVA</strong> y te indicaré los factores PP y PK correspondientes.`);
  setInput('Ejemplo: 8540.50','decimal');input.disabled=false;sendBtn.disabled=false;
}

async function calculate(value){
  const clean=String(value).replace(/[$,\s]/g,'');const ingreso=Number(clean);
  if(!Number.isFinite(ingreso)||ingreso<0){addMessage('Escribe un importe válido mayor o igual a cero.');return}
  addMessage(value,'user');setBusy(true);setProgress(92,'Consultando tabla de pago…');showTyping();
  try{
    const data=await api({accion:'calcular',clave:state.clave,marca:state.marca.codigo,corrida:state.corrida,ingreso});hideTyping();
    if(!data.ok)throw new Error(data.mensaje);
    state.minPP=data.ingresoMinimoPP;setProgress(100,'Consulta completada');
    const minimo=data.ingresoMinimoPP==null?'No disponible':money(data.ingresoMinimoPP);
    const status=data.alcanzoPP?'<span class="result-status success">✓ Alcanzaste factor PP</span>':'<span class="result-status warning">Aún no alcanzas factor PP</span>';
    addMessage(`El ingreso mínimo de referencia para comenzar a obtener PP en esta corrida es <strong>${minimo}</strong>.<br><br>${status}<div class="factor-grid"><div class="factor"><span>FACTOR PP</span><b>${escapeHtml(data.factor.ppTexto)}</b></div><div class="factor"><span>FACTOR PK</span><b>${escapeHtml(data.factor.pkTexto)}</b></div></div><div class="important-note"><strong>Importante:</strong> Para estimar tu sueldo, multiplica el PP y el PK por los kilómetros recorridos en tu corrida. Al resultado todavía debes restar los impuestos y los descuentos de cartera que correspondan.</div>`);
    state.step='resultado';setInput('Selecciona una opción');input.disabled=true;sendBtn.disabled=true;
    setActions([
      {label:'Consultar otra corrida',onClick:showRunMenu},
      {label:'Cambiar de marca',onClick:showBrandMenu},
      {label:'Nueva consulta',onClick:resetApp}
    ]);
  }catch(e){hideTyping();setProgress(82,'No se completó la consulta');addMessage(`⚠️ ${escapeHtml(e.message)}`);setInput('Vuelve a escribir el ingreso','decimal')}finally{setBusy(false)}
}

function showBrandMenu(){
  state.step='marca';state.marca=null;state.corrida=null;setActions([]);setProgress(38,'Selecciona una marca');addMessage('Selecciona la marca que deseas consultar:');
  setActions(state.empleado.marcas.map(m=>({label:m.nombre,onClick:()=>chooseMarca(m)})));input.disabled=true;sendBtn.disabled=true;
}
async function showRunMenu(){
  if(!state.marca){showBrandMenu();return} setActions([]);setBusy(true);setProgress(55,'Actualizando corridas…');showTyping();
  try{const data=await api({accion:'corridas',clave:state.clave,marca:state.marca.codigo});hideTyping();if(!data.ok)throw new Error(data.mensaje);state.step='corrida';setProgress(68,'Selecciona otra corrida');addMessage(`Elige otra corrida de <strong>${escapeHtml(state.marca.nombre)}</strong>:`);setActions(data.corridas.map(c=>({label:c,onClick:()=>chooseCorrida(c)})))}catch(e){hideTyping();addMessage(`⚠️ ${escapeHtml(e.message)}`)}finally{setBusy(false);input.disabled=true;sendBtn.disabled=true}
}

async function openStats(){
  statsModal.hidden=false;statsBody.innerHTML='<div class="stats-loading">Cargando estadísticas…</div>';
  try{
    const data=await api({accion:'estadisticas',clave:state.clave});
    if(!data.ok)throw new Error(data.mensaje);
    statsBody.innerHTML=`<div class="stats-grid"><article><span>Consultas hoy</span><strong>${data.resumen.hoy}</strong></article><article><span>Consultas totales</span><strong>${data.resumen.total}</strong></article><article><span>Empleados únicos</span><strong>${data.resumen.empleadosUnicos}</strong></article><article><span>Hora pico</span><strong>${escapeHtml(data.resumen.horaPico)}</strong></article></div><div class="stats-columns"><section><h3>Actividad por marca</h3>${renderBars(data.porMarca)}</section><section><h3>Corridas más consultadas</h3>${renderRanking(data.topCorridas)}</section></div><p class="stats-foot">Actualizado: ${escapeHtml(data.actualizado)}</p>`;
  }catch(e){statsBody.innerHTML=`<div class="stats-error">⚠️ ${escapeHtml(e.message)}</div>`}
}
function renderBars(items){if(!items.length)return '<p class="empty">Aún no hay consultas registradas.</p>';const max=Math.max(...items.map(x=>x.valor),1);return `<div class="bar-list">${items.map(x=>`<div><span>${escapeHtml(x.nombre)}</span><b>${x.valor}</b><i><em style="width:${(x.valor/max)*100}%"></em></i></div>`).join('')}</div>`}
function renderRanking(items){if(!items.length)return '<p class="empty">Aún no hay consultas registradas.</p>';return `<ol class="ranking">${items.map(x=>`<li><span>${escapeHtml(x.nombre)}</span><b>${x.valor}</b></li>`).join('')}</ol>`}

function resetApp(){
  state={step:'clave',clave:'',empleado:null,marca:null,corrida:null,minPP:null};chat.innerHTML='';setActions([]);statsBtn.hidden=true;setBusy(false);setProgress(0,'Esperando tu clave');setInput('Escribe tu clave de empleado','numeric');
  addMessage('👋 Hola, soy <strong>FactorBot</strong> de <strong>Asegura tu Factor</strong>.<br><br>Para comenzar, escribe tu clave de empleado.');
}

form.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(!value)return;if(state.step==='clave')askClave(value);else if(state.step==='ingreso')calculate(value)});
restartBtn.addEventListener('click',resetApp);
statsBtn.addEventListener('click',openStats);
closeStats.addEventListener('click',()=>statsModal.hidden=true);
statsModal.addEventListener('click',e=>{if(e.target===statsModal)statsModal.hidden=true});

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false});
installBtn.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.hidden=true});
window.addEventListener('appinstalled',()=>{installBtn.hidden=true;deferredPrompt=null});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

resetApp();
