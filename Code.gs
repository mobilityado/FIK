/**
 * API para consulta de factores PP y PK.
 * Publicar como aplicación web: Ejecutar como "Yo" y acceso "Cualquier persona".
 */

const CONFIG = {
  EMPLEADOS_ID: '1aS0eMo3eVRKQCRlhdo3cUio_WVWcMI2EbIY387PIe2E',
  TABLAS: {
    SUR:       { id: '1WMHBKTjoC6iBcArwZz8iFcU2uj-HiP2fVSRW6TEymSw', nombre: 'SUR' },
    SURVB:     { id: '1rcZGN7S0DMbo9h3MYe549QGE6HgUUDNahSFCBp6kj5c', nombre: 'SUR VB' },
    TRT:       { id: '1_mlSpoThskd6redR9rrZjOrZqv9xZNia9zrdmkxmo_k', nombre: 'TRT' },
    TRTVB:     { id: '1FTgzoKOQ4BE4JEonbkdlxYiX3L1vOWSv2bCpGyCXQsA', nombre: 'TRT VB' },
    ADOCORTO:  { id: '1DbWb5EGkO8JEaO22PikNDtoHTNkLAbY0PZe547y3rpc', nombre: 'ADO CORTO' },
    ADOLARGO:  { id: '1xNRWyilhEz6tQxZO6T_TCID8BJfRTe1GgL6V6I_LVc4', nombre: 'ADO LARGO' }
  },
  ACCESOS: {
    ADMIN: ['SUR', 'SURVB', 'TRT', 'TRTVB', 'ADOCORTO', 'ADOLARGO'],
    SUR: ['SUR', 'SURVB'],
    TRT: ['TRT', 'TRTVB'],
    ADO: ['ADOCORTO', 'ADOLARGO']
  }
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const accion = String(p.accion || 'estado').toLowerCase();
    let resultado;

    if (accion === 'estado') resultado = { ok: true, mensaje: 'API PP/PK activa' };
    else if (accion === 'validarempleado') resultado = validarEmpleado_(p.clave);
    else if (accion === 'corridas') resultado = obtenerCorridas_(p.clave, p.marca);
    else if (accion === 'calcular') resultado = calcularFactores_(p.clave, p.marca, p.corrida, p.ingreso);
    else if (accion === 'estadisticas') resultado = obtenerEstadisticas_(p.clave);
    else resultado = { ok: false, mensaje: 'Acción no válida.' };

    return responder_(resultado, p.callback);
  } catch (error) {
    return responder_({ ok: false, mensaje: error.message || String(error) }, e && e.parameter && e.parameter.callback);
  }
}

function validarEmpleado_(claveEntrada) {
  const clave = limpiarClave_(claveEntrada);
  if (!clave) return { ok: false, mensaje: 'Escribe una clave de empleado válida.' };

  const libro = SpreadsheetApp.openById(CONFIG.EMPLEADOS_ID);
  const mapa = [
    { hoja: 'ADMINISTADOR', rol: 'ADMIN' },
    { hoja: 'ADMINISTRADOR', rol: 'ADMIN' },
    { hoja: 'SUR', rol: 'SUR' },
    { hoja: 'TRT', rol: 'TRT' },
    { hoja: 'ADO', rol: 'ADO' }
  ];

  for (const item of mapa) {
    const hoja = libro.getSheetByName(item.hoja);
    if (!hoja) continue;
    const datos = hoja.getDataRange().getDisplayValues();
    for (let i = 1; i < datos.length; i++) {
      if (limpiarClave_(datos[i][0]) === clave) {
        const nombre = String(datos[i][1] || 'Colaborador').trim();
        const marcas = CONFIG.ACCESOS[item.rol] || [];
        return {
          ok: true,
          empleado: { clave, nombre, rol: item.rol, marcas: marcas.map(describirMarca_) }
        };
      }
    }
  }
  return { ok: false, mensaje: 'No encontré esa clave de empleado. Verifica el número e intenta nuevamente.' };
}

