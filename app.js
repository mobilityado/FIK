const API_URL = window.APP_CONFIG?.API_URL || '';
const chat = document.querySelector('#chat');
const form = document.querySelector('#inputForm');
const input = document.querySelector('#messageInput');
const sendBtn = document.querySelector('#sendBtn');
const actions = document.querySelector('#quickActions');
const restartBtn = document.querySelector('#restartBtn');

let state = { step: 'clave', clave: '', empleado: null, marca: null, corrida: null, minPP: null };

function money(value){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(Number(value)||0)}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function addMessage(html, who='bot'){
  const row=document.createElement('div'); row.className=`row ${who}`;
  if(who==='bot') row.innerHTML=`<div class="avatar">AF</div><div class="bubble">${html}</div>`;
  else row.innerHTML=`<div class="bubble">${escapeHtml(html)}</div>`;
  chat.appendChild(row); chat.scrollTop=chat.scrollHeight;
}
function showTyping(){const r=document.createElement('div');r.id='typing';r.className='row bot';r.innerHTML='<div class="avatar">AF</div><div class="bubble typing"><i></i><i></i><i></i></div>';chat.appendChild(r);chat.scrollTop=chat.scrollHeight}
function hideTyping(){document.querySelector('#typing')?.remove()}
function setBusy(b){input.disabled=b;sendBtn.disabled=b}
function setInput(placeholder,mode='text'){input.placeholder=placeholder;input.inputMode=mode;input.value='';setTimeout(()=>input.focus(),50)}
function setActions(items=[]){actions.innerHTML='';items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=item.label;b.onclick=item.onClick;actions.appendChild(b)})}

async function api(params){
  const url=new URL(API_URL);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res=await fetch(url.toString(),{redirect:'follow'});if(!res.ok)throw new Error('No fue posible conectar con el servidor.');return res.json();
}

async function askClave(value){
  state.clave=String(value).trim();addMessage(state.clave,'user');setBusy(true);showTyping();
  try{
    const data=await api({accion:'validarEmpleado',clave:state.clave});hideTyping();
    if(!data.ok){addMessage(`🤔 ${escapeHtml(data.mensaje)}`);setInput('Escribe nuevamente tu clave','numeric');return}
    state.empleado=data.empleado;state.step='marca';
    addMessage(`👋 ¡Hola, <strong>${escapeHtml(data.empleado.nombre)}</strong>! Identifiqué tu acceso correctamente.<br><br>Selecciona la marca que deseas consultar.`);
    setInput('Selecciona una marca');input.disabled=true;sendBtn.disabled=true;
    setActions(data.empleado.marcas.map(m=>({label:m.nombre,onClick:()=>chooseMarca(m)})));
  }catch(e){hideTyping();addMessage(`⚠️ ${escapeHtml(e.message)} Revisa la URL de la API en <strong>config.js</strong>.`)}finally{if(state.step==='clave')setBusy(false)}
}

async function chooseMarca(marca){
  state.marca=marca;addMessage(marca.nombre,'user');setActions([]);setBusy(true);showTyping();
  try{
    const data=await api({accion:'corridas',clave:state.clave,marca:marca.codigo});hideTyping();
    if(!data.ok)throw new Error(data.mensaje);
    state.step='corrida';addMessage(`Estas son las corridas disponibles para <strong>${escapeHtml(marca.nombre)}</strong>. Elige una:`);
    setActions(data.corridas.map(c=>({label:c,onClick:()=>chooseCorrida(c)})));
    setInput('Selecciona una corrida');input.disabled=true;sendBtn.disabled=true;
  }catch(e){hideTyping();addMessage(`⚠️ ${escapeHtml(e.message)}`);showBrandMenu()}finally{setBusy(false)}
}

function chooseCorrida(corrida){
  state.corrida=corrida;state.step='ingreso';addMessage(corrida,'user');setActions([]);
  addMessage(`Perfecto. Dime cuánto ingreso realizaste en tu cuenta <strong>sin IVA</strong> y te diré si alcanzaste factor PP, además de tus factores PP y PK.`);
  setInput('Ejemplo: 8540.50','decimal');input.disabled=false;sendBtn.disabled=false;
}

async function calculate(value){
  const clean=String(value).replace(/[$,\s]/g,'');const ingreso=Number(clean);
  if(!Number.isFinite(ingreso)||ingreso<0){addMessage('Escribe un importe válido mayor o igual a cero.');return}
  addMessage(value,'user');setBusy(true);showTyping();
  try{
    const data=await api({accion:'calcular',clave:state.clave,marca:state.marca.codigo,corrida:state.corrida,ingreso});hideTyping();
    if(!data.ok)throw new Error(data.mensaje);
    state.minPP=data.ingresoMinimoPP;
    const minimo=data.ingresoMinimoPP==null?'No disponible':money(data.ingresoMinimoPP);
    const status=data.alcanzoPP?'✅ <strong>Sí alcanzaste factor PP.</strong>':'ℹ️ <strong>En este rango todavía no alcanzas factor PP.</strong>';
    addMessage(`Recuerda que el ingreso mínimo estimado para comenzar a obtener PP en esta corrida es <strong>${minimo}</strong>.<br><br>${status}<br><br>Si el ingreso que me enviaste es correcto y ya le restaste el IVA, tus factores son:<div class="factor-grid"><div class="factor"><span>Factor PP</span><b>${escapeHtml(data.factor.ppTexto)}</b></div><div class="factor"><span>Factor PK</span><b>${escapeHtml(data.factor.pkTexto)}</b></div></div><br>Para estimar tu sueldo, multiplica el <strong>PP</strong> y el <strong>PK</strong> por los kilómetros recorridos en tu corrida. Recuerda que todavía faltan los impuestos y los descuentos de cartera que pudieras tener.`);
    state.step='resultado';setInput('Elige una opción');input.disabled=true;sendBtn.disabled=true;
    setActions([
      {label:'Consultar otra corrida',onClick:backToRuns},
      {label:'Cambiar de marca',onClick:showBrandMenu},
      {label:'Nueva consulta',onClick:reset}
    ]);
  }catch(e){hideTyping();addMessage(`⚠️ ${escapeHtml(e.message)}`);setInput('Escribe nuevamente tu ingreso','decimal')}finally{if(state.step==='ingreso')setBusy(false)}
}

function backToRuns(){chooseMarca(state.marca)}
function showBrandMenu(){state.step='marca';setActions(state.empleado.marcas.map(m=>({label:m.nombre,onClick:()=>chooseMarca(m)})));addMessage('Selecciona la marca que deseas consultar.');setInput('Selecciona una marca');input.disabled=true;sendBtn.disabled=true}
function reset(){state={step:'clave',clave:'',empleado:null,marca:null,corrida:null,minPP:null};chat.innerHTML='';setActions([]);input.disabled=false;sendBtn.disabled=false;setInput('Escribe tu clave de empleado','numeric');addMessage('👋 Hola. Soy <strong>Asegura tu Factor</strong>, tu asistente de consulta de factores <strong>PP y PK</strong>.<br><br>Para comenzar, escribe tu clave de empleado.')}

form.addEventListener('submit',e=>{e.preventDefault();const v=input.value.trim();if(!v)return;if(state.step==='clave')askClave(v);else if(state.step==='ingreso')calculate(v)});
restartBtn.addEventListener('click',reset);
reset();