function obtenerCorridas_(claveEntrada, marcaEntrada) {
  const empleado = validarEmpleado_(claveEntrada);
  if (!empleado.ok) return empleado;

  const marca = normalizarMarca_(marcaEntrada);
  if (!marca || !CONFIG.TABLAS[marca]) return { ok: false, mensaje: 'Selecciona una marca válida.' };
  if (!empleado.empleado.marcas.some(m => m.codigo === marca)) {
    return { ok: false, mensaje: 'Tu usuario no tiene acceso a esa marca.' };
  }

  const libro = SpreadsheetApp.openById(CONFIG.TABLAS[marca].id);
  const corridas = libro.getSheets()
    .filter(h => !h.isSheetHidden())
    .map(h => h.getName())
    .filter(Boolean);

  return { ok: true, marca: describirMarca_(marca), corridas };
}

function calcularFactores_(claveEntrada, marcaEntrada, corridaEntrada, ingresoEntrada) {
  const empleado = validarEmpleado_(claveEntrada);
  if (!empleado.ok) return empleado;

  const marca = normalizarMarca_(marcaEntrada);
  if (!marca || !CONFIG.TABLAS[marca]) return { ok: false, mensaje: 'Marca no válida.' };
  if (!empleado.empleado.marcas.some(m => m.codigo === marca)) {
    return { ok: false, mensaje: 'Tu usuario no tiene acceso a esa marca.' };
  }

  const ingreso = numero_(ingresoEntrada);
  if (!isFinite(ingreso) || ingreso < 0) return { ok: false, mensaje: 'Escribe un ingreso válido, sin IVA.' };

  const libro = SpreadsheetApp.openById(CONFIG.TABLAS[marca].id);
  const corrida = String(corridaEntrada || '').trim();
  const hoja = libro.getSheetByName(corrida);
  if (!hoja) return { ok: false, mensaje: 'No encontré la corrida seleccionada.' };

  const valores = hoja.getDataRange().getValues();
  const mostrados = hoja.getDataRange().getDisplayValues();
  if (valores.length < 2) return { ok: false, mensaje: 'La tabla de esta corrida está vacía.' };

  const encabezados = valores[0].map(normalizarEncabezado_);
  const idx = {
    pk: buscarColumna_(encabezados, ['PK', 'PK1']),
    pp: buscarColumna_(encabezados, ['PP', 'PP1']),
    ingreso: buscarColumna_(encabezados, ['INGRESO']),
    ingresoMinimo: buscarColumna_(encabezados, ['INGRESOMINIMO'])
  };
  if (idx.pk < 0 || idx.pp < 0 || idx.ingreso < 0) {
    return { ok: false, mensaje: 'No pude identificar las columnas PK, PP e INGRESO en esta pestaña.' };
  }

  const filas = [];
  for (let i = 1; i < valores.length; i++) {
    const limite = numero_(valores[i][idx.ingreso]);
    const pk = numero_(valores[i][idx.pk]);
    const pp = numero_(valores[i][idx.pp]);
    if (!isFinite(limite) || !isFinite(pk) || !isFinite(pp)) continue;
    filas.push({ fila: i + 1, limite, pk, pp, pkTexto: mostrados[i][idx.pk], ppTexto: mostrados[i][idx.pp] });
  }
  filas.sort((a, b) => a.limite - b.limite);
  if (!filas.length) return { ok: false, mensaje: 'No encontré rangos válidos en la tabla.' };

  // Se toma el mayor rango cuyo ingreso sea menor o igual al reportado.
  let factor = filas[0];
  for (const fila of filas) {
    if (fila.limite <= ingreso) factor = fila;
    else break;
  }

  const primeraPP = filas.find(f => f.pp > 0);
  let ingresoMinimoPP = primeraPP ? primeraPP.limite : null;
  if (primeraPP && idx.ingresoMinimo >= 0) {
    const valorMin = numero_(valores[primeraPP.fila - 1][idx.ingresoMinimo]);
    if (isFinite(valorMin)) ingresoMinimoPP = valorMin;
  }

  registrarConsulta_(empleado.empleado, marca, corrida);

  return {
    ok: true,
    empleado: empleado.empleado,
    marca: describirMarca_(marca),
    corrida,
    ingreso,
    ingresoMinimoPP,
    alcanzoPP: factor.pp > 0,
    factor: {
      pk: factor.pk,
      pp: factor.pp,
      pkTexto: formatoFactor_(factor.pkTexto, factor.pk),
      ppTexto: formatoFactor_(factor.ppTexto, factor.pp),
      rangoDesde: factor.limite
    }
  };
}

function buscarColumna_(encabezados, candidatos) {
  for (const c of candidatos) {
    const exacta = encabezados.indexOf(c);
    if (exacta >= 0) return exacta;
  }
  for (let i = 0; i < encabezados.length; i++) {
    if (candidatos.some(c => encabezados[i].startsWith(c))) return i;
  }
  return -1;
}

function describirMarca_(codigo) {
  return { codigo, nombre: CONFIG.TABLAS[codigo].nombre };
}

function normalizarMarca_(valor) {
  return String(valor || '').toUpperCase().replace(/[\s_-]+/g, '');
}

function normalizarEncabezado_(valor) {
  return String(valor || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
}

function limpiarClave_(valor) {
  return String(valor == null ? '' : valor).trim().replace(/\.0$/, '');
}

function numero_(valor) {
  if (typeof valor === 'number') return valor;
  let t = String(valor == null ? '' : valor).trim().replace(/[$\s]/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = t.replace(',', '.');
  return Number(t);
}

function formatoFactor_(texto, numero) {
  const t = String(texto == null ? '' : texto).trim();
  if (t && !/^[-+]?\d+(?:[.,]\d+)?$/.test(t)) return t;
  return Number(numero).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function responder_(objeto, callback) {
  const json = JSON.stringify(objeto);
  if (callback) {
    return ContentService.createTextOutput(String(callback) + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}


function registrarConsulta_(empleado, marca, corrida) {
  try {
    const libro = SpreadsheetApp.openById(CONFIG.EMPLEADOS_ID);
    let hoja = libro.getSheetByName('ESTADISTICAS');
    if (!hoja) {
      hoja = libro.insertSheet('ESTADISTICAS');
      hoja.appendRow(['FECHA', 'CLAVE', 'NOMBRE', 'ROL', 'MARCA', 'CORRIDA']);
      hoja.setFrozenRows(1);
    }
    hoja.appendRow([new Date(), empleado.clave, empleado.nombre, empleado.rol, CONFIG.TABLAS[marca].nombre, corrida]);
  } catch (e) {
    console.log('No se pudo registrar la consulta: ' + e.message);
  }
}

function obtenerEstadisticas_(claveEntrada) {
  const empleado = validarEmpleado_(claveEntrada);
  if (!empleado.ok) return empleado;
  if (empleado.empleado.rol !== 'ADMIN') return { ok: false, mensaje: 'Esta sección es exclusiva para administradores.' };

  const libro = SpreadsheetApp.openById(CONFIG.EMPLEADOS_ID);
  const hoja = libro.getSheetByName('ESTADISTICAS');
  if (!hoja || hoja.getLastRow() < 2) {
    return { ok: true, resumen: { hoy: 0, total: 0, empleadosUnicos: 0, horaPico: 'Sin datos' }, porMarca: [], topCorridas: [], actualizado: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Mexico_City', 'dd/MM/yyyy HH:mm') };
  }

  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, 6).getValues();
  const zona = Session.getScriptTimeZone() || 'America/Mexico_City';
  const hoyTexto = Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd');
  const empleados = new Set();
  const marcas = {};
  const corridas = {};
  const horas = {};
  let hoy = 0;

  datos.forEach(f => {
    const fecha = f[0] instanceof Date ? f[0] : new Date(f[0]);
    if (isNaN(fecha.getTime())) return;
    const clave = limpiarClave_(f[1]);
    const marca = String(f[4] || 'Sin marca');
    const corrida = String(f[5] || 'Sin corrida');
    empleados.add(clave);
    marcas[marca] = (marcas[marca] || 0) + 1;
    corridas[corrida] = (corridas[corrida] || 0) + 1;
    const hora = Utilities.formatDate(fecha, zona, 'HH:00');
    horas[hora] = (horas[hora] || 0) + 1;
    if (Utilities.formatDate(fecha, zona, 'yyyy-MM-dd') === hoyTexto) hoy++;
  });

  const ordenar = obj => Object.keys(obj).map(k => ({ nombre: k, valor: obj[k] })).sort((a, b) => b.valor - a.valor);
  const listaHoras = ordenar(horas);
  return {
    ok: true,
    resumen: { hoy, total: datos.length, empleadosUnicos: empleados.size, horaPico: listaHoras.length ? listaHoras[0].nombre : 'Sin datos' },
    porMarca: ordenar(marcas),
    topCorridas: ordenar(corridas).slice(0, 8),
    actualizado: Utilities.formatDate(new Date(), zona, 'dd/MM/yyyy HH:mm')
  };
}
