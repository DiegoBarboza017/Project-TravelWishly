/**
 * Lógica Front-End para Interfaz Interactiva Web (TravelWishly)
 * Framework agnóstico - Vanilla Javascript moderno
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("✈️ TravelWishly Core JavaScript Inicializado con Exito");
    obtenerTasasReales(); // Traer tasas de cambio al cargar

    // Resaltar el enlace activo del navbar según la URL actual
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-page-link').forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        if (linkPath === currentPath) {
            link.style.borderBottom = '3px solid #000';
            link.style.paddingBottom = '2px';
        }
    });

    // Flujo Global Lineal (Auto-Cargas por URL)
    if (currentPath === '/dashboard') {
        const p = new URLSearchParams(window.location.search);
        if (p.has('destino')) {
            const dest = p.get('destino');
            localStorage.setItem('tw_last_destination', dest);
            const destInput = document.getElementById('destinoSugerido');
            if (destInput) {
                destInput.value = dest;
                if (window.sugerirPresupuestoBuscador) {
                    window.sugerirPresupuestoBuscador(dest);
                }
                setTimeout(() => { destInput.scrollIntoView({behavior: 'smooth', block: 'center'}); }, 500);
            }
        }
    } else if (currentPath === '/constructor') {
        const p = new URLSearchParams(window.location.search);
        let dest = null;
        if (p.has('destino')) {
            dest = p.get('destino');
        } else if (localStorage.getItem('tw_last_destination')) {
            dest = localStorage.getItem('tw_last_destination');
        }
        
        if (dest) {
            const rutaDest = document.getElementById('rutaDestino');
            if (rutaDest) rutaDest.value = dest;
            if (p.has('budget')) {
                // Info that they came from budget
                console.log("Presupuesto proyectado:", p.get('budget'));
            }
        }

        // === VALIDACIÓN: Fecha mínima = hoy (no se puede elegir fecha pasada) ===
        const rutaFechaInput = document.getElementById('rutaFecha');
        if (rutaFechaInput) {
            const hoy = new Date();
            const yyyy = hoy.getFullYear();
            const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd   = String(hoy.getDate()).padStart(2, '0');
            rutaFechaInput.setAttribute('min', `${yyyy}-${mm}-${dd}`);

            // Prevenir escritura manual de fechas anteriores
            rutaFechaInput.addEventListener('change', function() {
                const seleccionada = new Date(this.value + 'T00:00:00');
                const hoyCheck    = new Date();
                hoyCheck.setHours(0, 0, 0, 0);
                if (seleccionada < hoyCheck) {
                    this.value = `${yyyy}-${mm}-${dd}`;
                    alert('⚠️ La fecha de salida no puede ser anterior a hoy. Se ha restablecido a la fecha actual.');
                }
            });
        }

        // Auto-Rehidratación del Constructor desde la BD de Historial
        const params = new URLSearchParams(window.location.search);
        if (params.has('history_id')) {
            const historyId = params.get('history_id');
            fetch(`/api/get_route/${historyId}`)
            .then(r => r.json())
            .then(data => {
                if(data.success) {
                    if (document.getElementById('rutaOrigen')) document.getElementById('rutaOrigen').value = data.origen;
                    if (document.getElementById('rutaDestino')) document.getElementById('rutaDestino').value = data.destino;
                    if (document.getElementById('rutaDuracion')) document.getElementById('rutaDuracion').value = data.duracion_dias;
                    if (document.getElementById('rutaFecha') && data.fecha_ideal && data.fecha_ideal !== 'None') document.getElementById('rutaFecha').value = data.fecha_ideal;
                    
                    // Auto-trigger principal de la generación (UX)
                    setTimeout(() => {
                        if(window.generarRutaInteligente) window.generarRutaInteligente();
                    }, 600);

                    // Rehidratación Asincrónica en Cascada (Mochila, Vibes, PackingList)
                    setTimeout(() => {
                        try {
                            const mochilas = JSON.parse(data.mochila_state || '[]');
                            mochilas.forEach(id => {
                                const cb = document.getElementById(id);
                                if(cb) cb.checked = true;
                            });
                            if(window.calcularMochila) window.calcularMochila();
                        } catch(e){}
                    }, 800);

                    setTimeout(() => {
                        try {
                            const vibes = JSON.parse(data.vibes_state || '[]');
                            vibes.forEach(vibe => {
                                const btn = document.querySelector(`button[onclick*="recomendarDestino('${vibe}'"]`);
                                if(btn) window.recomendarDestino(vibe, btn);
                            });
            // Marcar ruta como generada correctamente
            window.rutaYaGenerada = true;
            
        } catch(e) {}
                    }, 1000);

                    // Damos ~2500ms para asegurar que `cargarPackingList` ya inyectó el HTML semántico global 
                    setTimeout(() => {
                        try {
                            const packings = JSON.parse(data.packing_state || '[]');
                            packings.forEach(id => {
                                const packDiv = document.getElementById(id);
                                if(packDiv) {
                                    // Simula un toggle pero forzando True en toggle visual
                                    packDiv.classList.add('checked');
                                    const icon = packDiv.querySelector('i');
                                    if(icon) {
                                        icon.className = 'bi bi-check-square-fill';
                                        icon.style.cssText = 'min-width:18px;font-size:1rem;flex-shrink:0;color:#fff;';
                                    }
                                }
                            });
                            if(window.actualizarProgressPacking) window.actualizarProgressPacking();
                        } catch(e){}
                    }, 3000); 
                }
            });
        }
    }


});

/* =========================================================================
   MÓDULO: CALCULADORA Y PANEL DE ESTADÍSTICAS
========================================================================= */
let donutGráficoInstancia = null; // Almacenamiento de Chart global.
let financeChartInstancia = null; // Gráfico de simulación de crédito

const ESTILOS_VIAJE = {
    'mochilero': { hospedaje: 0.20, vuelos: 0.40, comida: 0.25, actividades: 0.15 },
    'estandar':  { hospedaje: 0.35, vuelos: 0.30, comida: 0.20, actividades: 0.15 },
    'lujo':      { hospedaje: 0.50, vuelos: 0.15, comida: 0.20, actividades: 0.15 }
};

let TASAS_CAMBIO = {
    'MXN': { tasa: 1, simbolo: '$' },
    'USD': { tasa: 1 / 17.0, simbolo: '$' },
    'EUR': { tasa: 1 / 18.5, simbolo: '€' },
    'CAD': { tasa: 1 / 12.5, simbolo: '$' },
    'GBP': { tasa: 1 / 21.5, simbolo: '£' },
    'JPY': { tasa: 1 / 0.11, simbolo: '¥' },
    'AUD': { tasa: 1 / 11.2, simbolo: '$' },
    'CHF': { tasa: 1 / 19.5, simbolo: 'CHF' },
    'CNY': { tasa: 1 / 2.3, simbolo: '¥' },
    'ARS': { tasa: 50.0, simbolo: '$' },
    'COP': { tasa: 220.0, simbolo: '$' },
    'CLP': { tasa: 50.0, simbolo: '$' },
    'PEN': { tasa: 0.22, simbolo: 'S/' },
    'BRL': { tasa: 0.30, simbolo: 'R$' },
    'RUB': { tasa: 5.5, simbolo: '₽' },
    'INR': { tasa: 4.8, simbolo: '₹' }
};

// Fetch asíncrono de divisas de la vida real (API pública grauita)
async function obtenerTasasReales() {
    try {
        console.log("✈️ Solicitando tasas de cambio reales (Base MXN)...");
        // Utilizamos Open Exchange Rates API (dominio público, sin auth key)
        const response = await fetch('https://open.er-api.com/v6/latest/MXN');
        const data = await response.json();
        
        if (data && data.rates) {
            for (let currency in TASAS_CAMBIO) {
                if (data.rates[currency]) {
                    TASAS_CAMBIO[currency].tasa = data.rates[currency];
                }
            }
            console.log("✅ Tasas actualizadas dinámicamente desde API.");
        }
    } catch (error) {
        console.warn("⚠️ No se pudieron cargar las tasas en vivo. Utilizando modo offline/estimado.", error);
    }
}

/** @function calcularDistribucion ejecuta reglas de negocio prespuestarias */
function calcularDistribucion() {
    const inputIngresos = document.getElementById('ingresosMensuales');
    const inputAhorros = document.getElementById('capacidadAhorro');
    const inputViaje = document.getElementById('viajeObjetivo');
    const selectorEstilo = document.getElementById('estiloViaje');
    const selectorDivisa = document.getElementById('divisaSeleccionada');

    if(!inputIngresos || !inputAhorros || !inputViaje) return; // Fail fast

    const ingreso = parseFloat(inputIngresos.value);
    const ahorroPorcentaje = parseFloat(inputAhorros.value);
    const capitalViajeEst = parseFloat(inputViaje.value);

    // Valores de selectores
    const estiloSelec = selectorEstilo ? selectorEstilo.value : 'estandar';
    const divisaSelec = selectorDivisa ? selectorDivisa.value : 'MXN';

    // Validación Básica Front
    if(isNaN(ingreso) || isNaN(ahorroPorcentaje) || isNaN(capitalViajeEst) || capitalViajeEst <= 0) {
        alert("⚠️ Por favor revisa los campos. Ingresa números válidos y un presupuesto meta mayor a cero.");
        return;
    }

    if(ahorroPorcentaje <= 0 || ahorroPorcentaje > 100) {
        alert("⚠️ La capacidad de ahorro debe especificarse estrictamente entre 1 y 100 porciento.");
        return;
    }

    // -- Cálculos Lógicos Internos
    // Extraemos la tasa y el layout de porcentajes de estilo
    const conversion = TASAS_CAMBIO[divisaSelec];
    const perfil = ESTILOS_VIAJE[estiloSelec];

    // Ahorro monetario en base a la capacidad porcentual elegida
    const capacidadMonetariaAhorro = ingreso * (ahorroPorcentaje / 100);
    // Calcular meses brutos y redondear
    const mesesParaAhorrarAprox = Math.ceil(capitalViajeEst / capacidadMonetariaAhorro);

    // -- Modelo Económico de TravelWishly
    const capitalConvertido = capitalViajeEst * conversion.tasa;
    const ahorroConvertido = capacidadMonetariaAhorro * conversion.tasa;

    const distribucion = {
        hospedaje: capitalConvertido * perfil.hospedaje,
        vuelos: capitalConvertido * perfil.vuelos,
        comida: capitalConvertido * perfil.comida,
        actividades: capitalConvertido * perfil.actividades,
        simbolo: conversion.simbolo,
        divisa: divisaSelec,
        perfil_nombres: {
            hospedaje: `Hospedaje (${perfil.hospedaje * 100}%)`,
            vuelos: `T. y Vuelos (${perfil.vuelos * 100}%)`,
            comida: `Alimentación (${perfil.comida * 100}%)`,
            actividades: `Actividades (${perfil.actividades * 100}%)`
        }
    };

    renderizarPanelGraficas(distribucion);
    actualizarTextosDeInsights(ahorroConvertido, mesesParaAhorrarAprox, distribucion, ingreso, capitalViajeEst);

    // Guardar estado de la proyección para el modal de recordatorios de ahorro
    const destinoEl2 = document.getElementById('destinoSugerido');
    const destinoString = destinoEl2 ? destinoEl2.value.trim() : '';
    if (destinoEl2) localStorage.setItem('tw_last_destination', destinoString);
    window._lastSavingsCalc = {
        destination:    destinoString,
        monthlyAmount:  parseFloat(capacidadMonetariaAhorro.toFixed(2)),
        totalMonths:    mesesParaAhorrarAprox,
        currency:       divisaSelec,
        currencySymbol: conversion.simbolo
    };

    // Actualizar Módulos de Survival Kit y Mapa
    if (window.generarKitVocabulario) window.generarKitVocabulario(destinoString);
    if (window.pintarMapaLeaflet) window.pintarMapaLeaflet(destinoString);
    
    // Auto-actualizar Divisa base del Conversor Local
    const fromSelect = document.getElementById('fromCurrency');
    const toSelect = document.getElementById('toCurrency');
    if (fromSelect && toSelect) {
        // En base a la moneda del presupuesto meta
        fromSelect.value = divisaSelec;
        // Asignar divisa destino en base a la DB (extraer país)
        let monedaTargetStr = "USD"; 
        if (typeof TODOS_DESTINOS_DB !== 'undefined') {
            let targetCtry = destinoString.includes(',') ? destinoString.split(',')[1].trim() : destinoString;
            const bdDestino = TODOS_DESTINOS_DB.find(db => db.pais === targetCtry || db.ciudad === targetCtry);
            if(bdDestino && bdDestino.moneda) {
                monedaTargetStr = bdDestino.moneda.split(' ')[0].trim(); // "JPY (Yen)" -> "JPY"
            }
        }
        
        // Agregar option dinamicamente si no existe
        let opts = Array.from(toSelect.options).map(o => o.value);
        if(!opts.includes(monedaTargetStr)) {
            let nOpt = document.createElement('option');
            nOpt.value = monedaTargetStr;
            nOpt.text = monedaTargetStr;
            toSelect.add(nOpt);
        }
        toSelect.value = monedaTargetStr;
        if(window.convertCurrency) window.convertCurrency();
    }

    // Activar Botón de Flujo Continuo a Itinerario
    const btnFlujo = document.getElementById('btnContinuarItinerario');
    if (btnFlujo) btnFlujo.classList.remove('d-none');
}

/** @function continuarAItinerario Extrae variables y redirige al constructor */
window.continuarAItinerario = function() {
    const destinoEl = document.getElementById('destinoSugerido');
    const budgetEl = document.getElementById('viajeObjetivo');
    let url = '/constructor';
    let params = new URLSearchParams();
    
    if (destinoEl && destinoEl.value) params.append('destino', destinoEl.value);
    if (budgetEl && budgetEl.value) params.append('budget', budgetEl.value);
    
    if(params.toString()) {
        window.location.href = url + '?' + params.toString();
    } else {
        window.location.href = url;
    }
};

/** 
 * Actualiza el Canvas Chart.js del Frontend con transiciones animadas 
 * @param {Object} distr - Objeto con valores numéricos calculados.
 */
function renderizarPanelGraficas(distr) {
    const canvas = document.getElementById('budgetGraphic');
    const placeholder = document.getElementById('chartPlaceholder');
    const wrapper = document.getElementById('chartWrapper');
    
    // Switch de UI
    placeholder.classList.add('d-none');
    wrapper.classList.remove('d-none');
    canvas.classList.remove('d-none');

    // Inicializar o Re-crear Contexto ChartJS
    const areaContextual = canvas.getContext('2d');

    // Limpieza de memoria (Obligatorio en ChartJS al redibujar variables)
    if(donutGráficoInstancia !== null) {
        donutGráficoInstancia.destroy();
    }

    donutGráficoInstancia = new Chart(areaContextual, {
        type: 'doughnut',
        data: {
            labels: [
                distr.perfil_nombres.hospedaje, 
                distr.perfil_nombres.vuelos, 
                distr.perfil_nombres.comida, 
                distr.perfil_nombres.actividades
            ],
            datasets: [{
                label: `Cifra Asignada (${distr.divisa})`,
                data: [distr.hospedaje, distr.vuelos, distr.comida, distr.actividades],
                backgroundColor: [
                    '#FF3366', // Vibrant Pink
                    '#00E5FF', // Cyan
                    '#FFEA00', // Yellow
                    '#00E676'  // Bright Green
                ],
                borderWidth: 3,
                borderColor: '#000000',
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeOutQuart',
                animateScale: true,
                animateRotate: true
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 15, font: {family: "'Segoe UI', sans-serif"} }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return ` ${distr.simbolo}` + ctx.parsed.toFixed(2); }
                    }
                }
            }
        }
    });
}

/* =========================================================================
   MÓDULO: SIMULADOR DE FINANCIAMIENTO / CRÉDITO
========================================================================= */

// Plazo seleccionado actualmente (default 12 meses)
let plazoSeleccionado = 12;

/** @function seleccionarPlazo actualiza el plazo y recalcula */
function seleccionarPlazo(meses, btnElement) {
    plazoSeleccionado = meses;

    // Resetear botones
    document.querySelectorAll('.btn-plazo').forEach(b => {
        b.classList.remove('btn-dark', 'text-white');
        b.classList.add('btn-outline-dark');
        b.innerHTML = b.dataset.meses;
    });

    // Destacar el presionado
    if (btnElement) {
        btnElement.classList.remove('btn-outline-dark');
        btnElement.classList.add('btn-dark', 'text-white');
        btnElement.innerHTML = `${meses} ⭐`;
    }

    // Actualizar input oculto
    const inputMeses = document.getElementById('fMeses');
    if (inputMeses) inputMeses.value = meses;

    simularCredito();
}

/**
 * @function calcularCuota fórmula de amortización estándar francesa
 * PMT = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
 * @param {number} principal - Monto a financiar
 * @param {number} tasaAnual - Tasa de interés anual en %
 * @param {number} meses     - Número de cuotas mensuales
 * @returns {number} Cuota mensual
 */
function calcularCuota(principal, tasaAnual, meses) {
    if (tasaAnual === 0) return principal / meses;
    const r = (tasaAnual / 100) / 12;
    return principal * (r * Math.pow(1 + r, meses)) / (Math.pow(1 + r, meses) - 1);
}

/** @function simularCredito ejecuta la simulación y actualiza la UI */
function simularCredito() {
    const monto    = parseFloat(document.getElementById('fMonto')?.value) || 0;
    const enganche = parseFloat(document.getElementById('fEnganche')?.value) || 0;
    const tasa     = parseFloat(document.getElementById('fTasa')?.value);
    const meses    = plazoSeleccionado;

    const panelVacio    = document.getElementById('resultadoVacio');
    const panelResultado = document.getElementById('resultadoPanel');

    // Validar entradas mínimas
    if (!monto || monto <= 0 || isNaN(tasa) || tasa < 0) {
        if (panelVacio)    panelVacio.classList.remove('d-none');
        if (panelResultado) panelResultado.classList.add('d-none');
        return;
    }

    const principal = Math.max(0, monto - enganche);

    // Calcular KPIs principales
    const cuota        = calcularCuota(principal, tasa, meses);
    const totalPagar   = cuota * meses + enganche;
    const totalIntereses = totalPagar - monto;
    const porcentajeCosto = ((totalIntereses / monto) * 100);

    // Mostrar panel
    if (panelVacio)    panelVacio.classList.add('d-none');
    if (panelResultado) panelResultado.classList.remove('d-none');

    // KPIs
    const fmt = (n) => '$' + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    document.getElementById('kpiMensual').innerText   = fmt(cuota);
    document.getElementById('kpiTotal').innerText     = fmt(totalPagar);
    document.getElementById('kpiIntereses').innerText = fmt(Math.max(0, totalIntereses));
    document.getElementById('kpiCAT').innerText       = porcentajeCosto.toFixed(1) + '%';

    // Tabla comparativa con [3, 6, 12, 18, 24] meses
    const plazos = [3, 6, 12, 18, 24];
    const tabla  = document.getElementById('tablaComparativa');
    if (tabla) {
        tabla.innerHTML = plazos.map(p => {
            const c    = calcularCuota(principal, tasa, p);
            const tot  = c * p + enganche;
            const int  = Math.max(0, tot - monto);
            const esActual = p === meses;
            const bgClass = esActual ? 'table-warning fw-black' : '';
            return `<tr class="${bgClass}">
                <td class="fw-black">${p} meses ${esActual ? '⭐' : ''}</td>
                <td>${fmt(c)}</td>
                <td>${fmt(tot)}</td>
                <td class="${esActual ? 'text-dark' : 'text-danger'}">${fmt(int)}</td>
            </tr>`;
        }).join('');
    }

    // Render de Gráfico Costo Real
    const canvasFinance = document.getElementById('financeChart');
    if (canvasFinance) {
        const areaFinance = canvasFinance.getContext('2d');
        if (financeChartInstancia !== null) {
            financeChartInstancia.destroy();
        }
        financeChartInstancia = new Chart(areaFinance, {
            type: 'doughnut',
            data: {
                labels: ['Valor Original (Sin Intereses)', 'Costo Extra (Intereses Puros)'],
                datasets: [{
                    label: 'Costo Real',
                    data: [monto, Math.max(0, totalIntereses)],
                    backgroundColor: ['#212529', '#dc3545'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { weight: 'bold' }, color: '#000' } }
                }
            }
        });
    }

    // Consejo inteligente contextual
    const consejoEl = document.getElementById('consejoTexto');
    if (consejoEl) {
        if (tasa === 0) {
            consejoEl.innerHTML = '🟢 <strong>¡Excelente!</strong> Con 0% de interés estás aprovechando una promoción de Meses Sin Intereses (MSI). Asegúrate de que el banco no cobre comisiones ocultas por apertura ni anualidad.';
        } else if (tasa <= 20) {
            consejoEl.innerHTML = `🟡 <strong>Tasa aceptable.</strong> Con ${tasa}% anual pagarás ${fmt(totalIntereses)} de intereses en total. Considera adelantar pagos si puedes, cada abono extra reduce directamente el capital y ahorra meses.`;
        } else if (tasa <= 45) {
            consejoEl.innerHTML = `🟠 <strong>Tasa elevada.</strong> Con ${tasa}% anual el crédito te cuesta ${porcentajeCosto.toFixed(1)}% extra sobre el valor. Evalúa si es posible ahorrar 2-3 meses adicionales para pagar de contado y evitar este costo.`;
        } else {
            consejoEl.innerHTML = `🔴 <strong>¡Alto costo!</strong> Con ${tasa}% anual estás pagando ${fmt(totalIntereses)} solo en intereses. Te recomendamos muy firmemente buscar una opción de crédito con menor tasa o renegociar con tu banco antes de comprometerte.`;
        }
    }
}

function actualizarTextosDeInsights(monedaAhorradaXMes, cantMeses, distr, ingresoBaseMXN, metaBaseMXN) {
    const contenedor = document.getElementById('calculoInsights');
    const textoInfo = document.getElementById('mesesAhorroTexto');
    
    contenedor.classList.remove('d-none');
    
    // Logica plurar/singular simple
    let mesPalabra = cantMeses === 1 ? "mes" : "meses";
    textoInfo.innerHTML = `Basado en tu situación, guardando <strong>${distr.simbolo}${monedaAhorradaXMes.toFixed(2)} ${distr.divisa}</strong> mensuales, necesitarás aproximadamente <strong>${cantMeses} ${mesPalabra}</strong> de disciplina constante para consolidar el fondo necesario de tu aventura asegurada.`;

    // 1. Escenarios de Tiempo
    document.getElementById('escenariosTiempo').classList.remove('d-none');
    
    // Relajado 10%
    const ahorroRelajado = ingresoBaseMXN * 0.10;
    const mesesRelajado = Math.ceil(metaBaseMXN / ahorroRelajado);
    document.getElementById('tiempoRelajado').innerText = `${mesesRelajado} meses`;
    
    // Propuesto
    document.getElementById('tiempoPropuesto').innerText = `${cantMeses} ${mesPalabra}`;
    
    // Agresivo 35%
    const ahorroAgresivo = ingresoBaseMXN * 0.35;
    const mesesAgresivo = Math.ceil(metaBaseMXN / ahorroAgresivo);
    document.getElementById('tiempoAgresivo').innerText = `${mesesAgresivo} meses`;

    // Visual Bar Ajuste (100% de fuerza = Ahorro Agresivo)
    const pxAhorroOriginal = Math.min(100, ((ingresoBaseMXN * ((cantMeses ? metaBaseMXN / cantMeses : 0)/ingresoBaseMXN)) / ahorroAgresivo) * 100);
    // Para simplificar la visual a nivel porcentual sobre el top 35% de agresión
    const capacidadActualDelUsuarioReal = (monedaAhorradaXMes / (TASAS_CAMBIO[distr.divisa].tasa || 1));
    const velocidadPorcentual = Math.min(100, Math.max(10, (capacidadActualDelUsuarioReal / ahorroAgresivo) * 100));

    document.getElementById('barPropuesto').style.width = `${velocidadPorcentual}%`;

    // 3. Asesor Inteligente
    document.getElementById('asesorInteligente').classList.remove('d-none');
    const asesorMsg = document.getElementById('asesorMensaje');
    
    if (metaBaseMXN < 5000) {
        asesorMsg.innerHTML = "💡 <strong>Tip Regional:</strong> Con este capital moderado, podrías disfrutar de unas excelentes vacaciones de fin de semana visitando un Pueblo Mágico cercano a ti, y usar Airbnb para economizar hospedaje.";
    } else if (metaBaseMXN >= 5000 && metaBaseMXN < 15000) {
        asesorMsg.innerHTML = "💡 <strong>Tip Local Low-Cost:</strong> ¡Muy bien! Tu presupuesto es ideal para empacar la mochila y explorar destinos sureños ricos en cultura como Oaxaca o Chiapas volando por VivaAerobus/Volaris.";
    } else if (metaBaseMXN >= 15000 && metaBaseMXN < 35000) {
        asesorMsg.innerHTML = "💡 <strong>Tip Sudamérica:</strong> Estás en el nivel óptimo para saltar la frontera sur. Colombia (Medellín/Bogotá) o Perú son opciones viables si planificas y pagas el vuelo con 3 meses de anticipación.";
    } else {
        asesorMsg.innerHTML = "💡 <strong>Tip Internacional VIP:</strong> ¡Felicidades! Tienes la solidez financiera para cruzar océanos. Destinos premier como Japón, España o Italia te esperan si logras mantener tu constancia de ahorro.";
    }
}

/* =========================================================================
   MÓDULO: MOTOR DE GUÍA TURÍSTICA CONTEXTUAL PREVENTIVA
========================================================================= */

// Data Fuente simulando un acceso a un API RESTful backend global
const INTELIGENCIA_DESTINOS_DB = [
    { ciudad: "Tokio", pais: "Japón", cultura: "Fusión de reverencia antigua y vanguardia digital. Respeta el silencio público en el Metro.", puntosInteres: ["Templo Senso-ji", "Akihabara", "Cruce Shibuya", "Shinjuku de Noche", "Monte Fuji", "Torre de Tokio", "Parque Ueno", "Mercado Tsukiji", "Santuario Meiji", "Jardines Nacionales"], zonasRojas: "Roppongi pasada la medianoche. Evita promotores de bares en la calle que podrían estafar." },
    { ciudad: "París", pais: "Francia", cultura: "Romanticismo puro, moda e historia extensa. Aprender francés básico abre muchísimas puertas.", puntosInteres: ["La Torre Eiffel", "Museo del Louvre", "Barrio de Montmartre", "Catedral de Notre Dame", "Arco de Triunfo", "Río Sena", "Palacio de Versalles", "Panteón de París", "Jardines de Luxemburgo", "Barrio Latino"], zonasRojas: "Los alrededores inmediatos de Gare du Nord por la noche. Ojo con el engaño del anillo de oro tirado en el piso." },
    { ciudad: "Cancún", pais: "México", cultura: "Paraíso caribeño orientado fuertemente al turismo, fiesta y relajación extrema. Respeta el delicado ecosistema.", puntosInteres: ["Isla Mujeres", "Chichén Itzá", "Xcaret", "Tulum", "Cobá", "Cenote Dos Ojos", "Playa Delfines", "Museo Subacuático (MUSA)", "Parque Kabah", "Zona Hotelera"], zonasRojas: "Evita caminar fuera de la zona hotelera o el centro turístico seguro durante la madrugada profunda." },
    { ciudad: "Londres", pais: "Reino Unido", cultura: "Fusión monárquica clásica y diversidad extrema global. Respeta a rajatabla las filas cívicas formadas al esperar.", puntosInteres: ["El Ojo de Londres", "Museo Británico", "El Támesis", "Torre de Londres", "Big Ben", "Abadía de Westminster", "Hyde Park", "Palacio Buckingham", "Piccadilly Circus", "Trafalgar Square"], zonasRojas: "Aglomeraciones turísticas altas cerca de Piccadilly Circus y el tubo subterráneo central están plagadas de distracciones." },
    { ciudad: "Río de Janeiro", pais: "Brasil", cultura: "Capital incansable con samba en las venas. La interacción es cariñosamente táctil y muy expresiva. ¡Usa protector!", puntosInteres: ["Cristo Redentor", "Pan de Azúcar", "Playa Copacabana", "Ipanema", "Escalera Selarón", "Estadio Maracaná", "Jardín Botánico", "Parque Lage", "Barrio Santa Teresa", "Museo del Mañana"], zonasRojas: "Pasear de noche solitariamente por las playas. Las Favelas son prohibidas si no tienes un contacto oficial." },
    { ciudad: "Lima", pais: "Perú", cultura: "Capital en un acantilado del pacífico, cima indiscutible de comida criolla de exportación e historia incaica.", puntosInteres: ["Malecón de Miraflores", "Plaza de Armas", "Circuito del Agua", "Huaca Pucllana", "Barranco", "Museo Larco", "Parque del Amor", "Mercado Surquillo", "Catedral de Lima", "Callao Monumental"], zonasRojas: "Barrios como Callao y el centro norte cuando empieza a bajar el sol radicalmente." },
    { ciudad: "Bogotá", pais: "Colombia", cultura: "Urbe elevadísima cerca de las nubes, capital cafetera y un foco inmenso de la cultura de galerías artísticas.", puntosInteres: ["Museo del Oro", "Cerro de Monserrate", "La Candelaria", "Plaza de Bolívar", "Museo Botero", "Usaquén", "Jardín Botánico", "Parque de la 93", "Mercado Paloquemao", "Teatro Colón"], zonasRojas: "Las fronteras sureñas de la ciudad sin razón aparente. Usa Apps de transporte tarde." },
    { ciudad: "Bangkok", pais: "Tailandia", cultura: "La capital de las sonrisas. Tensión de caos y espiritualidad masiva. Viste con modestia en los templos.", puntosInteres: ["Gran Palacio", "Wat Arun", "Mercado Chatuchak", "Khao San Road", "Wat Pho", "Ayutthaya", "Mercado Flotante", "China Town", "Parque Lumphini", "Río Chao Phraya"], zonasRojas: "Ten extremo cuidado con las estafas en tuk-tuks, los viajes 'fuera de registro', y los carteristas en Khian Kha."}
];

// Módulo de Salud y Visados Global
const SALUD_DESTINOS_DB = {
    "mexico": "🏥 Sistema básico. No hay vacunas legalmente obligatorias para entrar en territorio mexicano. Recomendable repelente ecológico en costa.",
    "colombia": "🏥 Vacuna de Fiebre Amarilla es altamente documentable al aterrizar e ingresar por fronteras amazónicas. Seguros médicos se sugieren fuertemente.",
    "tailandia": "🩸 Obligatorio disponer del carnet de vacunación certificado contra la Fiebre Amarilla. Prevención contra mosquito portador de Dengue indispensable.",
    "brasil": "🩸 OBLIGACIÓN sanitaria internacional de certificado validado de Fiebre Amarilla, más altamente sugerido tratamiento profiláctico de Malaria en el lado norte.",
    "peru": "🏥 Zonas montañosas altas pueden causar 'Soroche' (mal de altura), se aconseja té de coca y Pastillas aclimatadoras al arribo. Fiebre Amarilla sugerida en jungla.",
    "japon": "🩺 Sistema Médico Ultra Seguro pero los precios a turistas son abismales sin la documentación o un seguro de viajero total. Visado usualmente de tránsito por 90 días.",
    "francia": "🛡️ Siendo de territorio 'Schengen' Europeo obligatorio arribar con pre-vuelos de salida y reservas garantizadas de hotel para evadir deportaciones aéreas express.",
    "reino unido": "🛡️ Frontera estricta del First World. Exigen itinerario completo documentable, tarjeta de crédito y seguro médico extenso bajo juramento consuetudinario."
};

document.addEventListener("DOMContentLoaded", () => {
    // Poblar datalist global dinámicamente
    const guiaList = document.getElementById('guiaDestinosList');
    if (guiaList) {
        INTELIGENCIA_DESTINOS_DB.forEach(d => {
            const op = document.createElement('option');
            op.value = `${d.ciudad}, ${d.pais}`;
            guiaList.appendChild(op);
        });
    }
});

/** @function cargarGuiaSegura busca dentro del array y reemplaza/anima elementos DOM */
window.cargarGuiaSegura = function cargarGuiaSegura() {
    const selectorObj = document.getElementById('destinosDropdown');
    const panelUI = document.getElementById('panelDestino');
    
    if(!selectorObj || !panelUI) return;
    
    let txtBuscado = selectorObj.value.trim().toLowerCase();
    
    if (txtBuscado.length < 2) return;

    // Buscador "fuzzy/preciso" que prioriza lo que esté en nuestra base de datos.
    let destinoObj = INTELIGENCIA_DESTINOS_DB.find(db => 
        `${db.ciudad}, ${db.pais}`.toLowerCase() === txtBuscado ||
        db.ciudad.toLowerCase() === txtBuscado || 
        db.pais.toLowerCase() === txtBuscado
    );

    // Fallback Generativo Global Absoluto para cualquier ciudad/país del mundo de Nominatim
    if(!destinoObj && txtBuscado.length >= 2) {
        let originalText = selectorObj.value.trim();
        let cName = originalText;
        let pName = originalText;
        
        if(originalText.includes(',')) {
            let partes = originalText.split(',');
            cName = partes[0].trim();
            pName = partes[partes.length - 1].trim(); 
        }
        
        destinoObj = {
            ciudad: cName,
            pais: pName,
            cultura: `Descubre la cultura de ${cName}. Al explorar ${pName}, adáptate a los modismos y costumbres locales.`,
            zonasRojas: `Aplica el sentido común internacional. ${cName} posee riesgos estándar por aglomeraciones. Mantén alerta tus pertenencias.`,
            puntosInteres: [
                `La Plaza o Zócalo Mayor`,
                `Centro Histórico Principal`,
                `Mercados Tradicionales de ${cName}`,
                `Museo Antropológico Regional`,
                `Áreas Verdes y Parques Centrales`,
                `Avenida Principal de Compras`,
                `Catedrales o Templos Históricos`,
                `Paseos Peatonales Emblemáticos`,
                `Atracciones y Reservas Naturales`,
                `Zona de Teatros y Vida Nocturna`
            ]
        };
    }

    // Si no hizo click todavia o solo esta tecleando
    if(!destinoObj) { 
        panelUI.classList.add('d-none');
        return; 
    }

    // Despliegue de Panel Oculto Inicial
    panelUI.classList.remove('d-none');

    // Inyección de Strings Base
    document.getElementById('panelTitulo').innerText = `${destinoObj.ciudad}, ${destinoObj.pais}`;
    document.getElementById('panelCultura').innerText = destinoObj.cultura;
    
    const panelEvitar = document.getElementById('panelEvitar');
    if (panelEvitar) {
        // Render simple for redzones
        const warnStr = destinoObj.zonasRojas || "Respeta estrictamente las normas sociales y cuida bien de tus pertenencias de extremo valor.";
        panelEvitar.innerHTML = `<li class="list-group-item bg-dark text-white border-secondary fw-bold" style="line-height:1.6;"><i class="bi bi-shield-exclamation text-warning fs-5 me-2"></i> ${warnStr}</li>`;
    }

    // Procesamiento Sistema de Salud/Visados UI
    const docPaisLower = destinoObj.pais.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const healthBox = document.getElementById('healthAlertBox');
    const healthText = document.getElementById('healthAlertText');
    if (healthBox && healthText) {
        let notaSaludEncontrada = "";
        if(SALUD_DESTINOS_DB[docPaisLower]) {
            notaSaludEncontrada = SALUD_DESTINOS_DB[docPaisLower];
        } else {
            notaSaludEncontrada = `ℹ️ Para el territorio de ${destinoObj.pais}, se aconseja viajar con un Seguro Gastos Médicos de Cobertura Amplia. Los visados dependen expresamente de los tratados de comercio con tu pasaporte.`;
        }
        healthText.innerText = notaSaludEncontrada;
        healthBox.classList.remove('d-none');
    }

    // Idiomas reales por país — diccionario local de respaldo
    // Si la API de restcountries.com falla o no devuelve datos, usamos este mapa local
    // en lugar del texto genérico e INCORRECTO "Español y Lenguas Locales".
    const IDIOMAS_POR_PAIS = {
        "Japón":      ["Japonés"],
        "Francia":    ["Francés"],
        "México":     ["Español"],
        "Indonesia":  ["Indonesio (Bahasa)", "Javanés"],
        "EE.UU.":     ["Inglés"],
        "Argentina":  ["Español"],
        "Italia":     ["Italiano"],
        "España":     ["Español", "Catalán"],
        "Perú":       ["Español", "Quechua"],
        "Canadá":     ["Inglés", "Francés"],
        "Australia":  ["Inglés"],
        "E.A.U.":     ["Árabe", "Inglés"],
        "Islandia":   ["Islandés"],
        "Tailandia":  ["Tailandés"],
        "Alemania":   ["Alemán"],
        "Brasil":     ["Portugués"],
        "Chequia":    ["Checo"],
        "Polinesia":  ["Francés", "Tahitiano"],
        "Países Bajos": ["Neerlandés"],
    };

    // Fetch Dinámico de Idiomas Mundiales (Primary, Secondary)
    const panelIdioma = document.getElementById('panelIdiomas');
    if (panelIdioma) {
        panelIdioma.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Calculando Lenguajes...`;
        fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(destinoObj.pais)}`)
            .then(r => r.json())
            .then(data => {
                if (data && data[0] && data[0].languages) {
                    const l = Object.values(data[0].languages);
                    if (l.length >= 2) {
                        panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ${l[0].toUpperCase()} | SECUNDARIO: ${l.slice(1).join(', ').toUpperCase()}`;
                    } else {
                        panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ${l[0].toUpperCase()}`;
                    }
                } else {
                    const idiomasLocales = IDIOMAS_POR_PAIS[destinoObj.pais];
                    if (idiomasLocales) {
                        if (idiomasLocales.length >= 2) {
                            panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ${idiomasLocales[0].toUpperCase()} | SECUNDARIO: ${idiomasLocales.slice(1).join(', ').toUpperCase()}`;
                        } else {
                            panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ${idiomasLocales[0].toUpperCase()}`;
                        }
                    } else {
                        panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ESPAÑOL | SECUNDARIO: INGLÉS`;
                    }
                }
            }).catch(e => {
                const idiomasLocales = IDIOMAS_POR_PAIS[destinoObj.pais];
                if (idiomasLocales) {
                    if (idiomasLocales.length >= 2) {
                        panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ${idiomasLocales[0].toUpperCase()} | SECUNDARIO: ${idiomasLocales.slice(1).join(', ').toUpperCase()}`;
                    } else {
                        panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ${idiomasLocales[0].toUpperCase()}`;
                    }
                } else {
                    panelIdioma.innerHTML = `<i class="bi bi-translate me-2"></i> PRINCIPAL: ESPAÑOL | SECUNDARIO: INGLÉS`;
                }
            });
    }

    // Save for Flow
    window._guiaDestinoActual = `${destinoObj.ciudad}, ${destinoObj.pais}`;



    // Poblamiento Dinámico Iterativo de Checklist Beneficiosa
    const listaHtmlUl = document.getElementById('panelRecomendaciones');
    if (!listaHtmlUl) {
        console.warn('[cargarGuiaSegura] #panelRecomendaciones no encontrado en el DOM');
        return;
    }
    listaHtmlUl.innerHTML = ''; // Reset

    destinoObj.puntosInteres.forEach((punto, i) => {
        const elementoHijo = document.createElement('li');
        elementoHijo.className = "fs-6 fw-bold d-flex align-items-center bg-white border border-dark border-3 rounded-0 shadow-sm opacity-0 mx-0 mt-3 hover-lift";
        // Clic para Galería de 10 Imágenes
        elementoHijo.onclick = () => { if(window.abrirGaleria) window.abrirGaleria(punto, destinoObj.ciudad); };
        elementoHijo.style.cursor = "pointer";
        elementoHijo.style.boxShadow = "4px 4px 0 0 #000";

        elementoHijo.innerHTML = `
            <div class="bg-dark text-white p-3 d-flex align-items-center justify-content-center border-end border-3 border-dark" style="width: 50px;">
                <i class="bi bi-geo-alt-fill fs-5"></i>
            </div>
            <div class="flex-grow-1 p-3 text-uppercase align-items-center text-truncate tracking-wider">
                ${punto}
            </div>
            <div class="p-3 border-start border-3 border-dark bg-light d-flex align-items-center text-dark hover-yellow">
                <i class="bi bi-camera-fill fs-5"></i>
            </div>
        `;
        listaHtmlUl.appendChild(elementoHijo);
        
        // Animacion intro encadenada
        setTimeout(() => {
            elementoHijo.style.transition = 'opacity 0.4s ease-in, transform 0.4s ease-out';
            elementoHijo.style.transform = 'translateX(10px)';
        }, 10 + (i * 100));
        setTimeout(() => {
            elementoHijo.classList.remove('opacity-0');
            elementoHijo.style.transform = 'translateX(0px)';
        }, 30 + (i * 100));
    });

    // Nuevo: Fetch Seasonality API
    const badgeSeason = document.getElementById('seasonalityBadge');
    if (badgeSeason) {
        badgeSeason.className = "badge bg-secondary fs-6 rounded-0 border border-dark border-2 px-3 py-2 text-uppercase";
        badgeSeason.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Analizando Temporadas...';
        // Limpiar campos de texto de la temporada actual
        ['seasonalityClima','seasonalityRazon'].forEach(id => {
            const el = document.getElementById(id); if(el) el.innerText = '';
        });
        // Ocultar todos los wrappers de temporada y eventos
        ['seasonalityAltaWrapper','seasonalityMediaWrapper','seasonalityBajaWrapper','seasonalityEventosWrapper'].forEach(id => {
            const el = document.getElementById(id); if(el) el.classList.add('d-none');
        });
        
        fetch('/api/seasonality', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ destino: `${destinoObj.ciudad}, ${destinoObj.pais}` })
        })
        .then(r => r.json())
        .then(data => {
            if(data.success && data.data) {
                const s = data.data;
                const seasonUpper = s.temporada.toUpperCase();
                let bgClass = "bg-warning text-dark"; // Media por defecto
                if(seasonUpper.includes("ALTA")) bgClass = "bg-danger text-white";
                if(seasonUpper.includes("BAJA")) bgClass = "bg-success text-white";

                badgeSeason.className = `badge ${bgClass} fs-6 rounded-0 border border-dark border-2 px-3 py-2 text-uppercase`;
                badgeSeason.innerHTML = `<i class="bi bi-calendar-check me-2"></i> TEMPORADA ${seasonUpper} AHORA`;

                const climaEl = document.getElementById('seasonalityClima');
                const razonEl = document.getElementById('seasonalityRazon');
                if (climaEl) climaEl.innerHTML = `<strong>Clima:</strong> ${s.clima}`;
                if (razonEl) razonEl.innerText = `"${s.razon}"`;

                // ===== TEMPORADA ALTA =====
                const altaWrapper = document.getElementById('seasonalityAltaWrapper');
                if (altaWrapper && (s.temporada_alta_meses || s.temporada_alta_razon)) {
                    const altaMeses = document.getElementById('seasonalityAltaMeses');
                    const altaRazon = document.getElementById('seasonalityAltaRazon');
                    if (altaMeses) altaMeses.innerText = s.temporada_alta_meses || '';
                    if (altaRazon) altaRazon.innerText = s.temporada_alta_razon || '';
                    altaWrapper.classList.remove('d-none');
                }

                // ===== TEMPORADA MEDIA =====
                const mediaWrapper = document.getElementById('seasonalityMediaWrapper');
                if (mediaWrapper && (s.temporada_media_meses || s.temporada_media_razon)) {
                    const mediaMeses = document.getElementById('seasonalityMediaMeses');
                    const mediaRazon = document.getElementById('seasonalityMediaRazon');
                    if (mediaMeses) mediaMeses.innerText = s.temporada_media_meses || '';
                    if (mediaRazon) mediaRazon.innerText = s.temporada_media_razon || '';
                    mediaWrapper.classList.remove('d-none');
                }

                // ===== TEMPORADA BAJA =====
                const bajaWrapper = document.getElementById('seasonalityBajaWrapper');
                if (bajaWrapper && (s.temporada_baja_meses || s.temporada_baja_razon)) {
                    const bajaMeses = document.getElementById('seasonalityBajaMeses');
                    const bajaRazon = document.getElementById('seasonalityBajaRazon');
                    if (bajaMeses) bajaMeses.innerText = s.temporada_baja_meses || '';
                    if (bajaRazon) bajaRazon.innerText = s.temporada_baja_razon || '';
                    bajaWrapper.classList.remove('d-none');
                }

                // ===== EVENTOS =====
                if (s.eventos && s.eventos.length > 0) {
                    const ul = document.getElementById('seasonalityEventosList');
                    if(ul) ul.innerHTML = s.eventos.map(e => `<li>${e}</li>`).join('');
                    document.getElementById('seasonalityEventosWrapper').classList.remove('d-none');
                }
            } else {
                badgeSeason.className = "badge bg-dark fs-6 rounded-0 border border-dark border-2 px-3 py-2 text-uppercase";
                badgeSeason.innerText = "DATOS NO DISPONIBLES";
            }
        })
        .catch(e => {
            badgeSeason.innerText = "ERROR DE CONEXI\u00d3N";
        });
    }
}

/** @function continuarAPresupuesto redirige de Guía a Presupuesto usando el flujo global lineal */
window.continuarAPresupuesto = function() {
    if (window._guiaDestinoActual) {
        window.location.href = `/dashboard?destino=${encodeURIComponent(window._guiaDestinoActual)}`;
    }
};

/** @function abrirGaleria ejecuta el renderizado visual de 10 imagenes de Unsplash de cualquier parte */
window.abrirGaleria = function(puntoInteres, ciudadContexto) {
    const modalEl = document.getElementById('galleryModal');
    if(!modalEl) return;
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    
    document.getElementById('galleryModalLabel').innerHTML = `<i class="bi bi-images me-2"></i> EXPEDIENTE VISUAL: ${puntoInteres.toUpperCase()}`;
    document.getElementById('galleryLocationSubtitle').innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i> ${ciudadContexto.toUpperCase()}`;
    
    const spinner = document.getElementById('gallerySpinner');
    const grid    = document.getElementById('galleryGrid');
    
    spinner.classList.remove('d-none');
    grid.classList.add('d-none');
    grid.innerHTML = '';
    
    modal.show();

    // Construir keywords limpias (sin acentos)
    const clean = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/gi, '').trim();
    const cityKw = clean(ciudadContexto).split(' ')[0] || 'travel';
    const poiKw  = clean(puntoInteres).split(' ').filter(w => w.length >= 3)[0] || 'landmark';

    // Hash determinista del nombre de la CIUDAD + POI — garantiza seed ÚNICO por país y punto de interés
    const hashString = ciudadContexto.toLowerCase() + puntoInteres.toLowerCase();
    let poiHash = 0;
    for (let c = 0; c < hashString.length; c++) {
        poiHash = ((poiHash << 5) - poiHash + hashString.charCodeAt(c)) | 0;
    }
    poiHash = Math.abs(poiHash) % 900000 + 100000;  // número de 6 dígitos siempre positivo

    // Ya no usamos URLs falsificadas, inyectamos placeholders que luego llenamos con DuckDuckGo Search 
    let imgHTML = '';
    for (let i = 1; i <= 10; i++) {
        const colSize  = i % 3 === 0 ? 'col-md-12 col-lg-8' : 'col-md-6 col-lg-4';

        imgHTML += `
            <div class="${colSize}">
                <div class="card h-100 border-dark border-3 rounded-0" style="box-shadow: 4px 4px 0 0 #000; overflow:hidden; background-color:#111;">
                    <img id="img_gal_${i}" src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22600%22%20viewBox%3D%220%200%20800%20600%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%22800%22%20height%3D%22600%22%20fill%3D%22%23222%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22monospace%22%20font-size%3D%2224%22%20fill%3D%22%23777%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3ECARGANDO%20FOTO...%3C%2Ftext%3E%3C%2Fsvg%3E"
                         class="img-fluid w-100 object-fit-cover" alt="Vista ${i} en ${ciudadContexto}"
                         loading="lazy" style="min-height: 220px; max-height: 280px; transition: transform 0.5s;" 
                         onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    <div class="card-footer bg-dark text-white border-top border-3 border-dark py-2 px-3 rounded-0 d-flex justify-content-between align-items-center">
                        <small class="fw-bold tracking-wider text-uppercase" style="font-size: 10px;"><i class="bi bi-camera me-1"></i>VISTA ${i}/10</small>
                        <span class="badge bg-white text-dark rounded-0 fw-black px-2 py-1"><i class="bi bi-check-circle-fill text-success me-1"></i>VERIFICADA</span>
                    </div>
                </div>
            </div>
        `;
    }

    grid.innerHTML = imgHTML;

    // Utilizamos nuestro proxy en Python para evadir bloqueos CORS y obtener mejores imágenes
    const qStr = `${puntoInteres} ${ciudadContexto} travel photography high quality`;
    const proxyUrl = `/api/get_image?query=${encodeURIComponent(qStr)}&limit=10`;
    
    fetch(proxyUrl)
        .then(r => r.json())
        .then(data => {
            let urls = data.urls || [];
            
            // Rellenar si hay menos de 10 fotos disponibles
            if (urls.length > 0) {
                while(urls.length < 10) urls.push(urls[Math.floor(Math.random() * urls.length)]); // Rellenar aleatoriamente
                
                urls.forEach((url, idx) => {
                    if (idx < 10) {
                        let imgEl = document.getElementById(`img_gal_${idx + 1}`);
                        if (imgEl) imgEl.src = url;
                    }
                });
            }
            spinner.classList.add('d-none');
            grid.classList.remove('d-none');
        })
        .catch(err => {
            console.error("Fallo obteniendo las imgs desde el proxy", err);
            spinner.classList.add('d-none');
            grid.classList.remove('d-none');
        });
};


/* =========================================================================
   MÓDULO: CONSTRUCTOR DE VIAJES (PREPARATIVOS E INTERESES)
========================================================================= */

/** @function calcularMochila itera a través de la lista de pendientes y calcula subtotales */
function calcularMochila() {
    let total = 0;
    const checkboxes = document.querySelectorAll('#mochilaForm .form-check-input');
    checkboxes.forEach(cb => {
        if (cb.checked) {
            total += parseInt(cb.value);
        }
    });

    const totalEl = document.getElementById('totalMochila');
    if (totalEl) {
        // Animacion directa de atencion
        totalEl.style.transform = "scale(1.2)";
        totalEl.style.display = "inline-block";
        totalEl.style.transition = "transform 0.15s ease-in-out";
        totalEl.innerText = `$${total.toLocaleString('en-US')}`;
        
        setTimeout(() => {
            totalEl.style.transform = "scale(1)";
        }, 150);
    }
}


const ALERTA_CONDUCTA_DB = {
    "Japón": [
        "Estrictamente prohibido hablar por teléfono en el transporte público.",
        "Masticar chicle en público es mal visto y escupirlo conlleva fuertes multas.",
        "No dejar propina en ningún establecimiento (es considerado un insulto).",
        "Siempre quitarse los zapatos antes de entrar a un hogar o templo tradicional.",
        "No clavar ni apuntar con los palillos al comer arroz.",
        "Mantener silencio en espacios públicos y formarse ordenadamente en cualquier fila.",
        "Está prohibido fumar en la calle fuera de las 'Smoking Areas' designadas.",
        "Los tatuajes deben ser cubiertos al usar baños públicos (Onsen) o gimnasios.",
        "No suenes tu nariz fuerte en público, usa el baño para ello.",
        "Reverencia leve al agradecer o saludar, sin forzar apretones de mano."
    ],
    "Polinesia": [
        "Aplica el sentido común: Bora Bora tiene riesgos estándar marítimos, atiende indicaciones de capitanía.",
        "Masticar y pegar chicle está gravemente penalizado por daño a los arrecifes.",
        "Prohibido llevarse coral, arena o fauna como 'souvenir' bajo riesgo cárcel.",
        "No dar la espalda ni sentarte encima de altares marae (templos sagrados).",
        "Saluda siempre con 'Ia orana', la cultura de cortesía oral es un mandato cívico.",
        "La ropa de baño es exclusiva de la playa, no andes descamisado por pueblos.",
        "Revisa el voltaje de carga (mayormente europeo estándar de 220V).",
        "Aplica filtro solar solo que indique 'Reef-friendly' biodegradable.",
        "Nunca toques ni persigas rayas o tiburones en excursiones marítimas.",
        "Protege tu cámara u aparatos, el índice de humedad arruina lentes no sellados."
    ],
    "Francia": [
        "Cuidado con los 'Pickpockets' (carteristas) alrededor del Louvre y Metro.",
        "No alzar la voz en restaurantes ni pedir hielo extra; el ambiente es reservado.",
        "Saluda siempre al entrar a una tienda con un 'Bonjour' cortés y directo.",
        "El agua del grifo es gratis y potable, pídela como 'Une carafe d'eau'.",
        "Evitar estafas de brazaletes de la amistad cerca a la basílica de Sacré-Cœur.",
        "La cuenta incluye propina (Service Compris), pero dejar un 5% es bien visto.",
        "Evita caminar comiendo por la calle rápidamente (la comida es de disfrute).",
        "En escaleras mecánicas, siempre párate a la derecha y camina a la izquierda.",
        "No pidas modificaciones excesivas a platos de la alta cocina (es desprecio al chef).",
        "Resguardar pertenencias cerradas en cafés al aire libre en montmartre."
    ],
    "EE.UU.": [
        "Es virtualmente OBLIGATORIO dejar propina (del 18% al 25% del total).",
        "No abrir consumo de alcohol en las vías públicas o playas.",
        "Masticar chicle y tronarlo de manera grosera en áreas silenciosas está mal visto.",
        "Mantén una distancia de 1 metro al interactuar físicamente (burbuja personal).",
        "No fumar ni vapear a menos de 5 metros de las entradas a recintos comerciales.",
        "Portar siempre Pasaporte Digital o Físico (Las licencias de otro país no siempre sirven en bares).",
        "Evitar usar lenguaje clasista u opinar sobre las agendas sociopolíticas externas.",
        "Los precios marcados NO incluyen el Tax (impuesto); calcula un 8-10% extra siempre.",
        "Pide el agua con bastante hielo si así lo deseas, esto allí es la norma vital.",
        "Prohibido saltarse vallas o cruzar carriles (Jaywalking), puede llevar multas automáticas."
    ],
    "México": [
        "Precaución de carteristas en el metro o zócalos concurridos.",
        "El chile (picante) puede no parecer fuerte para los locales, pero prueba con cuidado.",
        "No bebas bajo ninguna circunstancia agua directo del grifo.",
        "En mercados masivos negocia siempre los precios y cuida tus pertenencias de bolsillo.",
        "Existen multas de cultura cívica severas (e incluso detenciones) por insultar la bandera.",
        "La propina típica oscila amablemente entre el 10% y el 15%.",
        "Procura viajar por carreteras de peaje ('de cuota') durante el día por tu seguridad.",
        "Lleva siempre algo de efectivo, el pago con tarjeta en locales pequeños falla mucho.",
        "Regla de cortesía base: Siempre responde a un 'Gracias' con un 'De nada'.",
        "Revisa bien los convertidores eléctricos si viajas desde Europa hacia México (110V)."
    ],
    "Italia": [
        "Sentido común en Roma y Venecia: Ojo con carteristas en atracciones fuertes.",
        "Tirar basura o sentarse en fuentes históricas o escalinatas (Ej. Piazza di Spagna) genera fuertes multas.",
        "NO ordenar Capuccino después de las 11:00 am (es una falta cultural severa).",
        "No exigir modificaciones estrictas a las recetas tradicionales ni pedir Ketchup para la pasta.",
        "Los boletos de transporte público deben ser 'Validados' en la máquina amarilla antes de subir.",
        "Zonas estrictamente peatonales (ZTL) prohiben la entrada libre a carros rentados.",
        "Vestimenta modesta (tapando hombros y rodillas) requerida para entrar a capillas o al Vaticano.",
        "El servicio (coperto) viene incluído en el ticket de restaurante como cobro base.",
        "Ten cuidado con palomas, alimentarlas en las grandes plazas está prohibido.",
        "Para un italiano, alzar las manos es expresividad natural, no te asustes ante gestos bruscos."
    ],
    "España": [
        "Evitar distracciones de objetos de lujo en callejones cerrados, riesgo de carteristas alto.",
        "Los almuerzos y cenas son mucho más tarde; almorzar a las 14:00 o cenar a las 22:00.",
        "Jamás te vayas sin pedir una 'Tapa' al beber, y no esperes mesas solitarias inmensas.",
        "Masticar chicle es admitido legalmente pero en charlas es considerado una descortesía masiva.",
        "No esperes tiendas abiertas continuas (muchas guardan su horario de 'Siesta' por la tarde).",
        "El regateo es tomado como un insulto fuerte en comercios fijos y cerrados.",
        "En las playas, cerciorarse de las áreas textiles vs no-textiles para evitar sobresaltos.",
        "La propina es netamente un acto generoso sin porcentaje ni obligación estipulada.",
        "Siempre mantente en silencio dentro de templos o presenciando corridas/procesiones.",
        "Respeta el ciclo ciclista: los peatones NO deben invadir jamás las rojas sendas del 'Bicing'."
    ],
    "Brasil": [
        "Exposición a robo exprés elevado en capitales: Evitar teléfonos de gama alta en la acera.",
        "Se estila 'Dar beijinho' (beso sutil o roce de mejilla) para saludar amigablemente.",
        "Evitar transitar playas famosas al adentrarse el atarecer sin custodia colectiva.",
        "Obligatorio hacer la señal de '+' (pulgar arriba) para interactuar socialmente OK.",
        "El agua no potable de grifo en Brasil genera indigestiones fuertes; consume agua filtrada.",
        "El 'Jetinho brasileiro' implica gran impuntualidad tolerada (hasta 1 hora de retraso es normal).",
        "Al hablar de Fútbol, no insultes fuertemente equipos; el nivel pasional puede detonar peleas.",
        "Favelas turísticas son áreas con códigos invisibles de mando, no explores sin guia reconocido.",
        "La vestimenta micro en las playas cariocas es ley: la modestia excesiva llamará atención visual.",
        "Dejar sueltos tickets y envolturas al terminar agua de coco provoca altas multas de playa ecológica."
    ],
    "Generico": [
        "Aplica siempre el Sentido Común de Seguridad Internacional ante aglomeraciones.",
        "Revisa previamente el clima y el código de vestimenta civil estipulado localmente.",
        "Cuidado con tus posesiones, nunca coloques tu móvil en los bordes de la mesa exterior.",
        "Cerciórate de la compatibilidad de carga y el voltaje de clavija en este destino antes de conectar dispositivos.",
        "Evita realizar comportamientos escandalosos: las normas cívicas de silencio deben ser honradas en templos u espacios cerrados comunitarios.",
        "No subas ni accedas a tours de dudosa procedencia ofrecidos a pie en la calle.",
        "Nunca realices fotografías o tomas explícitas de autoridades o figuras de seguridad nacional en fronteras y aeropuertos.",
        "Regatear siempre de manera amable si estás en un mercado abierto, pero con absoluto respeto al trabajo manual y sin tocar descaradamente los productos ajenos.",
        "Si te emiten un sello de migración de estadía limitada, ten a la mano siempre pasaporte o visado escaneado de emergencia o la app habilitada del Travelwishly.",
        "La salud digital es esencial: utiliza una VPN sólida o prefiere no conectar la laptop en cafeterías y aeropuertos dudosos durante este viaje."
    ]
};

// ==========================================
// MÓDULOS DEL DASHBOARD AVANZADO (V2.0)
// ==========================================

const SURVIVAL_DB = {
    "Japón": { lang: "ja-JP", phrases: [
        {"es": "Hola", "local": "Konnichiwa (こんにちは)"},
        {"es": "Gracias", "local": "Arigatō (ありがとう)"},
        {"es": "Disculpe", "local": "Sumimasen (すみません)"},
        {"es": "¿Dónde está el baño?", "local": "Toire wa doko desu ka? (トイレはどこですか)"},
        {"es": "Ayuda", "local": "Tasukete (助けて)"},
        {"es": "¿Cuánto cuesta?", "local": "Ikura desu ka? (いくらですか)"}
    ]},
    "Francia": { lang: "fr-FR", phrases: [
        {"es": "Hola", "local": "Bonjour"},
        {"es": "Gracias", "local": "Merci"},
        {"es": "Disculpe", "local": "Excusez-moi / Pardon"},
        {"es": "¿Dónde está el baño?", "local": "Où sont les toilettes?"},
        {"es": "Ayuda", "local": "Au secours !"},
        {"es": "La cuenta, por favor", "local": "L'addition, s'il vous plaît"}
    ]},
    "Brasil": { lang: "pt-BR", phrases: [
        {"es": "Hola", "local": "Olá / Oi"},
        {"es": "Gracias", "local": "Obrigado/a"},
        {"es": "Disculpe", "local": "Desculpe / Com licença"},
        {"es": "¿Dónde está el baño?", "local": "Onde fica o banheiro?"},
        {"es": "Ayuda", "local": "Socorro!"},
        {"es": "La cuenta, por favor", "local": "A conta, por favor"}
    ]},
    "Italia": { lang: "it-IT", phrases: [
        {"es": "Hola / Adiós", "local": "Ciao"},
        {"es": "Gracias", "local": "Grazie"},
        {"es": "Disculpe", "local": "Mi scusi"},
        {"es": "¿Dónde está el baño?", "local": "Dov'è il bagno?"},
        {"es": "Ayuda", "local": "Aiuto!"},
        {"es": "La cuenta, por favor", "local": "Il conto, per favore"}
    ]},
    "Alemania": { lang: "de-DE", phrases: [
        {"es": "Hola", "local": "Hallo"},
        {"es": "Gracias", "local": "Danke"},
        {"es": "Disculpe", "local": "Entschuldigung"},
        {"es": "¿Dónde está el baño?", "local": "Wo ist die Toilette?"},
        {"es": "Ayuda", "local": "Hilfe!"},
        {"es": "La cuenta, por favor", "local": "Die Rechnung, bitte"}
    ]},
    "EE.UU.": { lang: "en-US", phrases: [
        {"es": "Hola", "local": "Hello"},
        {"es": "Gracias", "local": "Thank you"},
        {"es": "Disculpe", "local": "Excuse me"},
        {"es": "¿Dónde está el baño?", "local": "Where is the restroom?"},
        {"es": "Ayuda", "local": "Help!"},
        {"es": "La cuenta, por favor", "local": "Check, please"}
    ]}
};

window.hablarSintesis = function(texto, idioma) {
    if ('speechSynthesis' in window) {
        // Limpiamos pronunciaciones (solo pronunciamos fonetica local sin la traduccion al espanol)
        let textoAhablar = texto;
        if(texto.includes('(')) {
            // Extraer el kanji/kana si existe
            textoAhablar = texto.split('(')[1].replace(')', '');
        } else if (texto.includes(' / ')) {
            textoAhablar = texto.split(' / ')[0];
        }

        const msg = new SpeechSynthesisUtterance();
        msg.text = textoAhablar;
        msg.lang = idioma;
        msg.rate = 0.85; // Un poco más lento para entender la pronunciación
        window.speechSynthesis.speak(msg);
    } else {
        alert("Tu navegador no soporta Texto-a-Voz.");
    }
};

window.generarKitVocabulario = async function(destinoString) {
    const grid = document.getElementById('survivalKitGrid');
    if(!grid || !destinoString) return;

    grid.innerHTML = '<div class="col-12 text-center py-4"><span class="spinner-border text-dark"></span><p class="mt-2 fw-bold text-uppercase small">Traduciendo frases locales...</p></div>';

    try {
        const res = await fetch('/api/phrases', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ destino: destinoString })
        });
        const data = await res.json();
        
        if (data.success && data.data && data.data.length > 0) {
            let html = '';
            data.data.forEach((langData) => {
                html += `<div class="col-12 mt-2"><div class="fw-black bg-light border border-dark border-2 text-dark p-1 text-center text-uppercase mb-2" style="font-size:0.7rem;">IDIOMA: ${langData.idioma}</div></div>`;
                langData.phrases.forEach(phrase => {
                    const safeLocalStr = phrase.local.replace(/'/g, "\\'");
                    html += `
                    <div class="col-6 mb-2">
                        <button class="btn btn-outline-dark w-100 text-start d-flex justify-content-between align-items-center h-100 rounded-0 border-2 text-uppercase fw-bold p-2" 
                                onclick="window.hablarSintesis('${safeLocalStr}', '${langData.lang_code}')" style="font-size:0.75rem;">
                            <div class="text-truncate me-2">
                                <div class="text-muted" style="font-size:0.6rem;">${phrase.es}</div>
                                <div class="text-dark fs-6 text-wrap lh-1 mt-1">${phrase.local.split('(')[0].trim()}</div>
                            </div>
                            <i class="bi bi-volume-up-fill fs-5 text-primary"></i>
                        </button>
                    </div>
                    `;
                });
            });
            grid.innerHTML = html;
        } else {
            grid.innerHTML = '<div class="col-12 text-center text-danger fw-bold small mt-4">No se pudieron generar las frases.</div>';
        }
    } catch(e) {
        grid.innerHTML = '<div class="col-12 text-center text-danger fw-bold small mt-4">Error de conexión al cargar frases.</div>';
    }
};

// Variable Global para retener la instancia de Leaflet
let mapInstance = null;
let currentMarker = null;

window.pintarMapaLeaflet = async function(destinoString) {
    const mapContainer = document.getElementById('itineraryMap');
    const overlay = document.getElementById('mapOverlayText');
    if(!mapContainer) return;

    if (!destinoString) {
        if(overlay) overlay.style.display = 'block';
        return;
    }

    if(overlay) {
        overlay.style.display = 'block';
        overlay.querySelector('p').innerText = "CALCULANDO COORDENADAS GEOGRÁFICAS...";
    }

    try {
        // Consultar Nominatim para Latitud/Longitud real
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destinoString)}&format=json&limit=1`);
        const data = await res.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            if (!mapInstance) {
                // Instanciar por primera vez
                mapInstance = L.map('itineraryMap', { zoomControl: true }).setView([lat, lon], 12);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap &copy; CARTO'
                }).addTo(mapInstance);
            } else {
                // Mover mapa actual
                mapInstance.setView([lat, lon], 12);
            }

            // Mover/Crear marcador
            if (currentMarker) {
                currentMarker.setLatLng([lat, lon]);
            } else {
                currentMarker = L.marker([lat, lon]).addTo(mapInstance);
            }

            // Ocultar overlay
            if(overlay) overlay.style.display = 'none';

            // Forzar resize para evitar glitch gris de renderizado
            setTimeout(() => {
                mapInstance.invalidateSize();
            }, 300);
        } else {
            if(overlay) overlay.querySelector('p').innerText = "UBICACIÓN NO ENCONTRADA MUNDIALMENTE";
        }
    } catch(err) {
        console.error("Leaflet Map Error", err);
        if(overlay) overlay.querySelector('p').innerText = "ERROR AL CARGAR MAPA LOCAL";
    }
};

// ============================================================
//  BÚSQUEDA INTERNA DEL MAPA (Nominatim geocode con debounce)
// ============================================================
(function() {
    let _searchDebounceTimer = null;
    let _searchMarker = null;           // marcador extra para búsquedas manuales
    let _lastViewBbox = null;           // bbox del destino principal {minLat,maxLat,minLon,maxLon}

    // Guarda la bbox del mapa principal cada vez que se mueve
    function _updateBbox() {
        if (!mapInstance) return;
        const b = mapInstance.getBounds();
        _lastViewBbox = {
            minLat: b.getSouth(), maxLat: b.getNorth(),
            minLon: b.getWest(),  maxLon: b.getEast()
        };
    }

    // Llama a Nominatim con el texto escrito y la bbox del destino actual
    async function _fetchSuggestions(query) {
        if (!query || query.length < 3) return [];
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=0`;
        if (_lastViewBbox) {
            // viewbox restringe resultados al país/área visible
            url += `&viewbox=${_lastViewBbox.minLon},${_lastViewBbox.maxLat},${_lastViewBbox.maxLon},${_lastViewBbox.minLat}&bounded=1`;
        }
        try {
            const r = await fetch(url, { headers: { 'Accept-Language': 'es' } });
            const data = await r.json();
            return data;
        } catch(e) { return []; }
    }

    function _showSuggestions(items) {
        const box = document.getElementById('mapSearchSuggestions');
        if (!box) return;
        if (!items || items.length === 0) { box.style.display = 'none'; return; }
        box.innerHTML = items.map((item, i) =>
            `<div class="sugg-item" data-lat="${item.lat}" data-lon="${item.lon}" data-idx="${i}">
                ${item.display_name}
            </div>`
        ).join('');
        box.style.display = 'block';

        box.querySelectorAll('.sugg-item').forEach(el => {
            el.addEventListener('click', () => {
                const lat = parseFloat(el.dataset.lat);
                const lon = parseFloat(el.dataset.lon);
                const name = el.textContent.trim();
                _flyTo(lat, lon, name);
                document.getElementById('mapSearchInput').value = name;
                box.style.display = 'none';
            });
        });
    }

    function _flyTo(lat, lon, label) {
        if (!mapInstance) return;
        mapInstance.flyTo([lat, lon], 16, { animate: true, duration: 1.2 });

        // Quitar marcador anterior de búsqueda
        if (_searchMarker) { mapInstance.removeLayer(_searchMarker); _searchMarker = null; }

        // Pin rojo de búsqueda
        const redIcon = L.divIcon({
            className: '',
            html: '<div style="width:14px;height:14px;background:#ff3b3b;border:3px solid #000;border-radius:50%;box-shadow:2px 2px 0 #000;"></div>',
            iconSize: [14, 14], iconAnchor: [7, 7]
        });
        _searchMarker = L.marker([lat, lon], { icon: redIcon })
            .addTo(mapInstance)
            .bindPopup(`<b style="font-size:0.8rem;text-transform:uppercase;">${label}</b>`, { maxWidth: 260 })
            .openPopup();
    }

    // Input con debounce
    window.onMapSearchInput = function(val) {
        clearTimeout(_searchDebounceTimer);
        const box = document.getElementById('mapSearchSuggestions');
        if (!val || val.length < 3) { if (box) box.style.display = 'none'; return; }
        _searchDebounceTimer = setTimeout(async () => {
            const results = await _fetchSuggestions(val);
            _showSuggestions(results);
        }, 380);
    };

    // Búsqueda al presionar Enter o el botón
    window.ejecutarMapSearch = async function() {
        const input = document.getElementById('mapSearchInput');
        if (!input || !input.value.trim()) return;
        const results = await _fetchSuggestions(input.value.trim());
        if (results && results.length > 0) {
            _flyTo(parseFloat(results[0].lat), parseFloat(results[0].lon), results[0].display_name);
            const box = document.getElementById('mapSearchSuggestions');
            if (box) box.style.display = 'none';
        }
    };

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
        const box = document.getElementById('mapSearchSuggestions');
        const wrap = document.getElementById('mapSearchBox');
        if (box && wrap && !wrap.contains(e.target)) box.style.display = 'none';
    });

    // Actualizar bbox cada vez que se mueva el mapa (se inicializa tras pintarMapaLeaflet)
    const _origPintar = window.pintarMapaLeaflet;
    window.pintarMapaLeaflet = async function(destinoString) {
        await _origPintar(destinoString);
        // Limpiar input/marcador anterior al cambiar destino principal
        const inp = document.getElementById('mapSearchInput');
        if (inp) inp.value = '';
        if (_searchMarker && mapInstance) { mapInstance.removeLayer(_searchMarker); _searchMarker = null; }
        if (mapInstance) {
            _updateBbox();
            mapInstance.on('moveend', _updateBbox);
        }
    };
})();

window.convertCurrency = function() {
    const fromSelect = document.getElementById('fromCurrency');
    const toSelect = document.getElementById('toCurrency');
    const amtInput = document.getElementById('currencyAmount');
    const resultElement = document.getElementById('currencyResult');
    const updatedTag = document.getElementById('currencyUpdated');
    
    if (!fromSelect || !toSelect || !amtInput || !resultElement) return;
    
    const amount = parseFloat(amtInput.value) || 0;
    const from = fromSelect.value;
    const to = toSelect.value;

    function formatDiv(val, curr) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, minimumFractionDigits: 2 }).format(val);
    }

    // Si ya estamos usando la proxy interna de las tasas reales
    if (window.TASAS_CAMBIO && window.TASAS_CAMBIO[to] && typeof window.TASAS_CAMBIO[from] !== 'undefined') {
        const mxnFrom = from === 'MXN' ? 1 : (1 / window.TASAS_CAMBIO[from].tasa);
        const toValMxn = to === 'MXN' ? 1 : window.TASAS_CAMBIO[to].tasa;
        
        const finalRate = mxnFrom * toValMxn;
        const finalResult = amount * finalRate;
        
        resultElement.innerText = formatDiv(finalResult, to);
        if(updatedTag) updatedTag.innerText = "Calculado localmente";
        return;
    }

    // Fallback: usar API Externa en vivo si no tenemos los datos pre-cargados localmente
    fetch(`https://api.exchangerate-api.com/v4/latest/${from}`)
        .then(res => res.json())
        .then(data => {
            if(data && data.rates && data.rates[to]) {
                const rate = data.rates[to];
                const calcObj = amount * rate;
                resultElement.innerText = formatDiv(calcObj, to);
                if(updatedTag) {
                    const d = new Date(data.time_last_updated * 1000);
                    updatedTag.innerText = `Última act. API: ${d.toLocaleTimeString()}`;
                }
            } else {
                resultElement.innerText = "Error API";
            }
        })
        .catch(err => {
            console.error("Exchange API Falló", err);
            resultElement.innerText = "Modo Offline";
        });
};

const TODOS_DESTINOS_DB = [
    { 
      id: 1, ciudad: "Tokio", pais: "Japón", tags: ["cultura", "fiesta", "gastronomia", "compras", "arquitectura"], desc: "Tecnología, templos ancestrales y la mejor vida nocturna en Shinjuku y Shibuya.", timezone: "Asia/Tokyo", moneda: "JPY (Yen)", climaBase: 15,
      galeria: [{n:"Cruce Shibuya",q:"shibuya,crossing"},{n:"Akihabara",q:"akihabara,neon"},{n:"Templo Senso-ji",q:"sensoji,temple"},{n:"Shinjuku de Noche",q:"shinjuku,night"},{n:"Monte Fuji (Cercanías)",q:"fuji,mountain"},{n:"Torre de Tokio",q:"tokyotower"},{n:"Parque Ueno",q:"ueno,park"},{n:"Mercado Tsukiji",q:"tsukiji,market"},{n:"Santuario Meiji",q:"meijijingu,shrine"},{n:"Jardines Nacionales",q:"tokyo,garden"}]
    },
    { 
      id: 2, ciudad: "París", pais: "Francia", tags: ["cultura", "relax", "gastronomia", "compras", "arquitectura"], desc: "El romanticismo puro en cada esquina, museos increíbles y atardeceres frente a la torre Eiffel.", timezone: "Europe/Paris", moneda: "EUR (€)", climaBase: 12,
      galeria: [{n:"Torre Eiffel",q:"eiffel,tower"},{n:"Museo del Louvre",q:"louvre,museum"},{n:"Catedral de Notre Dame",q:"notredame,paris"},{n:"Arco de Triunfo",q:"arcdetriomphe"},{n:"Montmartre",q:"montmartre,street"},{n:"Río Sena",q:"seine,river"},{n:"Palacio de Versalles",q:"versailles,palace"},{n:"Panteón de París",q:"pantheon,paris"},{n:"Jardines de Luxemburgo",q:"luxembourg,gardens"},{n:"Barrio Latino",q:"latinquarter,paris"}]
    },
    { 
      id: 3, ciudad: "Cancún", pais: "México", tags: ["fiesta", "relax", "naturaleza", "gastronomia"], desc: "Playas azul turquesa, la adrenalina interminable de Xcaret y cenotes vírgenes.", timezone: "America/Cancun", moneda: "MXN ($)", climaBase: 28,
      galeria: [{n:"Zona Hotelera",q:"cancun,beach"},{n:"Playa del Carmen",q:"playadelcarmen,mexico"},{n:"Ruinas de Tulum",q:"tulum,ruins"},{n:"Isla Mujeres",q:"islamujeres,beach,mexico"},{n:"Cenote Sagrado",q:"cenote,mexico,water"},{n:"Parque Xcaret",q:"xcaret,mexico,nature"},{n:"Chichén Itzá",q:"chichenitza,mexico"},{n:"Isla Cozumel",q:"cozumel,ocean,reef"},{n:"Holbox",q:"holbox,island,mexico"},{n:"Vida Nocturna Coco Bongo",q:"cancun,nightclub"}]
    },
    { 
      id: 4, ciudad: "Bali", pais: "Indonesia", tags: ["relax", "naturaleza", "cultura", "espiritual", "mochilero"], desc: "Retiros Zen en la jungla profunda, santuarios de monos y meditación total.", timezone: "Asia/Makassar", moneda: "IDR (Rupia)", climaBase: 27,
      galeria: [{n:"Terrazas de Tegalalang",q:"bali,riceterrace"},{n:"Bosque de los Monos",q:"monkeyforest,bali"},{n:"Templo Uluwatu",q:"uluwatu,temple"},{n:"Nusa Penida",q:"nusapenida,cliff"},{n:"Playa Seminyak",q:"seminyak,beach"},{n:"Cascada Tegenungan",q:"waterfall,bali"},{n:"Templo Tanah Lot",q:"tanahlot,sunset"},{n:"Monte Batur",q:"batur,volcano"},{n:"Puertas del Cielo",q:"lempuyang,temple"},{n:"Ubud Centro",q:"ubud,bali,street"}]
    },
    { 
      id: 5, ciudad: "Nueva York", pais: "EE.UU.", tags: ["cultura", "fiesta", "compras", "arquitectura", "gastronomia"], desc: "La ciudad que no duerme. Rascacielos impresionantes, Broadway y eventos exclusivos.", timezone: "America/New_York", moneda: "USD ($)", climaBase: 8,
      galeria: [{n:"Times Square",q:"timessquare,newyork"},{n:"Central Park",q:"centralpark,newyork"},{n:"Estatua de la Libertad",q:"statueofliberty"},{n:"Puente de Brooklyn",q:"brooklynbridge"},{n:"Empire State",q:"empirestate,building"},{n:"El MET",q:"metropolitanmuseum"},{n:"Wall Street",q:"wallstreet"},{n:"Rockerfeller Center",q:"rockefeller,center"},{n:"Broadway",q:"broadway,theater"},{n:"Grand Central",q:"grandcentral,station"}]
    },
    { 
      id: 6, ciudad: "Patagonia", pais: "Argentina", tags: ["naturaleza", "relax", "nieve", "mochilero", "aventura"], desc: "Glaciares imponentes. La pureza espectacular del verdadero fin del mundo.", timezone: "America/Argentina/Rio_Gallegos", moneda: "ARS ($)", climaBase: 2,
      galeria: [{n:"Glaciar Perito Moreno",q:"peritomoreno,glacier"},{n:"Monte Fitz Roy",q:"fitzroy,mountain"},{n:"Ushuaia",q:"ushuaia,argentina"},{n:"Parque Tierra del Fuego",q:"tierradelfuego,park"},{n:"El Chaltén",q:"elchalten,nature"},{n:"Península Valdés",q:"valdes,peninsula"},{n:"Cueva de las Manos",q:"patagonia,cave"},{n:"Cerro Tronador",q:"cerrotronador"},{n:"Faro Les Eclaireurs",q:"ushuaia,lighthouse"},{n:"Ruta de los 7 Lagos",q:"patagonia,lakes"}]
    },
    { 
      id: 7, ciudad: "Roma", pais: "Italia", tags: ["cultura", "fiesta", "gastronomia", "arquitectura"], desc: "Calles cargadas de historia milenaria, pizzerías nocturnas y vida urbana animada.", timezone: "Europe/Rome", moneda: "EUR (€)", climaBase: 16,
      galeria: [{n:"El Coliseo",q:"colosseum,rome"},{n:"Fontana di Trevi",q:"trevi,fountain"},{n:"Panteón de Agripa",q:"pantheon,rome"},{n:"Foro Romano",q:"romanforum"},{n:"El Vaticano",q:"vatican,basilica"},{n:"Piazza Navona",q:"piazzanavona"},{n:"Villa Borghese",q:"villaborghese"},{n:"Trastevere",q:"trastevere,rome"},{n:"Castillo Sant'Angelo",q:"castelsantangelo"},{n:"Piazza di Spagna",q:"piazzadispagna"}]
    },
    { 
      id: 8, ciudad: "Ibiza", pais: "España", tags: ["fiesta", "relax", "compras", "gastronomia"], desc: "Discotecas monumentales por las madrugadas y playas escondidas perfectas por las mañanas.", timezone: "Europe/Madrid", moneda: "EUR (€)", climaBase: 22,
      galeria: [{n:"Dalt Vila",q:"daltvila,ibiza"},{n:"Cala Comte",q:"calacomte,beach"},{n:"Es Vedrà",q:"esvedra,ibiza"},{n:"Playa d'en Bossa",q:"playadenbossa"},{n:"Discotecas de Ibiza",q:"ibiza,nightclub"},{n:"Cala Bassa",q:"calabassa"},{n:"Mercado Las Dalias",q:"lasdalias,market"},{n:"Cala Salada",q:"calasalada"},{n:"Puerto de Sant Antoni",q:"ibiza,port"},{n:"Cueva de Can Marçà",q:"ibiza,cave"}]
    },
    { 
      id: 9, ciudad: "Cusco", pais: "Perú", tags: ["cultura", "naturaleza", "mochilero", "espiritual"], desc: "Exploración de la mística ciudadela de Machu Picchu rodeada de alturas imponentes.", timezone: "America/Lima", moneda: "PEN (Sol)", climaBase: 14,
      galeria: [{n:"Machu Picchu",q:"machupicchu"},{n:"Plaza de Armas Cusco",q:"cusco,plaza"},{n:"Valle Sagrado",q:"sacredvalley,peru"},{n:"Montaña 7 Colores",q:"rainbowmountain,peru"},{n:"Sacsayhuamán",q:"sacsayhuaman"},{n:"Ollantaytambo",q:"ollantaytambo"},{n:"Laguna Humantay",q:"humantay,lake"},{n:"Barrio San Blas",q:"sanblas,cusco"},{n:"Qorikancha",q:"qorikancha"},{n:"Mercado San Pedro",q:"cusco,market"}]
    },
    { 
      id: 10, ciudad: "Kioto", pais: "Japón", tags: ["cultura", "relax", "espiritual", "arquitectura"], desc: "Geishas misteriosas, jardines pulcros y santuarios apartados totalmente del ruido urbano.", timezone: "Asia/Tokyo", moneda: "JPY (Yen)", climaBase: 14,
      galeria: [{n:"Fushimi Inari-taisha",q:"fushimiinari"},{n:"Kinkaku-ji (Pabellón de Oro)",q:"kinkakuji"},{n:"Bosque de Bambú Arashiyama",q:"arashiyama,bamboo"},{n:"Barrio de Gion",q:"gion,kyoto"},{n:"Templo Kiyomizu-dera",q:"kiyomizudera"},{n:"Castillo Nijo",q:"nijocastle"},{n:"Camino del Filósofo",q:"kyoto,path"},{n:"Ginkaku-ji (Pabellón Plata)",q:"ginkakuji"},{n:"Palacio Imperial",q:"kyoto,palace"},{n:"Torre de Kioto",q:"kyototower"}]
    },
    { 
      id: 11, ciudad: "Las Vegas", pais: "EE.UU.", tags: ["fiesta", "compras", "gastronomia", "arquitectura"], desc: "El parque de diversiones adulto definitivo: vida de lujos repentinos, casinos y conciertos.", timezone: "America/Los_Angeles", moneda: "USD ($)", climaBase: 30,
      galeria: [{n:"Las Vegas Strip",q:"lasvegas,strip"},{n:"Fuentes del Bellagio",q:"bellagio,fountains"},{n:"Fremont Street",q:"fremont,lasvegas"},{n:"High Roller Ferris",q:"highroller,vegas"},{n:"Gran Cañón (viaje corto)",q:"grandcanyon"},{n:"Torre Stratosphere",q:"stratosphere,vegas"},{n:"El Volcán del Mirage",q:"mirage,volcano"},{n:"Signo Bienvenidos",q:"lasvegas,sign"},{n:"Presa Hoover",q:"hooverdam"},{n:"Resorts Venetian",q:"venetian,lasvegas"}]
    },
    { 
      id: 12, ciudad: "Banff", pais: "Canadá", tags: ["naturaleza", "relax", "nieve", "mochilero"], desc: "Fauna salvaje increíble conviviendo en un oasis de lagos azules montañosos perfectos.", timezone: "America/Edmonton", moneda: "CAD ($)", climaBase: -2,
      galeria: [{n:"Lake Louise",q:"lakelouise,banff"},{n:"Parque Nacional Banff",q:"banff,nationalpark"},{n:"Moraine Lake",q:"morainelake"},{n:"Icefields Parkway",q:"icefields,canada"},{n:"Johnston Canyon",q:"johnstoncanyon"},{n:"Montaña Sulphur",q:"sulphurmountain"},{n:"Peyto Lake",q:"peytolake"},{n:"Athabasca Glacier",q:"athabasca,glacier"},{n:"Bow Falls",q:"bowfalls"},{n:"Castillo Fairmont",q:"fairmont,banff"}]
    },
    { 
      id: 13, ciudad: "Oaxaca", pais: "México", tags: ["cultura", "fiesta", "gastronomia", "mochilero"], desc: "Aromas que enamoran, alebrijes coloridos y festivales locales con mucho mezcal espectacular.", timezone: "America/Mexico_City", moneda: "MXN ($)", climaBase: 22,
      galeria: [{n:"Templo Santo Domingo",q:"santodomingo,oaxaca"},{n:"Monte Albán",q:"montealban,oaxaca"},{n:"Hierve el Agua",q:"hierveelagua"},{n:"Árbol del Tule",q:"eltule,tree"},{n:"Mitla",q:"mitla,ruins"},{n:"Mercado 20 de Noviembre",q:"oaxaca,market"},{n:"Playas Puerto Escondido",q:"puertoescondido"},{n:"Bahías de Huatulco",q:"huatulco,mexico"},{n:"Centro Histórico",q:"oaxaca,street"},{n:"Ruta del Mezcal",q:"mezcal,agave"}]
    },
    { 
      id: 14, ciudad: "Bora Bora", pais: "Polinesia", tags: ["relax", "naturaleza"], desc: "Lujo flotante sobre mares cristalinos, donde solo importa la tranquilidad visual pura y sana.", timezone: "Pacific/Tahiti", moneda: "XPF (Franco)", climaBase: 28,
      galeria: [{n:"Bungalows sobre el agua",q:"borabora,bungalow"},{n:"Monte Otemanu",q:"otemanu,mountain"},{n:"Playa Matira",q:"matirabeach"},{n:"Laguna de Bora Bora",q:"borabora,lagoon"},{n:"Arrecifes de coral",q:"borabora,reef"},{n:"Motos de agua",q:"jetski,ocean"},{n:"Vuelos escénicos",q:"borabora,aerial"},{n:"Buceo con tiburones",q:"borabora,shark"},{n:"Pueblo Vaitape",q:"vaitape,tahiti"},{n:"Atardeceres del Pacífico",q:"borabora,sunset"}]
    },
    { 
      id: 15, ciudad: "Ámsterdam", pais: "Países Bajos", tags: ["cultura", "fiesta", "mochilero", "arquitectura"], desc: "Canales impresionantes por el día y clubes icónicos de electro-house por las noches.", timezone: "Europe/Amsterdam", moneda: "EUR (€)", climaBase: 10,
      galeria: [{n:"Canales de Ámsterdam",q:"amsterdam,canal"},{n:"Plaza Dam",q:"damsquare"},{n:"Museo Van Gogh",q:"vangoghmuseum"},{n:"Barrio Rojo",q:"redlightdistrict"},{n:"Vondelpark",q:"vondelpark"},{n:"Casa de Ana Frank",q:"annefrankhouse"},{n:"Rijksmuseum",q:"rijksmuseum"},{n:"Heineken Experience",q:"heinekenexperience"},{n:"Zaanse Schans",q:"zaanseschans"},{n:"Estación Central",q:"amsterdam,station"}]
    },
    { 
      id: 16, ciudad: "Sídney", pais: "Australia", tags: ["relax", "naturaleza", "fiesta", "arquitectura", "gastronomia"], desc: "Playas perfectas para surfear conviviendo con hitos urbanos modernísimos.", timezone: "Australia/Sydney", moneda: "AUD ($)", climaBase: 18,
      galeria: [{n:"Ópera de Sídney",q:"sydneyoperahouse"},{n:"Puente del Puerto",q:"sydneyharbourbridge"},{n:"Playa Bondi",q:"bondibeach"},{n:"Darling Harbour",q:"darlingharbour"},{n:"Royal Botanic Garden",q:"botanicgarden,sydney"},{n:"Torre de Sídney",q:"sydneytower"},{n:"Taronga Zoo",q:"tarongazoo"},{n:"Montañas Azules",q:"bluemountains,australia"},{n:"Barrio The Rocks",q:"therocks,sydney"},{n:"Playa Manly",q:"manlybeach"}]
    },
    { 
      id: 17, ciudad: "Dubai", pais: "E.A.U.", tags: ["compras", "relax", "arquitectura", "lujo", "fiesta"], desc: "Futurismo total en medio del desierto. Los centros comerciales más magnos del globo.", timezone: "Asia/Dubai", moneda: "AED (Dirham)", climaBase: 33,
      galeria: [{n:"Burj Khalifa",q:"burjkhalifa"},{n:"Palm Jumeirah",q:"palmjumeirah"},{n:"Dubai Mall",q:"dubaimall"},{n:"Burj Al Arab",q:"burjalarab"},{n:"Dubai Fuente",q:"dubaifountain"},{n:"Dubai Marina",q:"dubaimarina"},{n:"Zoco de Oro",q:"goldensouk,dubai"},{n:"Desierto de Safari",q:"desert,dubai"},{n:"Dubai Frame",q:"dubaiframe"},{n:"Global Village",q:"globalvillage,dubai"}]
    },
    { 
      id: 18, ciudad: "Reykjavik", pais: "Islandia", tags: ["naturaleza", "nieve", "mochilero", "aventura", "relax"], desc: "Auroras boreales místicas y baños termales naturales sacados de cuentos de hadas.", timezone: "Atlantic/Reykjavik", moneda: "ISK (Corona)", climaBase: -1,
      galeria: [{n:"Blue Lagoon",q:"bluelagoon,iceland"},{n:"Auroras Boreales",q:"northernlights,iceland"},{n:"Iglesia Hallgrímskirkja",q:"hallgrimskirkja"},{n:"Círculo Dorado",q:"goldencircle,iceland"},{n:"Cascada Gullfoss",q:"gullfoss"},{n:"Géisers",q:"geyser,iceland"},{n:"Parque Nacional Thingvellir",q:"thingvellir"},{n:"Cascada Skógafoss",q:"skogafoss"},{n:"Playa Diamante",q:"diamondbeach,iceland"},{n:"Harpa Concert Hall",q:"harpa,iceland"}]
    },
    { 
      id: 19, ciudad: "Bangkok", pais: "Tailandia", tags: ["cultura", "mochilero", "espiritual", "gastronomia", "fiesta"], desc: "Mercados flotantes llenos de sabor y vida, y la capital absoluta del sureste asiático.", timezone: "Asia/Bangkok", moneda: "THB (Baht)", climaBase: 29,
      galeria: [{n:"Gran Palacio Real",q:"grandpalace,bangkok"},{n:"Wat Arun",q:"watarun"},{n:"Wat Pho",q:"watpho"},{n:"Mercado Chatuchak",q:"chatuchak"},{n:"Khaosan Road",q:"khaosanroad"},{n:"Mercado Flotante",q:"floatingmarket,bangkok"},{n:"Parque Lumphini",q:"lumphinipark"},{n:"Río Chao Phraya",q:"chaophraya"},{n:"Santuario Erawan",q:"erawanshrine"},{n:"Barrio Chino (Yaowarat)",q:"chinatown,bangkok"}]
    },
    { 
      id: 20, ciudad: "Múnich", pais: "Alemania", tags: ["cultura", "fiesta", "gastronomia", "nieve"], desc: "Cunas de la cerveza mundial y tecnología alemana empapada de folklore y Alpes nevados.", timezone: "Europe/Berlin", moneda: "EUR (€)", climaBase: 8,
      galeria: [{n:"Marienplatz",q:"marienplatz"},{n:"Castillo Neuschwanstein",q:"neuschwanstein"},{n:"Oktoberfest (Theresienwiese)",q:"oktoberfest,munich"},{n:"Englischer Garten",q:"englishgarden,munich"},{n:"Olympiapark",q:"olympiapark,munich"},{n:"Catedral Frauenkirche",q:"frauenkirche,munich"},{n:"Palacio de Nymphenburg",q:"nymphenburg"},{n:"Viktualienmarkt",q:"viktualienmarkt"},{n:"BMW Welt",q:"bmwwelt"},{n:"Residencia de Múnich",q:"munich,residence"}]
    },
    { 
      id: 21, ciudad: "Río de Janeiro", pais: "Brasil", tags: ["fiesta", "relax", "naturaleza", "cultura"], desc: "La samba y el carnaval viviendo 365 días al año. Naturaleza y metrópolis juntas.", timezone: "America/Sao_Paulo", moneda: "BRL (Real)", climaBase: 26,
      galeria: [{n:"Cristo Redentor",q:"cristoredentor"},{n:"Playa Copacabana",q:"copacabana"},{n:"Pan de Azúcar",q:"sugarloaf,rio"},{n:"Ipanema",q:"ipanema"},{n:"Escaleras Selarón",q:"selaron,steps"},{n:"Estadio Maracaná",q:"maracana"},{n:"Jardín Botánico",q:"botanicgarden,rio"},{n:"Barrio Santa Teresa",q:"santateresa,rio"},{n:"Parque Nacional Tijuca",q:"tijuca,forest"},{n:"Museo del Mañana",q:"museumoftomorrow"}]
    },
    { 
      id: 22, ciudad: "Milán", pais: "Italia", tags: ["compras", "arquitectura", "cultura"], desc: "La meca innegable del estilo mundial y catedrales góticas imponentes.", timezone: "Europe/Rome", moneda: "EUR (€)", climaBase: 13,
      galeria: [{n:"El Duomo",q:"duomo,milan"},{n:"Galería Vittorio Emanuele II",q:"vittorioemanuele"},{n:"Castillo Sforzesco",q:"sforza,castle"},{n:"La Scala",q:"lascala,milan"},{n:"Pinacoteca di Brera",q:"brera,milan"},{n:"Navigli (Canales)",q:"navigli,milan"},{n:"La Última Cena (Da Vinci)",q:"lastsupper,milan"},{n:"Estadio San Siro",q:"sansiro"},{n:"Cuadrilátero de la Moda",q:"fashiondistrict,milan"},{n:"Parque Sempione",q:"sempione,park"}]
    },
    { 
      id: 23, ciudad: "Hawái (Oahu)", pais: "EE.UU.", tags: ["relax", "naturaleza", "aventura", "mochilero"], desc: "La cuna del surf pacífico, montañas volcánicas activas y luau nativos.", timezone: "Pacific/Honolulu", moneda: "USD ($)", climaBase: 27,
      galeria: [{n:"Playa Waikiki",q:"waikiki"},{n:"Diamond Head",q:"diamondhead"},{n:"Pearl Harbor",q:"pearlharbor"},{n:"Bahía Hanauma",q:"hanaumabay"},{n:"North Shore",q:"northshore,oahu"},{n:"Kualoa Ranch",q:"kualoaranch"},{n:"Cascadas de Manoa",q:"manoafalls"},{n:"Centro Polinesio",q:"polynesian,center"},{n:"Valle de Waimea",q:"waimeavalley"},{n:"Sunset Beach",q:"sunsetbeach,hawaii"}]
    },
    { 
      id: 24, ciudad: "Praga", pais: "Chequia", tags: ["cultura", "arquitectura", "fiesta", "mochilero"], desc: "Un museo mágico al aire libre con precios ajustados y castillos medievales altísimos.", timezone: "Europe/Prague", moneda: "CZK (Corona)", climaBase: 9,
      galeria: [{n:"Puente de Carlos",q:"charlesbridge"},{n:"Castillo de Praga",q:"praguecastle"},{n:"Plaza de la Ciudad Vieja",q:"oldtownsquare,prague"},{n:"Reloj Astronómico",q:"astronomicalclock,prague"},{n:"Catedral de San Vito",q:"stvitus,cathedral"},{n:"Muro de John Lennon",q:"lennonwall"},{n:"Casa Danzante",q:"dancinghouse"},{n:"Barrio Judío (Josefov)",q:"josefov,prague"},{n:"Monte Petřín",q:"petrin,hill"},{n:"Río Moldava",q:"vltava,river"}]
    }
];

let interesesGlobalesSeleccionados = [];

window.recomendarDestino = function(interesStr, btnElement) {
    // Alternancia lógica de selecciones múltiples (Toggle)
    const index = interesesGlobalesSeleccionados.indexOf(interesStr);
    if (index > -1) {
        interesesGlobalesSeleccionados.splice(index, 1);
        if (btnElement) {
            btnElement.classList.remove('btn-dark', 'text-white');
            btnElement.classList.add('btn-outline-dark');
        }
    } else {
        interesesGlobalesSeleccionados.push(interesStr);
        if (btnElement) {
            btnElement.classList.remove('btn-outline-dark');
            btnElement.classList.add('btn-dark', 'text-white');
        }
    }

    const panelObj = document.getElementById('panelDestinoRecomendado');
    const tituloObj = document.getElementById('recomendacionTitulo');
    const descObj = document.getElementById('recomendacionDesc');

    if (!panelObj || !tituloObj || !descObj) return;

    if (interesesGlobalesSeleccionados.length === 0) {
        panelObj.classList.add('d-none');
        return;
    }

    panelObj.classList.remove('d-none');

    // Mapeo Scoring de cada destino según coincidencias con los intereses seleccionados
    let matchesScored = TODOS_DESTINOS_DB.map(d => {
        let sc = 0;
        d.tags.forEach(t => { if (interesesGlobalesSeleccionados.includes(t)) sc++; });
        return { ...d, score: sc };
    });

    // Filtramos los que sí tuvieron coincidencias y ordenamos del que mejor cuadre hacia abajo
    matchesScored = matchesScored.filter(d => d.score > 0).sort((a, b) => b.score - a.score);

    // Mínimo 5 resultados sugeridos (si el filtro dejó muy pocos, rellenamos aleatoriamente la cuota con otros)
    let topResults = matchesScored.slice(0, Math.max(5, matchesScored.length));

    if (topResults.length === 0) topResults = TODOS_DESTINOS_DB.slice(0, 5); // Fallback invulnerable

    tituloObj.innerText = `¡${topResults.length} Destinos increíbles para tu selección de Vibe!`;

    let renderHtml = `<div class="mt-3">`;
    topResults.forEach(d => {
        let pTags = d.tags.map(t => `<span class="badge border border-dark border-1 text-dark me-1 text-uppercase bg-light p-1">${t}</span>`).join('');
        renderHtml += `
            <div class="mb-3 border-bottom border-dark position-relative" style="cursor: pointer;" onclick="window.mostrarDetallesDestino(${d.id})">
                <div class="p-2 transition-all hover-lift" style="background-color: #fcfcfc;" onmouseover="this.style.backgroundColor='#f0f0f0';" onmouseout="this.style.backgroundColor='#fcfcfc';">
                    <h6 class="fw-black mb-1 d-flex flex-wrap align-items-center"><i class="bi bi-geo-alt-fill text-danger me-2"></i> ${d.ciudad}, ${d.pais} <div class="ms-md-auto mt-2 mt-md-0 d-flex flex-wrap">${pTags}</div></h6>
                    <p class="small text-muted mb-1 fw-bold border-start border-4 border-primary ps-2">${d.desc}</p>
                    <div class="text-end"><span class="badge bg-dark rounded-0 px-2 py-1 text-uppercase" style="font-size: 10px;">Explorar Detalles <i class="bi bi-arrow-right fw-bold"></i></span></div>
                </div>
            </div>
        `;
    });
    renderHtml += `</div>`;
    descObj.innerHTML = renderHtml;
}

// ===== Selector de Intereses en Explorar Destinos (Guía) =====
let _guiaInteresesSeleccionados = [];
let _guiaDestinoSeleccionado = null;

window.recomendarDestinoGuia = function(interesStr, btnElement) {
    const idx = _guiaInteresesSeleccionados.indexOf(interesStr);
    if (idx > -1) {
        _guiaInteresesSeleccionados.splice(idx, 1);
        // Deseleccionado: volver al estilo base sin selección
        if (btnElement) {
            btnElement.classList.remove('btn-warning');
            btnElement.classList.add('btn-outline-dark');
        }
    } else {
        _guiaInteresesSeleccionados.push(interesStr);
        // SELECCIONADO: btn-warning = fondo amarillo, texto negro.
        // ¿Por qué btn-warning y no btn-dark?
        // Con btn-dark el fondo es negro y el texto es blanco. El problema es que en la
        // pantalla del celular, cuando el sistema tiene modo oscuro o la pantalla tiene poco
        // contraste, el texto blanco sobre fondo negro se vuelve invisible.
        // Con btn-warning (amarillo) el texto siempre queda negro (#000) sobre fondo brillante,
        // lo que garantiza máximo contraste legible en CUALQUIER dispositivo.
        if (btnElement) {
            btnElement.classList.remove('btn-outline-dark');
            btnElement.classList.add('btn-warning');
        }
    }

    const panel = document.getElementById('guiaPanelRecomendado');
    const grid = document.getElementById('guiaResultadosGrid');
    const countText = document.getElementById('guiaRecomendacionCounter');
    if (!panel || !grid) return;

    if (_guiaInteresesSeleccionados.length === 0) { panel.classList.add('d-none'); return; }

    let allScored = TODOS_DESTINOS_DB.map(d => {
        let sc = 0;
        let pMatch = [];
        d.tags.forEach(t => { 
            if (_guiaInteresesSeleccionados.includes(t)) { sc++; pMatch.push(t); } 
        });
        return { ...d, score: sc, pMatch: pMatch };
    }).sort((a, b) => b.score - a.score);

    // Mínimo de 7 resultados, max 15
    let matches = allScored.filter(d => d.score > 0);
    if (matches.length < 7) {
        matches = allScored.slice(0, 7);
    } else {
        if(matches.length > 15) matches = matches.slice(0, 15);
    }

    if (countText) countText.innerText = `(${matches.length} COINCIDENCIAS)`;

    let htmlInjection = '';
    matches.forEach((d) => {
        let percent = (d.score / _guiaInteresesSeleccionados.length) * 100;
        if(percent > 100) percent = 100;
        if(d.score === 0) percent = 10;
        let bgScore = percent >= 80 ? 'bg-success' : percent >= 45 ? 'bg-warning text-dark' : 'bg-dark text-white opacity-75';
        
        let matchTags = d.pMatch && d.pMatch.length > 0 ? 
            `<small class="text-danger fw-black text-uppercase d-block mb-2" style="font-size: 10px; letter-spacing:1px;"><i class="bi bi-crosshair me-1"></i> TAGS: ${d.pMatch.join(', ')}</small>` 
            : `<small class="text-secondary fw-bold text-uppercase d-block mb-2" style="font-size: 10px; letter-spacing:1px;">RECOMENDACIÓN ALTERNATIVA</small>`;

        htmlInjection += `
        <div class="col-10 col-md-5 col-lg-3 d-flex" style="min-width: 260px;">
            <div class="card border-dark border-3 rounded-0 shadow-none d-flex flex-column w-100 position-relative hover-lift overflow-hidden" 
                 style="box-shadow: 4px 4px 0 0 #000 !important; cursor:pointer;" 
                 onclick="window.enviarElegidoAlBuscador('${d.ciudad}, ${d.pais}')">
                
                <div class="position-absolute top-0 end-0 m-2 z-3 text-end" style="pointer-events: none;">
                    <span class="badge ${bgScore} border border-dark border-2 rounded-0 shadow-sm px-2 py-1">${percent.toFixed(0)}% <br>MATCH</span>
                </div>
                
                <div class="card-body bg-light p-3 pb-2 flex-grow-1">
                    <h5 class="fw-black text-dark text-uppercase tracking-wider mb-1"><i class="bi bi-geo-alt-fill text-danger me-1"></i> ${d.ciudad}</h5>
                    <p class="small fw-bold text-muted mb-2 text-uppercase">${d.pais}</p>
                    ${matchTags}
                    <p class="text-dark lh-sm border-start border-4 border-dark ps-2 mb-0 fw-semibold" style="font-size:12px; opacity: 0.85;">${d.desc}</p>
                </div>
                
                <div class="mt-auto border-top border-dark border-3 mt-1">
                    <button class="btn btn-dark w-100 rounded-0 border-0 fw-black text-uppercase text-white py-2 shadow-none hover-yellow transition-all" style="font-size: 11px; letter-spacing: 1px;">
                        Ver Guía Visual <i class="bi bi-arrow-right ms-1"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    });

    grid.innerHTML = htmlInjection;
    panel.classList.remove('d-none');
}

window.enviarElegidoAlBuscador = function(destinoStr) {
    const input = document.getElementById('destinosDropdown');
    if (input) {
        input.value = destinoStr;
        input.dispatchEvent(new Event('input'));
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

window.mostrarDetallesDestino = function(id) {
    const d = TODOS_DESTINOS_DB.find(x => x.id === id);
    if (!d) return;

    document.getElementById('modalDestinoTitle').innerHTML = `<i class="bi bi-geo-fill me-2 text-primary"></i>${d.ciudad}, ${d.pais}`;

    const galeriaEl = document.getElementById('modalDestinoGaleria');
    if (galeriaEl && d.galeria) {
        let galeriaHtml = '';
        const fotos5 = d.galeria.slice(0, 5);
        fotos5.forEach((foto, i) => {
            const active = i === 0 ? 'active' : '';
            galeriaHtml += `
                <div class="carousel-item ${active}">
                    <img id="img_dest_${d.id}_${i}"
                         src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'800'%20height%3D'400'%3E%3Crect%20width%3D'800'%20height%3D'400'%20fill%3D'%23222'%2F%3E%3Ctext%20x%3D'50%25'%20y%3D'50%25'%20font-family%3D'monospace'%20font-size%3D'22'%20fill%3D'%23666'%20dominant-baseline%3D'middle'%20text-anchor%3D'middle'%3ECARGANDO...%3C%2Ftext%3E%3C%2Fsvg%3E"
                         class="d-block w-100" style="height:350px;object-fit:cover;background:#111;" alt="${foto.n}">
                    <div class="carousel-caption d-none d-md-block" style="background:rgba(0,0,0,0.7);bottom:20px;border:2px solid #fff;pointer-events:none;padding:6px 12px;">
                        <h5 class="fw-black mb-0 text-uppercase fs-6">${foto.n}</h5>
                        <p class="small mb-0 fw-bold">${i+1} / ${fotos5.length}</p>
                    </div>
            `;
        });
        galeriaEl.innerHTML = galeriaHtml;

        // Tabla de títulos exactos de artículos Wikipedia por cada `q` de la galería.
        // Wikipedia REST /api/rest_v1/page/summary/{título} devuelve SIEMPRE la imagen
        // principal del artículo — la foto más icónica del lugar, sin búsqueda aleatoria.
        const WIKI_TITLES = {
            // Tokio
            "shibuya,crossing":"Shibuya_crossing","akihabara,neon":"Akihabara",
            "sensoji,temple":"Sensō-ji","shinjuku,night":"Shinjuku","fuji,mountain":"Mount_Fuji",
            // París
            "eiffel,tower":"Eiffel_Tower","louvre,museum":"Louvre","notredame,paris":"Notre-Dame_de_Paris",
            "arcdetriomphe":"Arc_de_Triomphe","montmartre,street":"Montmartre",
            // Cancún
            "cancun,beach":"Cancún","playadelcarmen,mexico":"Playa_del_Carmen",
            "tulum,ruins":"Tulum","islamujeres,beach,mexico":"Isla_Mujeres",
            "cenote,mexico,water":"Cenote","chichenitza,mexico":"Chichen_Itza",
            // Bali
            "bali,riceterrace":"Tegallalang_Rice_Terrace","monkeyforest,bali":"Sacred_Monkey_Forest_Sanctuary",
            "uluwatu,temple":"Pura_Luhur_Uluwatu","nusapenida,cliff":"Nusa_Penida",
            "seminyak,beach":"Seminyak",
            // Nueva York
            "timessquare,newyork":"Times_Square","centralpark,newyork":"Central_Park",
            "statueofliberty":"Statue_of_Liberty","brooklynbridge":"Brooklyn_Bridge",
            "empirestate,building":"Empire_State_Building",
            // Patagonia
            "peritomoreno,glacier":"Perito_Moreno_Glacier","fitzroy,mountain":"Mount_Fitz_Roy",
            "ushuaia,argentina":"Ushuaia","tierradelfuego,park":"Tierra_del_Fuego_National_Park",
            "elchalten,nature":"El_Chaltén",
            // Roma
            "colosseum,rome":"Colosseum","trevi,fountain":"Trevi_Fountain",
            "pantheon,rome":"Pantheon,_Rome","romanforum":"Roman_Forum",
            "vatican,basilica":"St._Peter's_Basilica",
            // Ibiza
            "daltvila,ibiza":"Dalt_Vila","calacomte,beach":"Cala_Comte",
            "esvedra,ibiza":"Es_Vedrà","playadenbossa":"Playa_d'en_Bossa",
            "ibiza,nightclub":"Ibiza",
            // Cusco
            "machupicchu":"Machu_Picchu","cusco,plaza":"Plaza_de_Armas,_Cusco",
            "sacredvalley,peru":"Sacred_Valley","rainbowmountain,peru":"Vinicunca",
            "sacsayhuaman":"Saksaywaman",
            // Kioto
            "fushimiinari":"Fushimi_Inari-taisha","kinkakuji":"Kinkaku-ji",
            "arashiyama,bamboo":"Arashiyama","gion,kyoto":"Gion,_Kyoto",
            "kiyomizudera":"Kiyomizu-dera",
            // Las Vegas
            "lasvegas,strip":"Las_Vegas_Strip","bellagio,fountains":"Bellagio_(resort_and_casino)",
            "fremont,lasvegas":"Fremont_Street_Experience","grandcanyon":"Grand_Canyon",
            "highroller,vegas":"High_Roller_(Ferris_wheel)",
            // Banff
            "lakelouise,banff":"Lake_Louise,_Alberta","banff,nationalpark":"Banff_National_Park",
            "morainelake":"Moraine_Lake","icefields,canada":"Icefields_Parkway",
            "peytolake":"Peyto_Lake",
            // Oaxaca
            "santodomingo,oaxaca":"Temple_of_Santo_Domingo,_Oaxaca",
            "montealban,oaxaca":"Monte_Albán","hierveelagua":"Hierve_el_Agua",
            "eltule,tree":"Árbol_del_Tule","mitla,ruins":"Mitla",
            // Bora Bora
            "borabora,bungalow":"Bora_Bora","otemanu,mountain":"Mount_Otemanu",
            "matirabeach":"Matira_Beach","borabora,lagoon":"Bora_Bora",
            "borabora,reef":"Bora_Bora",
            // Ámsterdam
            "amsterdam,canal":"Canals_of_Amsterdam","damsquare":"Dam_Square",
            "vangoghmuseum":"Van_Gogh_Museum","annefrankhouse":"Anne_Frank_House",
            "rijksmuseum":"Rijksmuseum",
            // Sídney
            "sydneyoperahouse":"Sydney_Opera_House","sydneyharbourbridge":"Sydney_Harbour_Bridge",
            "bondibeach":"Bondi_Beach","darlingharbour":"Darling_Harbour",
            "bluemountains,australia":"Blue_Mountains_(New_South_Wales)",
            // Dubai
            "burjkhalifa":"Burj_Khalifa","palmjumeirah":"Palm_Jumeirah",
            "dubaimall":"The_Dubai_Mall","burjalarab":"Burj_Al_Arab",
            "dubaimarina":"Dubai_Marina",
            // Reykjavik
            "bluelagoon,iceland":"Blue_Lagoon_(geothermal_spa)","northernlights,iceland":"Aurora",
            "hallgrimskirkja":"Hallgrímskirkja","gullfoss":"Gullfoss",
            "goldencircle,iceland":"Golden_Circle_(Iceland)",
            // Bangkok
            "grandpalace,bangkok":"Grand_Palace","watarun":"Wat_Arun",
            "watpho":"Wat_Pho","floatingmarket,bangkok":"Damnoen_Saduak_floating_market",
            "chaophraya":"Chao_Phraya_River",
            // Múnich
            "marienplatz":"Marienplatz","neuschwanstein":"Neuschwanstein_Castle",
            "oktoberfest,munich":"Oktoberfest","englishgarden,munich":"English_Garden,_Munich",
            "frauenkirche,munich":"Frauenkirche,_Munich",
            // Río de Janeiro
            "cristoredentor":"Cristo_Redentor","copacabana":"Copacabana,_Rio_de_Janeiro",
            "sugarloaf,rio":"Sugarloaf_Mountain","ipanema":"Ipanema",
            "selaron,steps":"Escadaria_Selarón",
            // Milán
            "duomo,milan":"Milan_Cathedral","vittorioemanuele":"Galleria_Vittorio_Emanuele_II",
            "sforza,castle":"Sforza_Castle","lascala,milan":"La_Scala",
            "navigli,milan":"Navigli",
            // Hawái
            "waikiki":"Waikiki","diamondhead":"Diamond_Head_(Hawaii)",
            "pearlharbor":"Pearl_Harbor","hanaumabay":"Hanauma_Bay",
            "northshore,oahu":"North_Shore,_Oahu",
            // Praga
            "charlesbridge":"Charles_Bridge","praguecastle":"Prague_Castle",
            "oldtownsquare,prague":"Old_Town_Square,_Prague",
            "astronomicalclock,prague":"Prague_astronomical_clock",
            "stvitus,cathedral":"St._Vitus_Cathedral"
        };

        // Cargar imágenes usando el REST summary de Wikipedia con título exacto
        fotos5.forEach((foto, i) => {
            const imgEl = document.getElementById(`img_dest_${d.id}_${i}`);
            if (!imgEl) return;
            const wikiTitle = WIKI_TITLES[foto.q];
            if (!wikiTitle) return;

            setTimeout(async () => {
                try {
                    const res = await fetch(
                        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`
                    );
                    if (!res.ok) return;
                    const data = await res.json();
                    if (data.thumbnail && data.thumbnail.source) {
                        imgEl.src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
                    }
                } catch (e) {
                    console.warn(`[Galería] "${foto.n}":`, e);
                }
            }, i * 400);
        });
    }



    document.getElementById('modalDestinoDesc').innerText = d.desc;
    document.getElementById('modalDestinoMoneda').innerText = d.moneda || "No disp.";
    
    // Convertir el Date actual a la zona horaria del destino
    try {
        const options = { timeZone: d.timezone, hour: '2-digit', minute: '2-digit', hour12: true };
        const localTime = new Intl.DateTimeFormat('es-MX', options).format(new Date());
        document.getElementById('modalDestinoHora').innerText = localTime;
    } catch(e) {
        document.getElementById('modalDestinoHora').innerText = "Horario Local";
    }

    // Calcular el clima de forma inteligente basado en la media base del país
    const icon = d.climaBase >= 20 ? 'brightness-high-fill text-warning' : (d.climaBase > 5 ? 'cloud-sun-fill text-info' : 'snow text-primary');
    const variedTemp = d.climaBase + Math.floor(Math.random() * 5) - 2;
    document.getElementById('modalDestinoClima').innerHTML = `${variedTemp}°C <i class="bi bi-${icon} ms-1" style="font-size: 1.1rem;"></i>`;

    window._destinoModalActual = d.ciudad;

    if (window.bootstrap) {
        let myModal = new bootstrap.Modal(document.getElementById('destinoModal'));
        myModal.show();
    }
};

window.seleccionarParaPresupuesto = function() {
    const dest = window._destinoModalActual;
    if (dest) {
        // Enlazar Destino al nuevo generador de ruta Inteligente si está activo en DOM de Constructor
        const destInput = document.getElementById('rutaDestino');
        if (destInput) {
            destInput.value = dest;
            destInput.style.transition = '0.3s';
            destInput.style.backgroundColor = '#0dcaf0';
            setTimeout(() => { destInput.style.backgroundColor = ''; }, 600);
            destInput.scrollIntoView({behavior: 'smooth', block: 'center'});
        } else if (window.agregarEventoTimeline) {
            window.agregarEventoTimeline(`Vuelo a ${dest}`);
        }
        
        let modalEl = document.getElementById('destinoModal');
        if (window.bootstrap) {
            let modalInst = bootstrap.Modal.getInstance(modalEl);
            if (modalInst) modalInst.hide();
        }
    }
};

const PRESUPUESTOS_DESTINOS_GLOBALES = [
    { nombre: "Alemania (Berlín, Múnich)", budget: 45000 },
    { nombre: "Argentina (Buenos Aires, Patagonia)", budget: 18000 },
    { nombre: "Australia (Sídney, Melbourne)", budget: 70000 },
    { nombre: "Brasil (Río de Janeiro, São Paulo)", budget: 20000 },
    { nombre: "Canadá (Toronto, Vancouver)", budget: 35000 },
    { nombre: "Colombia (Bogotá, Medellín)", budget: 12000 },
    { nombre: "Corea del Sur (Seúl)", budget: 55000 },
    { nombre: "Costa Rica (San José)", budget: 18000 },
    { nombre: "Cuba (La Habana)", budget: 15000 },
    { nombre: "Chile (Santiago, Atacama)", budget: 20000 },
    { nombre: "China (Pekín, Shanghái)", budget: 60000 },
    { nombre: "Egipto (El Cairo)", budget: 40000 },
    { nombre: "Emiratos Árabes (Dubái)", budget: 80000 },
    { nombre: "España (Madrid, Barcelona)", budget: 40000 },
    { nombre: "Estados Unidos (Nueva York, LA)", budget: 35000 },
    { nombre: "Francia (París)", budget: 48000 },
    { nombre: "Grecia (Atenas, Santorini)", budget: 50000 },
    { nombre: "India (Nueva Delhi)", budget: 45000 },
    { nombre: "Indonesia (Bali)", budget: 35000 },
    { nombre: "Italia (Roma, Venecia)", budget: 46000 },
    { nombre: "Japón (Tokio, Kioto)", budget: 65000 },
    { nombre: "Jordania (Petra)", budget: 55000 },
    { nombre: "Marruecos (Marrakech)", budget: 35000 },
    { nombre: "México Nacional (Pueblos Mágicos)", budget: 6000 },
    { nombre: "México Playa (Cancún, Tulum)", budget: 15000 },
    { nombre: "Nueva Zelanda (Auckland)", budget: 75000 },
    { nombre: "Países Bajos (Ámsterdam)", budget: 45000 },
    { nombre: "Perú (Cusco, Machu Picchu)", budget: 14000 },
    { nombre: "Polinesia Francesa (Bora Bora)", budget: 120000 },
    { nombre: "Reino Unido (Londres)", budget: 55000 },
    { nombre: "República Dominicana (Punta Cana)", budget: 18000 },
    { nombre: "Suiza (Zúrich, Alpes)", budget: 65000 },
    { nombre: "Tailandia (Bangkok, Phuket)", budget: 38000 },
    { nombre: "Turquía (Estambul, Capadocia)", budget: 40000 }
];

document.addEventListener("DOMContentLoaded", () => {
    const listEl = document.getElementById('destinosDataList');
    if (listEl) {
        PRESUPUESTOS_DESTINOS_GLOBALES.forEach(dest => {
            const opt = document.createElement('option');
            opt.value = dest.nombre;
            listEl.appendChild(opt);
        });
    }
});

window.sugerirPresupuestoBuscador = function(valTyped) {
    const inputViaje = document.getElementById('viajeObjetivo');
    if (!inputViaje || !valTyped) return;
    
    // Buscar si coinciden exactamente de la lista
    let match = PRESUPUESTOS_DESTINOS_GLOBALES.find(d => d.nombre.toLowerCase() === valTyped.toLowerCase());
    
    // Fallback si vino desde OSM Nominatim (ej: "Monterrey, México")
    if (!match && valTyped.includes(',')) {
        // Asignamos un presupuesto dinámico estándar basado en lógica de hashes pseudo-random estática
        let charSum = 0;
        for (let i = 0; i < valTyped.length; i++) charSum += valTyped.charCodeAt(i);
        let budgetBase = 10000 + (charSum * 50) + (valTyped.length * 300);
        // Redondear a centenas (ej 15300)
        budgetBase = Math.ceil(budgetBase / 100) * 100;
        match = { budget: budgetBase };
    }

    if (match) {
        inputViaje.value = match.budget;
        // Flash visual para atención inmediata
        inputViaje.style.transition = "transform 0.1s linear";
        inputViaje.style.transform = "scale(1.05)";
        inputViaje.style.backgroundColor = "#ffc107"; // highlight de bootstrap
        setTimeout(() => {
            inputViaje.style.transform = "scale(1)";
            inputViaje.style.backgroundColor = ""; 
        }, 300);
        
        // Disparar cálculos visualmente si procede
        if (document.getElementById('ingresosMensuales').value && window.calcularDistribucion) {
            window.calcularDistribucion();
        }
    }
};

/* =========================================================================
   MÓDULO UNIFICADO: BUSCADOR MUNDIAL (INTEGRACIÓN OPENSTREETMAP - NOMINATIM)
   Aplica a inputs .global-search-input (Dash, Guía, Constructor)
};

/* =========================================================================
   MÓDULO UNIFICADO: BUSCADOR MUNDIAL (INTEGRACIÓN OPENSTREETMAP - NOMINATIM)
   Aplica a inputs .global-search-input (Dash, Guía, Constructor)
========================================================================= */
let globalSearchTimeout = null;
function setupGlobalAutocomplete() {
    const inputs = document.querySelectorAll('.global-search-input');
    inputs.forEach(input => {
        let datalistId = input.getAttribute('list');
        if (!datalistId) {
            datalistId = input.id + '_datalist';
            input.setAttribute('list', datalistId);
            const dl = document.createElement('datalist');
            dl.id = datalistId;
            input.parentNode.appendChild(dl);
        }

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length < 3) return;
            
            // Revisa si es una selección final del autocompletador (está limpia y mapeada)
            if (query.includes(',')) return;

            clearTimeout(globalSearchTimeout);
            globalSearchTimeout = setTimeout(async () => {
                try {
                    // Carga visual temporal al DOM input derecho opcionalmente si hiciera falta
                    const call = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&accept-language=es,en&limit=8`);
                    const data = await call.json();
                    
                    const dl = document.getElementById(datalistId);
                    dl.innerHTML = '';
                    
                    let arrMap = new Set();
                    data.forEach(item => {
                        let parts = item.display_name.split(', ');
                        let name = parts[0];
                        let country = parts[parts.length - 1];
                        let formatted = `${name}, ${country}`;
                        
                        if(!arrMap.has(formatted)) {
                            const opt = document.createElement('option');
                            opt.value = formatted;
                            dl.appendChild(opt);
                            arrMap.add(formatted);
                        }
                    });
                } catch(err) {
                    console.warn("Límite APi o desconexión Global de Mapa:", err);
                }
            }, 600); // Demora 600ms para cuidar bloqueos de Rate Limit OSM
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Al arrancar, anexar el motor universal de listado
    setupGlobalAutocomplete();
});

window.exportarDashboardPDF = function() {
    const btnPDF = document.getElementById('btnExportarDashboardPDF');
    if (btnPDF) {
        btnPDF.disabled = true;
        btnPDF.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Generando...';
    }

    const captureEl = document.getElementById('constructorCaptureZone');
    if (!captureEl) { console.error('No se encontró #constructorCaptureZone'); return; }

    const cards = captureEl.querySelectorAll('.card-body');
    const originalBg = [];
    cards.forEach((c, i) => {
        originalBg[i] = c.style.backgroundImage;
        c.style.backgroundImage = 'none';
    });

    const allNodes = captureEl.querySelectorAll('*');
    const originalShadows = [];
    allNodes.forEach((node, i) => {
        originalShadows[i] = node.style.boxShadow;
        if(node.style.boxShadow) node.style.boxShadow = 'none'; 
    });

    const opciones = {
        margin:       [10, 10, 10, 10],
        filename:     `TravelWishly_Constructor_Visual_${new Date().getFullYear()}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 1200 },
        jsPDF:        { unit: 'mm', format: 'a3', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['.card', '.packing-item', '.d-flex', '.col-md-6', 'h5', 'h6'] }
    };

    html2pdf().set(opciones).from(captureEl).save().then(() => {
        cards.forEach((c, i) => { c.style.backgroundImage = originalBg[i]; });
        allNodes.forEach((node, i) => { if (originalShadows[i]) node.style.boxShadow = originalShadows[i]; });
        if (btnPDF) {
            btnPDF.disabled = false;
            btnPDF.innerHTML = '<i class="bi bi-file-earmark-pdf-fill me-2"></i>Exportar PDF';
        }
    }).catch(err => {
        cards.forEach((c, i) => { c.style.backgroundImage = originalBg[i]; });
        allNodes.forEach((node, i) => { if (originalShadows[i]) node.style.boxShadow = originalShadows[i]; });
        console.error('Error al generar PDF:', err);
        if (btnPDF) {
            btnPDF.disabled = false;
            btnPDF.innerHTML = '<i class="bi bi-file-earmark-pdf-fill me-2"></i>Exportar PDF';
        }
    });
}

/* =========================================================================
   MÓDULO: EXTRAS (DIVISAS Y CLIMA)
========================================================================= */

// === CONVERSOR DE DIVISAS CON API EN TIEMPO REAL ===

let _exchangeAllCurrencies = [];  // lista de códigos
let _exchangeRatesCache = {};     // { base: { rates, updated } }

// Instancias globales de Choices.js para los selects de moneda
let _choicesFrom = null;
let _choicesTo = null;

async function cargarListaMonedas() {
    const fromSel = document.getElementById('fromCurrency');
    const toSel = document.getElementById('toCurrency');
    if (!fromSel || !toSel) return;

    try {
        const resp = await fetch('/api/exchange?base=USD');
        const data = await resp.json();
        if (!data.currencies || data.currencies.length === 0) return;

        _exchangeAllCurrencies = data.currencies;
        _exchangeRatesCache['USD'] = { rates: data.rates, updated: data.updated };

        // Nombres de monedas comunes para mostrar en el option
        const nombres = {
            USD:'USD — Dólar Estadounidense', EUR:'EUR — Euro', MXN:'MXN — Peso Mexicano',
            GBP:'GBP — Libra Esterlina', JPY:'JPY — Yen Japonés', CAD:'CAD — Dólar Canadiense',
            AUD:'AUD — Dólar Australiano', CHF:'CHF — Franco Suizo', CNY:'CNY — Yuan Chino',
            BRL:'BRL — Real Brasileño', ARS:'ARS — Peso Argentino', COP:'COP — Peso Colombiano',
            CLP:'CLP — Peso Chileno', PEN:'PEN — Sol Peruano', INR:'INR — Rupia India',
            KRW:'KRW — Won Coreano', SGD:'SGD — Dólar Singapurés', HKD:'HKD — Dólar de Hong Kong',
            NZD:'NZD — Dólar Neozelandés', SEK:'SEK — Corona Sueca', NOK:'NOK — Corona Noruega',
            DKK:'DKK — Corona Danesa', TRY:'TRY — Lira Turca', RUB:'RUB — Rublo Ruso',
            ZAR:'ZAR — Rand Sudafricano', AED:'AED — Dírham Emirati', SAR:'SAR — Riyal Saudí',
            THB:'THB — Baht Tailandés', IDR:'IDR — Rupia Indonesia', MYR:'MYR — Ringgit Malayo',
            PHP:'PHP — Peso Filipino', VND:'VND — Dong Vietnamita', EGP:'EGP — Libra Egipcia',
            NGN:'NGN — Naira Nigeriana', KES:'KES — Chelín Keniano', ILS:'ILS — Nuevo Séquel Israelí',
            PLN:'PLN — Zloty Polaco', CZK:'CZK — Corona Checa', HUF:'HUF — Forinto Húngaro',
            RON:'RON — Leu Rumano', BGN:'BGN — Lev Búlgaro', HRK:'HRK — Kuna Croata',
            ISK:'ISK — Corona Islandesa', UAH:'UAH — Grivna Ucraniana', QAR:'QAR — Riyal Catarí',
            KWD:'KWD — Dinar Kuwaiti', BHD:'BHD — Dinar Bareiní', OMR:'OMR — Rial Omaní',
            JOD:'JOD — Dinar Jordano', MAD:'MAD — Dírham Marroquí', PKR:'PKR — Rupia Pakistaní',
            BDT:'BDT — Taka Bangladesí', LKR:'LKR — Rupia Ceilanesa', NPR:'NPR — Rupia Nepalesa',
            CRC:'CRC — Colón Costarricense', GTQ:'GTQ — Quetzal Guatemalteco', HNL:'HNL — Lempira Hondureño',
            NIO:'NIO — Córdoba Nicaragüense', DOP:'DOP — Peso Dominicano', CUP:'CUP — Peso Cubano',
            JMD:'JMD — Dólar Jamaicano', TTD:'TTD — Dólar de Trinidad', UYU:'UYU — Peso Uruguayo',
            BOB:'BOB — Boliviano', PYG:'PYG — Guaraní Paraguayo', VES:'VES — Bolívar Venezolano'
        };

        [fromSel, toSel].forEach(sel => {
            const current = sel.value;
            sel.innerHTML = '';
            _exchangeAllCurrencies.forEach(code => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = nombres[code] || code;
                sel.appendChild(opt);
            });
        });
        fromSel.value = 'MXN';
        toSel.value = 'USD';

        // Destruir instancias previas si existen
        if (_choicesFrom) { try { _choicesFrom.destroy(); } catch(e){} _choicesFrom = null; }
        if (_choicesTo)   { try { _choicesTo.destroy();   } catch(e){} _choicesTo   = null; }

        // Inicializar Choices.js con búsqueda en ambos selects
        if (typeof Choices !== 'undefined') {
            const cfg = {
                searchEnabled: true,
                searchPlaceholderValue: 'Buscar moneda...',
                itemSelectText: '',
                shouldSort: false,
                searchResultLimit: 25,
                noResultsText: 'Moneda no encontrada',
            };
            _choicesFrom = new Choices(fromSel, cfg);
            _choicesTo   = new Choices(toSel,   cfg);
            fromSel.addEventListener('change', () => { if(window.convertCurrency) window.convertCurrency(); });
            toSel.addEventListener('change',   () => { if(window.convertCurrency) window.convertCurrency(); });
        }

        // Primera conversión automática
        window.convertCurrency();
    } catch(e) {
        console.warn('No se pudo cargar la lista de monedas:', e);
    }
}

/** @function convertCurrency Convierte con tipo de cambio real en tiempo real */
window.convertCurrency = async function() {
    const amount = parseFloat(document.getElementById('currencyAmount').value);
    const from = document.getElementById('fromCurrency')?.value;
    const to = document.getElementById('toCurrency')?.value;
    const resultEl = document.getElementById('currencyResult');
    const rateEl = document.getElementById('currencyRate');
    const updEl = document.getElementById('currencyUpdated');
    if (!resultEl || !from || !to) return;

    if (isNaN(amount) || amount <= 0) { resultEl.innerText = '--'; return; }
    resultEl.innerText = '⏳...';

    try {
        // Usar cache si existe para la base
        if (!_exchangeRatesCache[from]) {
            const resp = await fetch('/api/exchange?base=' + from);
            const data = await resp.json();
            if (!data.rates) throw new Error('Sin datos');
            _exchangeRatesCache[from] = { rates: data.rates, updated: data.updated };
        }
        const cache = _exchangeRatesCache[from];
        const rate = cache.rates[to];
        if (!rate) { resultEl.innerText = 'N/A'; return; }

        const converted = amount * rate;
        resultEl.innerText = converted.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 4}) + ' ' + to;
        if (rateEl) rateEl.innerText = `1 ${from} = ${rate.toLocaleString('es-MX', {minimumFractionDigits: 4, maximumFractionDigits: 6})} ${to}`;
        if (updEl && cache.updated) {
            const d = new Date(cache.updated);
            updEl.innerHTML = `<i class="bi bi-clock me-1"></i>Última actualización: ${cache.updated.replace(' +0000 UTC','').replace(' UTC','')}`;
        }
    } catch (error) {
        console.error('Error en conversión:', error);
        resultEl.innerText = 'Offline';
    }
};


// === CLIMA CON OPENWEATHER API ===

const CLIMA_POOL = [
    'Tokyo,JP', 'New York,US', 'Paris,FR', 'Cancun,MX', 'London,GB',
    'Sydney,AU', 'Dubai,AE', 'Barcelona,ES', 'Rome,IT', 'Bangkok,TH',
    'Mexico City,MX', 'Amsterdam,NL', 'Istanbul,TR', 'Cairo,EG', 'Seoul,KR'
];

let climaCiudadesActivas = [];

function owmIconClass(iconCode) {
    if (!iconCode) return 'bi-cloud';
    const code = iconCode.replace('d','').replace('n','');
    const map = {
        '01': 'bi-brightness-high', '02': 'bi-cloud-sun', '03': 'bi-cloud',
        '04': 'bi-clouds', '09': 'bi-cloud-drizzle', '10': 'bi-cloud-rain',
        '11': 'bi-cloud-lightning-rain', '13': 'bi-snow', '50': 'bi-wind'
    };
    return map[code] || 'bi-cloud';
}

async function fetchCiudadClima(cityQ) {
    try {
        const resp = await fetch('/api/weather?city=' + encodeURIComponent(cityQ));
        if (!resp.ok) return null;
        return await resp.json();
    } catch { return null; }
}

async function actualizarClimaGlobal() {
    const lista = document.getElementById('climaCiudadesLista');
    const msg = document.getElementById('climaActualizadoMsg');
    if (!lista) return;

    // Elegir 5 ciudades aleatorias del pool
    const shuffled = [...CLIMA_POOL].sort(() => Math.random() - 0.5);
    climaCiudadesActivas = shuffled.slice(0, 5);

    lista.innerHTML = '<div class="list-group-item text-center py-2 text-muted small">Obteniendo datos reales...</div>';

    const resultados = await Promise.all(climaCiudadesActivas.map(c => fetchCiudadClima(c)));

    lista.innerHTML = '';
    resultados.forEach((data, i) => {
        const item = document.createElement('div');
        const isLast = i === resultados.length - 1;
        item.className = 'list-group-item d-flex justify-content-between align-items-center bg-white' + (isLast ? '' : ' border-bottom border-dark');

        if (!data || data.error) {
            item.innerHTML = `<span class="fw-bold text-uppercase text-muted">${climaCiudadesActivas[i]}</span>
                             <span class="badge bg-secondary rounded-0 px-3 py-2">Sin datos</span>`;
        } else {
            const iconCls = owmIconClass(data.icon_code);
            item.innerHTML = `
                <div>
                    <div class="fw-bold text-uppercase">${data.city}, ${data.country}</div>
                    <div class="small text-muted">${data.description}</div>
                </div>
                <span class="badge bg-dark rounded-0 px-3 py-2 fw-bold text-nowrap">
                    ${data.temp}°C <i class="bi ${iconCls} ms-1"></i>
                </span>`;
        }
        lista.appendChild(item);
    });

    const now = new Date();
    if (msg) msg.innerHTML = `<i class="bi bi-check-circle me-1"></i>Actualizado ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} · Cambia en 5 min`;
}

window.buscarClimaManual = async function() {
    const input = document.getElementById('climaBuscador');
    const resDiv = document.getElementById('climaBusquedaResult');
    if (!input || !input.value.trim()) return;

    resDiv.style.display = 'block';
    document.getElementById('climaBusqCiudad').textContent = 'Buscando...';
    document.getElementById('climaBusqTemp').textContent = '...';
    document.getElementById('climaBusqDesc').textContent = '';

    const data = await fetchCiudadClima(input.value.trim());
    if (!data || data.error) {
        document.getElementById('climaBusqCiudad').textContent = '⚠ Ciudad no encontrada';
        document.getElementById('climaBusqTemp').textContent = '—';
        document.getElementById('climaBusqDesc').textContent = 'Intenta con otro nombre o en inglés';
        return;
    }
    document.getElementById('climaBusqCiudad').textContent = `${data.city}, ${data.country}`;
    document.getElementById('climaBusqDesc').textContent = data.description;
    document.getElementById('climaBusqTemp').textContent = data.temp + '°C';
    document.getElementById('climaBusqSensacion').textContent = data.feels_like;
    document.getElementById('climaBusqHumedad').textContent = data.humidity;
    document.getElementById('climaBusqViento').textContent = data.wind;
};

// Permitir buscar con Enter
document.addEventListener('DOMContentLoaded', () => {
    const buscInput = document.getElementById('climaBuscador');
    if (buscInput) buscInput.addEventListener('keydown', e => { if (e.key === 'Enter') buscarClimaManual(); });
});

/* =========================================================================
   MÓDULO: LÍNEA DE TIEMPO INTERACTIVA (CONSTRUCTOR)
======================================================================== */

let travelTimeline = [];

/** @function evaluarDocumentacion Verifica si es vuelo nacional/internacional */
window.evaluarDocumentacion = function() {
    const origenInput = document.getElementById('rutaOrigen');
    const destinoInput = document.getElementById('rutaDestino');
    const nacSelect = document.getElementById('nacionalidadUsuario');
    
    // Contenedores
    const divINE = document.getElementById('divCheckINE');
    const divPasaporte = document.getElementById('divCheckPasaporte');
    const divVisa = document.getElementById('divCheckVisa');
    // Checkboxes
    const chkPasaporte = document.getElementById('checkPasaporte');
    const chkVisa = document.getElementById('checkVisa');

    if (!origenInput || !destinoInput || !nacSelect) return;

    const origen = origenInput.value.trim().toLowerCase();
    const destino = destinoInput.value.trim().toLowerCase();
    const nacCode = nacSelect.value;
    
    // Diccionario extendido para mapear el código de nacionalidad con palabras clave de país
    const countryMap = {
        'MX': ['méxico', 'mexico', 'cancún', 'cancun', 'tijuana', 'cdmx', 'monterrey', 'guadalajara', 'puerto vallarta'],
        'US': ['estados unidos', 'usa', 'ee.uu.', 'eeuu', 'new york', 'los angeles', 'miami', 'chicago', 'las vegas'],
        'ES': ['españa', 'espana', 'madrid', 'barcelona', 'valencia', 'sevilla', 'ibiza'],
        'CO': ['colombia', 'bogotá', 'bogota', 'medellín', 'medellin', 'cartagena', 'cali'],
        'AR': ['argentina', 'buenos aires', 'córdoba', 'cordoba', 'mendoza', 'bariloche']
    };

    let destinoEsNacional = false;
    let origenEsNacional = false;

    // Detectar si el lugar coincide con la nacionalidad
    if (nacCode !== 'OTRO' && countryMap[nacCode]) {
        destinoEsNacional = countryMap[nacCode].some(kw => destino.includes(kw));
        origenEsNacional = countryMap[nacCode].some(kw => origen.includes(kw));
    }

    // 1. Mostrar/Ocultar y forzar estados
    if (destino === "" || origen === "") {
        // Estado por defecto: mostrar pasaporte
        divINE.classList.add('d-none');
        divPasaporte.classList.remove('d-none');
        divVisa.classList.remove('d-none');
    } else if (destinoEsNacional) {
        // ES VUELO NACIONAL/DOMESTICO (Destino de su mismo país)
        divINE.classList.remove('d-none'); // Mostrar INE/ID
        
        divPasaporte.classList.add('d-none'); // Ocultar Pasaporte
        chkPasaporte.checked = false;
        
        divVisa.classList.add('d-none'); // Ocultar Visa
        chkVisa.checked = false;
    } else {
        // ES VUELO INTERNACIONAL
        divINE.classList.add('d-none'); 
        divPasaporte.classList.remove('d-none'); 
        chkPasaporte.checked = true; // El pasaporte es casi siempre obligatorio

        // Visa Check (Solo para destinos gringos si NO eres gringo ni europeo o de libre visado total)
        const isDestinoGringo = ['estados unidos', 'usa', 'ee.uu.', 'eeuu', 'new york', 'los angeles', 'miami', 'chicago', 'las vegas', 'canadá', 'canada', 'toronto', 'vancouver'].some(k => destino.includes(k));
        
        if (isDestinoGringo && nacCode !== 'US') {
            divVisa.classList.remove('d-none');
            // Sugerencia: chequear visa si es MEX/CO/AR
            chkVisa.checked = ['MX','CO','AR','OTRO'].includes(nacCode);
        } else {
            divVisa.classList.add('d-none');
            chkVisa.checked = false;
        }
    }

    window.calcularMochila();
};

window.rutaYaGenerada = false;

/** @function continuarAMochila Verifica que se haya generado ruta antes de avanzar */
window.continuarAMochila = function() {
    if (!window.rutaYaGenerada) {
        alert("⚠️ ¡Alto ahí viajero! Primero debes darle click a '1. GENERAR RUTA' para armar tu itinerario antes de continuar a la mochila.");
        return;
    }
    document.getElementById('tab-mochila').click();
    window.scrollTo({top:0,behavior:'smooth'});
};

/** @function generarRutaInteligente Construye la ruta paso a paso detectando distancias */
window.generarRutaInteligente = function() {
    const origenInput = document.getElementById('rutaOrigen');
    const destinoInput = document.getElementById('rutaDestino');
    const duracionInput = document.getElementById('rutaDuracion');
    const container = document.getElementById('timelineContainer');
    
    if (!origenInput || !destinoInput || !duracionInput || !container) return;

    const origen = origenInput.value.trim();
    const destino = destinoInput.value.trim();
    let duracion = parseInt(duracionInput.value.trim(), 10);

    if (!origen || !destino || isNaN(duracion) || duracion < 1) {
        container.innerHTML = '<p class="text-danger fw-bold text-center py-4"><i class="bi bi-exclamation-triangle-fill me-2 fs-4 d-block mb-3"></i>Datos insuficientes. Ingresa un Origen, Destino y Días válidos.</p>';
        return;
    }

    if (duracion > 90) duracion = 90;

    window.rutaYaGenerada = false; // Reset

    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-dark" role="status"></div><p class="fw-bold mt-3 text-uppercase">Trazando Ruta Logística...</p></div>';

    // Minisleep to feel like AI processing
    setTimeout(() => {
        travelTimeline = [];
        
        // Ejecutar evaluación de documentación antes de trazar
        window.evaluarDocumentacion();

        // Lógica de heuristicas simple (Detectar País)
        const paisOrigen = origen.includes(',') ? origen.split(',')[origen.split(',').length-1].trim().toLowerCase() : origen.toLowerCase();
        const paisDestino = destino.includes(',') ? destino.split(',')[destino.split(',').length-1].trim().toLowerCase() : destino.toLowerCase();
        const ciudadDestino = destino.includes(',') ? destino.split(',')[0].trim() : destino;
        
        // Arrays de zonas
        const asiapacific = ['japón', 'japon', 'china', 'corea', 'tailandia', 'indonesia', 'vietnam', 'australia', 'nueva zelanda', 'india', 'bali'];
        const europa = ['españa', 'francia', 'alemania', 'italia', 'reino unido', 'inglaterra', 'holanda', 'países bajos', 'suiza', 'turquía', 'portugal', 'grecia', 'roma', 'paris', 'madrid'];
        const sudamerica = ['argentina', 'brasil', 'chile', 'perú', 'peru', 'colombia', 'ecuador', 'bolivia', 'uruguay', 'paraguay'];
        const centroamerica = ['costa rica', 'guatemala', 'nicaragua', 'honduras', 'el salvador', 'panamá', 'panama', 'belice'];
        
        travelTimeline.push(`🛫 Salida programada desde <strong class="text-dark">${origen}</strong>`);

        // Detonadores de Layovers (Simulación Geográfica)
        let textoVueloIda = "";
        let textoVueloRegreso = "";

        if (paisOrigen === paisDestino) {
            // Vuelo Nacional
            textoVueloIda = `✈️ Vuelo Directo (o conexión opcional en capitales/hubs locales de no haber ruta directa)`;
            textoVueloRegreso = `🔄 Vuelo de retorno directo a casa (opción a conexión)`;
        } else {
            let opcionesEscala = "";
            if (centroamerica.some(z => paisDestino.includes(z) || destino.toLowerCase().includes(z))) {
                opcionesEscala = paisOrigen.includes('méxico') || paisOrigen.includes('mexico') ? "Cancún (CUN) o Ciudad de México (MEX)" : "Tijuana (TIJ) o Panamá (PTY)";
            } else if (asiapacific.some(z => paisDestino.includes(z) || destino.toLowerCase().includes(z))) {
                opcionesEscala = "Los Ángeles (LAX) o San Francisco (SFO)";
            } else if (europa.some(z => paisDestino.includes(z) || destino.toLowerCase().includes(z))) {
                opcionesEscala = "Madrid (MAD), Frankfurt (FRA) o París (CDG)";
            } else if (sudamerica.some(z => paisDestino.includes(z) || destino.toLowerCase().includes(z))) {
                opcionesEscala = "Bogotá (BOG) o Lima (LIM)";
            } else {
                opcionesEscala = "Aeropuertos Hub Centrales Internacionales";
            }
            textoVueloIda = `✈️ Vuelo Directo (de existir ruta) o 🔄 Conexión sugerida en <strong class="text-primary">${opcionesEscala}</strong> (~3h-5h de escala)`;
            textoVueloRegreso = `🔄 Vuelo de retorno cruzando con escala inversa en <strong class="text-primary">${opcionesEscala}</strong> (o Vuelo Directo)`;
        }

        travelTimeline.push(textoVueloIda);

        const actividadesGenericas = [
            `Visita a los principales atractivos culturales e históricos de la ciudad.`,
            `Día de tour gastronómico — cata de platillos típicos en mercados o restaurantes icónicos.`,
            `Excursión de medio día a áreas naturales, ruinas o atracciones relevantes cercanas.`,
            `Día enfocado en arte y recreación: monumentos, galerías o museos destacados.`,
            `Día libre para exploración local, fotografía de calles y relajación sin esquema.`,
            `Tarde de compras (souvenirs) y recorrido por el distrito comercial principal.`,
            `Exploración intensa de barrios emblemáticos y detalles de su arquitectura típica.`,
            `Día de inmersión total en la cultura local (talleres, caminatas de barrio, eventos folclóricos).`
        ];

        // Generar Itinerario Diario
        for (let i = 1; i <= duracion; i++) {
            if (i === 1) {
                travelTimeline.push(`📍 <strong class="text-success">Día ${i}:</strong> Arribo, Check-in en el hotel y caminata de reconocimiento por ${ciudadDestino}.`);
            } else if (i === duracion && duracion > 1) {
                travelTimeline.push(`🛫 <strong class="text-danger">Día ${i}:</strong> Últimas compras de viaje, cierre logístico y traslado al aeropuerto.`);
            } else {
                // Seleccionar actividad aleatoria del pool pero predecible con seed falso
                let randomAct = actividadesGenericas[(ciudadDestino.length + i) % actividadesGenericas.length];
                travelTimeline.push(`📍 <strong>Día ${i}:</strong> ${randomAct}`);
            }
        }
        
        // Retorno
        travelTimeline.push(textoVueloRegreso);
        travelTimeline.push(`🏠 Regreso y llegada segura a <strong class="text-dark">${origen}</strong>. ¡Fin de la ruta!`);

        renderizarTimeline();
        
        // Auto-Vincula al Smart Packing List
        if (window.cargarPackingList) window.cargarPackingList(destino);
    }, 600);
};

/** @function renderizarTimeline — Drag & Drop inline editable */
function renderizarTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    if (travelTimeline.length === 0) {
        container.innerHTML = '<p class="text-muted fw-bold text-center py-4">Aún no has definido pasos para tu ruta.</p>';
        return;
    }

    // Inyectar CSS una sola vez
    if (!document.getElementById('timelineAnimCSS')) {
        const style = document.createElement('style');
        style.id = 'timelineAnimCSS';
        style.innerHTML = `
            @keyframes fadeSlideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
            .tl-node { animation: fadeSlideIn 0.35s ease-out forwards; opacity:0; }
            .tl-card { transition: box-shadow 0.15s, transform 0.15s; cursor: grab; user-select: none; }
            .tl-card:active { cursor: grabbing; }
            .tl-card.dragging { opacity: 0.35; transform: scale(0.97); box-shadow: 2px 2px 0 0 #000 !important; }
            .tl-card.drag-over { border-color: #0d6efd !important; box-shadow: 0 0 0 3px rgba(13,110,253,0.35) !important; }
            .tl-edit-panel { display:none; border-top: 2px solid #000; margin-top:10px; padding-top:10px; }
            .tl-edit-panel.open { display:block; }
            .tl-action-btn { border:none; background:transparent; padding:4px 7px; cursor:pointer; border-radius:0; transition:background 0.15s; }
            .tl-action-btn:hover { background:#f0f0f0; }
            .tl-textarea { resize:vertical; font-size:13px; font-weight:600; border:2px solid #000; border-radius:0; padding:8px; width:100%; min-height:56px; font-family:inherit; box-shadow:2px 2px 0 0 #000; }
            .tl-textarea:focus { outline:none; border-color:#0d6efd; box-shadow:3px 3px 0 0 #0d6efd; }
            .tl-add-zone { background:#f8f9fa; border:2px dashed #000; padding:16px; text-align:center; margin-top:12px; }
            .drag-hint { font-size:10px; color:#888; font-weight:600; text-transform:uppercase; margin-top:4px; }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = travelTimeline.map((step, index) => `
        <div class="d-flex align-items-start mb-4 position-relative tl-node" id="tn-${index}"
             style="animation-delay:${index * 0.07}s;">
            <div class="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                 style="width:32px;height:32px;z-index:2;border:2px solid #000;box-shadow:0 0 0 4px #fff;font-size:12px;pointer-events:none;">
                ${index + 1}
            </div>
            <div class="ms-3 p-3 border border-dark border-3 bg-light w-100 tl-card"
                 style="box-shadow:4px 4px 0 0 #000;"
                 draggable="true"
                 data-idx="${index}"
                 ondragstart="tlDragStart(event,${index})"
                 ondragover="tlDragOver(event)"
                 ondrop="tlDrop(event,${index})"
                 ondragend="tlDragEnd(event)">

                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div style="flex:1;">
                        <span class="fw-bold text-dark" style="font-size:13px;letter-spacing:0.3px;">${step}</span>
                        <div class="drag-hint"><i class="bi bi-grip-horizontal me-1"></i>Arrastra para reacomodar</div>
                    </div>
                    <div class="d-flex gap-1 flex-shrink-0">
                        <button class="tl-action-btn" title="Editar actividad" onclick="tlToggleEdit(${index})">
                            <i class="bi bi-pencil-fill text-primary"></i>
                        </button>
                        <button class="tl-action-btn" title="Eliminar paso" onclick="eliminarEventoTimeline(${index})">
                            <i class="bi bi-trash text-danger"></i>
                        </button>
                    </div>
                </div>

                <div class="tl-edit-panel" id="tl-edit-${index}">
                    <textarea class="tl-textarea mt-2" id="tl-ta-${index}" rows="3">${step.replace(/<[^>]*>/g,'')}</textarea>
                    <div class="d-flex gap-2 mt-2">
                        <button class="btn btn-dark btn-sm rounded-0 fw-bold border-2 border-dark px-3"
                                onclick="tlSaveEdit(${index})">
                            <i class="bi bi-check-lg me-1"></i>Guardar
                        </button>
                        <button class="btn btn-outline-secondary btn-sm rounded-0 fw-bold border-2 px-3"
                                onclick="tlToggleEdit(${index})">Cancelar</button>
                    </div>
                </div>
            </div>
            ${index < travelTimeline.length - 1 ?
                '<div class="position-absolute bg-dark" style="width:2px;height:calc(100% + 8px);left:14.5px;top:32px;z-index:1;"></div>' : ''}
        </div>
    `).join('') + `
        <div class="tl-add-zone mt-2" id="addActivityZone">
            <button class="btn btn-outline-dark fw-bold rounded-0 border-2 px-4 py-2 w-100 hover-lift"
                    style="box-shadow:2px 2px 0 0 #000;" onclick="mostrarAgregarActividad()">
                <i class="bi bi-plus-circle-fill me-2 text-primary"></i>Agregar actividad personalizada
            </button>
            <div id="newActivityForm" class="d-none mt-3 text-start">
                <textarea class="tl-textarea mb-2" id="newActivityInput"
                    placeholder="Ej: 🎭 Día 4: Visita al teatro de la ópera y cena romántica en restaurante local..."></textarea>
                <div class="d-flex gap-2">
                    <button class="btn btn-dark btn-sm rounded-0 fw-bold border-2 border-dark px-3"
                            onclick="agregarActividadCustom()">
                        <i class="bi bi-plus-lg me-1"></i>Añadir al itinerario
                    </button>
                    <button class="btn btn-outline-secondary btn-sm rounded-0 fw-bold border-2 px-3"
                            onclick="document.getElementById('newActivityForm').classList.add('d-none')">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ──── Drag & Drop handlers ────────────────────────────────────────────────────
let _tlDragSrcIdx = null;

function tlDragStart(e, index) {
    _tlDragSrcIdx = index;
    e.dataTransfer.effectAllowed = 'move';
    // pequeño delay para que el ghost se vea antes de aplicar estilo
    setTimeout(() => e.target.closest('.tl-card').classList.add('dragging'), 0);
}

function tlDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.tl-card');
    if (card) {
        document.querySelectorAll('.tl-card.drag-over').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
    }
}

function tlDrop(e, targetIdx) {
    e.preventDefault();
    if (_tlDragSrcIdx === null || _tlDragSrcIdx === targetIdx) return;
    // Swap en el array
    const temp = travelTimeline[_tlDragSrcIdx];
    travelTimeline[_tlDragSrcIdx] = travelTimeline[targetIdx];
    travelTimeline[targetIdx] = temp;
    _tlDragSrcIdx = null;
    renderizarTimeline();
}

function tlDragEnd(e) {
    document.querySelectorAll('.tl-card.dragging, .tl-card.drag-over')
        .forEach(c => c.classList.remove('dragging', 'drag-over'));
    _tlDragSrcIdx = null;
}

// ──── Edición inline ──────────────────────────────────────────────────────────
function tlToggleEdit(index) {
    const panel = document.getElementById(`tl-edit-${index}`);
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.tl-edit-panel.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) { panel.classList.add('open'); document.getElementById(`tl-ta-${index}`)?.focus(); }
}

function tlSaveEdit(index) {
    const ta = document.getElementById(`tl-ta-${index}`);
    if (!ta || !ta.value.trim()) return;
    travelTimeline[index] = ta.value.trim();
    renderizarTimeline();
}

function eliminarEventoTimeline(index) {
    travelTimeline.splice(index, 1);
    renderizarTimeline();
}

function moverTimeline(index, dir) { /* mantenido por compatibilidad — ya no se usa en UI */
    const ni = index + dir;
    if (ni < 0 || ni >= travelTimeline.length) return;
    [travelTimeline[index], travelTimeline[ni]] = [travelTimeline[ni], travelTimeline[index]];
    renderizarTimeline();
}

function toggleEditTimeline(i)    { tlToggleEdit(i); }
function guardarEdicionTimeline(i){ tlSaveEdit(i);   }

function mostrarAgregarActividad() {
    const f = document.getElementById('newActivityForm');
    if (f) { f.classList.remove('d-none'); document.getElementById('newActivityInput')?.focus(); }
}

function agregarActividadCustom() {
    const inp = document.getElementById('newActivityInput');
    if (!inp || !inp.value.trim()) return;
    travelTimeline.splice(Math.max(0, travelTimeline.length - 1), 0, inp.value.trim());
    inp.value = '';
    renderizarTimeline();
}

/* =========================================================================
   MÓDULO: BÚSQUEDA DE VUELOS (Google Flights / Skyscanner / Kayak)
========================================================================= */

/**
 * @function abrirBuscadorVuelos
 * Lee origen y destino del itinerario y genera links directos a los principales
 * comparadores de vuelos con la ruta prellenada. No requiere API externa.
 */
window.abrirBuscadorVuelos = function() {
    const origenInput  = document.getElementById('rutaOrigen');
    const destinoInput = document.getElementById('rutaDestino');
    const fechaInput   = document.getElementById('rutaFecha');
    const panelVuelos  = document.getElementById('panelVuelos');
    const linksGrid    = document.getElementById('vuelosLinksGrid');
    const btn          = document.getElementById('btnBuscarVuelos');

    const origen  = origenInput  ? origenInput.value.trim()  : '';
    const destino = destinoInput ? destinoInput.value.trim() : '';
    const fecha   = fechaInput   ? fechaInput.value.trim()   : ''; // YYYY-MM-DD

    if (!destino) {
        if (btn) {
            btn.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-2 text-warning"></i>Ingresa un destino primero';
            setTimeout(() => { btn.innerHTML = '<i class="bi bi-search me-2"></i>Buscar Vuelos'; }, 2500);
        }
        return;
    }

    // Limpiar: solo ciudad (antes de la primera coma)
    const clean = (str) => (str.includes(',') ? str.split(',')[0].trim() : str.trim());
    const origenClean  = clean(origen  || 'México');
    const destinoClean = clean(destino);

    // Formato de fecha para Skyscanner/Kayak: YYMMDD
    let fechaYYMMDD = '';
    let fechaISO   = '';
    if (fecha) {
        const parts = fecha.split('-'); // [YYYY, MM, DD]
        if (parts.length === 3) {
            fechaYYMMDD = parts[0].slice(2) + parts[1] + parts[2]; // ej: 260521
            fechaISO = fecha; // 2026-05-21
        }
    }

    // === GOOGLE FLIGHTS ===
    // El parámetro `q` con "vuelos de X a Y" pre-rellena origen y destino automáticamente
    const googleQ = `vuelos de ${origenClean} a ${destinoClean}${fecha ? ' ' + fechaISO : ''}`;
    const googleFlightsUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(googleQ)}&hl=es`;

    // === SKYSCANNER ===
    // Formato: /vuelos/ORIGEN/DESTINO/YYMMDD para ida simple
    // Skyscanner usa slugs en minúsculas con guiones para los nombres
    const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
    const skySrc = slugify(origenClean);
    const skyDst = slugify(destinoClean);
    const skyscannerUrl = fechaYYMMDD
        ? `https://www.skyscanner.com.mx/vuelos/${skySrc}/${skyDst}/${fechaYYMMDD}/`
        : `https://www.skyscanner.com.mx/vuelos/${skySrc}/${skyDst}/`;

    // === KAYAK ===
    // Formato: /flights/ORIGEN/DESTINO/YYYY-MM-DD para vuelo de ida
    const kayakUrl = fechaISO
        ? `https://www.kayak.com.mx/flights/${encodeURIComponent(origenClean)}/${encodeURIComponent(destinoClean)}/${fechaISO}`
        : `https://www.kayak.com.mx/flights/${encodeURIComponent(origenClean)}/${encodeURIComponent(destinoClean)}`;

    // === MOMONDO ===
    const momondoUrl = `https://www.momondo.mx/vuelos/${encodeURIComponent(origenClean)}/${encodeURIComponent(destinoClean)}${fechaISO ? '/' + fechaISO : ''}`;

    // Info contextual de ruta
    const rutaLabel = `${origenClean} → ${destinoClean}${fecha ? ' · ' + fechaISO : ''}`;

    const plataformas = [
        {
            nombre: 'Google Flights',
            icon: 'bi-google',
            url: googleFlightsUrl,
            desc: 'Comparador en tiempo real · Pre-rellena origen y destino',
            badge: 'RECOMENDADO',
            badgeClass: 'bg-success'
        },
        {
            nombre: 'Skyscanner',
            icon: 'bi-airplane-fill',
            url: skyscannerUrl,
            desc: 'Alertas de precio · Fechas flexibles · Ruta pre-cargada',
            badge: 'POPULAR',
            badgeClass: 'bg-dark'
        },
        {
            nombre: 'Kayak',
            icon: 'bi-compass-fill',
            url: kayakUrl,
            desc: 'Predictor de precios · Incluye fecha de salida',
            badge: 'PREDICTOR',
            badgeClass: 'bg-secondary'
        },
        {
            nombre: 'Momondo',
            icon: 'bi-globe2',
            url: momondoUrl,
            desc: 'Rutas alternativas y escalas económicas',
            badge: '',
            badgeClass: ''
        }
    ];

    if (linksGrid) {
        linksGrid.innerHTML = `
            <div class="fw-black text-uppercase text-muted mb-2" style="font-size:10px; letter-spacing:0.8px;">
                <i class="bi bi-arrow-right-circle me-1"></i>${rutaLabel}
            </div>
        ` + plataformas.map(p => `
            <a href="${p.url}" target="_blank" rel="noopener noreferrer"
               class="d-flex justify-content-between align-items-center p-2 border border-dark border-2 bg-white text-dark text-decoration-none"
               style="box-shadow: 2px 2px 0 0 #000; transition: transform 0.15s, box-shadow 0.15s;"
               onmouseenter="this.style.transform='translate(-2px,-2px)';this.style.boxShadow='4px 4px 0 0 #000'"
               onmouseleave="this.style.transform='';this.style.boxShadow='2px 2px 0 0 #000'">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi ${p.icon} fs-5"></i>
                    <div>
                        <div class="fw-black text-uppercase" style="font-size: 12px; letter-spacing: 0.5px;">
                            ${p.nombre}
                            ${p.badge ? `<span class="badge ${p.badgeClass} rounded-0 ms-1 px-1 py-0" style="font-size:8px;">${p.badge}</span>` : ''}
                        </div>
                        <div class="text-muted fw-bold" style="font-size: 10px;">${p.desc}</div>
                    </div>
                </div>
                <i class="bi bi-box-arrow-up-right text-muted flex-shrink-0"></i>
            </a>
        `).join('');
    }

    if (panelVuelos) panelVuelos.classList.remove('d-none');
    if (btn) {
        btn.innerHTML = '<i class="bi bi-check-circle-fill me-2 text-success"></i>Ver opciones';
        setTimeout(() => { btn.innerHTML = '<i class="bi bi-search me-2"></i>Buscar Vuelos'; btn.disabled = false; }, 2000);
    }
};



// Inicializadores Extra para Dashboard
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('climaCiudadesLista')) {
        actualizarClimaGlobal();
        // Rotar 5 ciudades aleatorias cada 5 minutos
        setInterval(actualizarClimaGlobal, 300000);
    }
});

/* =========================================================================
   MÓDULO: CHATBOT IA FRONTEND (SIMULADO)
========================================================================= */

/** Minimiza el chat (solo header visible, sin burbuja) */
window.minimizarChat = function() {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;
    if (chatWindow.classList.contains('minimized')) {
        // Si ya está minimizado, expándelo
        chatWindow.classList.remove('minimized');
    } else {
        chatWindow.classList.add('minimized');
    }
};

/** Abre el chat desde la burbuja */
window.abrirChat = function() {
    const chatWindow = document.getElementById('chatWindow');
    const bubbleBtn  = document.getElementById('chatBotBubble');
    const chatTooltip = document.getElementById('chatTooltip');
    if (!chatWindow) return;
    chatWindow.classList.add('active');
    chatWindow.classList.remove('minimized');
    if (bubbleBtn) bubbleBtn.style.transform = 'scale(0)';
    if (chatTooltip) chatTooltip.classList.add('hide');
};

document.addEventListener("DOMContentLoaded", () => {
    const bubbleBtn = document.getElementById('chatBotBubble');
    const chatWindow = document.getElementById('chatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const sendBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const chatBody = document.getElementById('chatBody');

    if (!bubbleBtn || !chatWindow) return;

    const chatTooltip = document.getElementById('chatTooltip');

    // Toggle Chat Window
    bubbleBtn.addEventListener('click', () => {
        chatWindow.classList.add('active');
        chatWindow.classList.remove('minimized');
        bubbleBtn.style.transform = "scale(0)";
        if(chatTooltip) chatTooltip.classList.add('hide');
    });

    // X = cerrar completamente (muestra la burbuja de nuevo)
    closeChatBtn.addEventListener('click', () => {
        chatWindow.classList.remove('active');
        chatWindow.classList.remove('minimized');
        bubbleBtn.style.transform = "scale(1)";
    });

    // Respuestas predefinidas por palabras clave
    const procesarMensaje = () => {
        const text = chatInput.value.trim();
        if (text === "") return;

        // Add user message
        const userMsg = document.createElement('div');
        userMsg.className = "chat-message user shadow-sm";
        userMsg.innerText = text;
        chatBody.appendChild(userMsg);
        chatInput.value = "";
        
        chatBody.scrollTop = chatBody.scrollHeight;

        // Mostrar indicador de "escribiendo..."
        const typingMsg = document.createElement('div');
        typingMsg.className = "chat-message bot shadow-sm text-muted fst-italic";
        typingMsg.innerText = "Escribiendo...";
        typingMsg.id = "typingIndicator";
        chatBody.appendChild(typingMsg);
        chatBody.scrollTop = chatBody.scrollHeight;

        // Mandar petición Fetch real a nuestro backend de Gemini
        const currentPath = window.location.pathname;
        const destinoActual = window._guiaDestinoActual || "Ningún destino seleccionado";
        const contextStr = "App Module: " + currentPath + " | Localidad activa: " + destinoActual;

        fetch('/api/gemini_chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, contexto: contextStr })
        })
        .then(res => res.json())
        .then(data => {
            const ind = document.getElementById("typingIndicator");
            if(ind) ind.remove();

            const botMsg = document.createElement('div');
            botMsg.className = "chat-message bot shadow-sm";
            
            // Format MD bold and new lines to simple basic HTML
            let formattedReply = (data.reply || "").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formattedReply = formattedReply.replace(/\n/g, '<br>');

            botMsg.innerHTML = formattedReply;
            chatBody.appendChild(botMsg);
            chatBody.scrollTop = chatBody.scrollHeight;
        })
        .catch(err => {
            console.error("Error en AI", err);
            const ind = document.getElementById("typingIndicator");
            if(ind) ind.remove();
            
            const botMsg = document.createElement('div');
            botMsg.className = "chat-message bot shadow-sm";
            botMsg.innerHTML = "⚠️ Miau, mi núcleo de IA falló o mi tiempo de espera expiró. Checa la consola.";
            chatBody.appendChild(botMsg);
            chatBody.scrollTop = chatBody.scrollHeight;
        });
    };

    if(sendBtn) sendBtn.addEventListener('click', procesarMensaje);
    if(chatInput) chatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') procesarMensaje();
    });
});

/* =========================================================================
   MÓDULO: HISTORIAL DE VIAJES
========================================================================= */

/**
 * Escucha los valores de ruta y los envía para encriptar mediante SQL en su cuenta
 */
window.guardarViajeHistorial = function(btnElement) {
    const origen = document.getElementById('rutaOrigen')?.value.trim();
    const destino = document.getElementById('rutaDestino')?.value.trim();
    const duracion = document.getElementById('rutaDuracion')?.value.trim();
    const fecha = document.getElementById('rutaFecha')?.value.trim();

    // 1. Recolectar Mochila: IDs + detalle de costos de cada ítem marcado
    let mochilaIDs = [];
    let mochilaDetalle = [];
    const mapaItems = {
        checkSeguro:    { nombre: '🏥 Seguro Médico de Viaje',         costo: 1200 },
        checkMaleta:    { nombre: '🧳 Maleta Documentada Extra',        costo: 900  },
        checkINE:       { nombre: '🧯 Identificación Oficial (INE/ID)', costo: 0    },
        checkPasaporte: { nombre: '🛂 Pasaporte (Renovación/Trámite)', costo: 3940 },
        checkVisa:      { nombre: '🗂️ Trámite de Visa',               costo: 3400 },
    };
    document.querySelectorAll('#mochilaForm .form-check-input').forEach(cb => {
        if (cb.checked) {
            mochilaIDs.push(cb.id);
            const info = mapaItems[cb.id];
            if (info) mochilaDetalle.push(info);
        }
    });
    const totalMochila = mochilaDetalle.reduce((s, i) => s + i.costo, 0);

    // 2. Recolectar Vibes
    let vibesState = window.interesesGlobalesSeleccionados || [];

    // 3. Recolectar Smart Packing List (IDs marcados)
    let packingIDs = [];
    document.querySelectorAll('.packing-item.checked').forEach(it => {
        packingIDs.push(it.id);
    });

    // 4. Presupuesto original (viene de la URL si se llegó del presupuesto)
    const urlParams = new URLSearchParams(window.location.search);
    const presupuestoViaje = urlParams.get('budget') ? parseInt(urlParams.get('budget'), 10) : null;

    // 5. Pasos del itinerario personalizados
    const itinerarioSteps = (window.travelTimeline || []).map(s => s.replace(/<[^>]*>/g, ''));

    if (!origen || !destino || !duracion || isNaN(duracion) || duracion < 1) {
        alert("⚠️ Por favor ingresa al menos el Origen, Destino Principal y los Días Totales antes de intentar guardar el viaje.");
        return;
    }

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Guardando...';
    btnElement.disabled = true;

    fetch('/api/save_route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            origen: origen,
            destino: destino,
            duracion_dias: parseInt(duracion, 10),
            fecha_ideal: fecha || '',
            mochila_state: JSON.stringify(mochilaIDs),
            vibes_state: JSON.stringify(vibesState),
            packing_state: JSON.stringify(packingIDs),
            // Datos para el email de resumen
            mochila_detalle: mochilaDetalle,
            total_mochila: totalMochila,
            presupuesto_viaje: presupuestoViaje,
            itinerario_steps: itinerarioSteps,
            is_final: true
        })
    })

    .then(response => {
        if (!response.ok && response.status === 401) {
            // Guardar payload para después del login
            const payload = {
                origen: origen,
                destino: destino,
                duracion_dias: parseInt(duracion, 10),
                fecha_ideal: fecha || '',
                mochila_state: JSON.stringify(mochilaIDs),
                vibes_state: JSON.stringify(vibesState),
                packing_state: JSON.stringify(packingIDs),
                mochila_detalle: mochilaDetalle,
                total_mochila: totalMochila,
                presupuesto_viaje: presupuestoViaje,
                itinerario_steps: itinerarioSteps,
                is_final: true
            };
            sessionStorage.setItem('pending_itinerary_save', JSON.stringify(payload));

            // Mostrar un overlay amigable antes de redirigir (en vez de un alert confuso)
            btnElement.innerHTML = '<i class="bi bi-lock-fill me-2"></i>Iniciando sesión...';
            const loginOverlay = document.createElement('div');
            loginOverlay.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:99999;display:flex;justify-content:center;align-items:center;">
                    <div style="background:#fff;border:4px solid #000;box-shadow:12px 12px 0 0 #000;padding:40px 32px;text-align:center;max-width:420px;width:90%;">
                        <i class="bi bi-lock-fill d-block mb-3" style="font-size:3rem;"></i>
                        <h4 class="fw-black text-uppercase mb-2">¡Tu viaje está listo!</h4>
                        <p class="fw-bold text-muted mb-4" style="font-size:0.9rem;">Solo necesitas iniciar sesión o registrarte para guardarlo en tu historial.</p>
                        <div class="spinner-border text-dark" role="status"><span class="visually-hidden">Redirigiendo...</span></div>
                        <p class="small fw-bold text-muted mt-3 mb-0">Redirigiendo al inicio de sesión...</p>
                    </div>
                </div>
            `;
            document.body.appendChild(loginOverlay);

            // Flag para que el catch no muestre alert
            window._guardarViaje_redirecting = true;

            // Construir URL de redirección segura
            const currentUrl = window.location.href;
            setTimeout(() => {
                window.location.href = `/login?next=${encodeURIComponent(currentUrl)}&msg=Inicia+sesi%C3%B3n+o+regs%C3%ADtrate+para+guardar+tu+viaje`;
            }, 1800);
            throw new Error('__REDIRECT_TO_LOGIN__');
        }
        return response.json();
    })
    .then(data => {
        if (data && data.success) {
            btnElement.classList.remove('btn-outline-dark', 'bg-white', 'text-dark');
            btnElement.classList.add('btn-success', 'text-white');
            btnElement.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Guardado en Historial';
            
            // Ventana flotante centralizada
            const notif = document.createElement('div');
            notif.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center; transition: opacity 0.5s ease;" id="overlayGuardado">
                    <div style="background: white; border: 4px solid #000; box-shadow: 12px 12px 0 0 #000; padding: 40px; text-align: center; max-width: 500px; transform: scale(0.8); animation: popScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
                        <i class="bi bi-floppy-fill text-dark mb-3 d-block" style="font-size: 3.5rem;"></i>
                        <h2 class="fw-black text-uppercase text-dark mb-3">¡Listo, tu viaje está guardado!</h2>
                        <p class="fw-bold text-muted mb-0">Lo hemos respaldado en tu Historial en la nube.</p>
                    </div>
                </div>
            `;
            if (!document.getElementById('animPopScale')) {
                const style = document.createElement('style');
                style.id = 'animPopScale';
                style.innerHTML = '@keyframes popScale { to { transform: scale(1); } }';
                document.head.appendChild(style);
            }
            document.body.appendChild(notif);
            
            setTimeout(() => { 
                const overlay = document.getElementById('overlayGuardado');
                if(overlay) overlay.style.opacity = '0';
                setTimeout(() => notif.remove(), 500);
            }, 3500);

            setTimeout(() => {
                btnElement.classList.remove('btn-success', 'text-white');
                btnElement.classList.add('btn-outline-dark', 'bg-white', 'text-dark');
                btnElement.innerHTML = originalText;
                btnElement.disabled = false;
            }, 3000);
        } else {
            alert('❌ Error: ' + (data.message || 'Error guardando el viaje.'));
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    })
    .catch(error => {
        // Si es redirección intencional al login, no mostrar alert ni restaurar botón
        if (window._guardarViaje_redirecting || (error.message && error.message === '__REDIRECT_TO_LOGIN__')) {
            window._guardarViaje_redirecting = false;
            return;
        }
        console.error('Error al guardar viaje:', error);
        alert('❌ Falla de Red: El servidor no respondió. Verifica tu conexión e intenta de nuevo.');
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    });
};

/* =========================================================================
   MÓDULO: ANIMACIONES DE SCROLL (OBSERVER)
========================================================================= */
document.addEventListener("DOMContentLoaded", () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            } else {
                entry.target.classList.remove('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scroll-animate').forEach(el => {
        observer.observe(el);
    });

    // Cargar lista de monedas dinamicamente si estamos en el dashboard
    if (document.getElementById('fromCurrency')) {
        cargarListaMonedas();
    }
});

// =========================================================================
// AUTO-SAVE LUEGO DEL LOGIN
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = document.body.dataset.loggedIn === 'true';
    const pendingSave = sessionStorage.getItem('pending_itinerary_save');
    
    if (isLoggedIn && pendingSave) {
        // Overlay de carga inmediato para mejorar UX
        const loadingOverlay = document.createElement('div');
        loadingOverlay.innerHTML = '<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: white; z-index: 99999; display: flex; flex-direction: column; justify-content: center; align-items: center;"><div class="spinner-border text-dark" style="width: 3rem; height: 3rem;" role="status"></div><h4 class="mt-3 fw-black text-dark text-uppercase tracking-wider">Guardando viaje...</h4><p class="text-muted fw-bold">Por favor espera un momento.</p></div>';
        document.body.appendChild(loadingOverlay);

        // Enviar automáticamente a la BD
        const payload = JSON.parse(pendingSave);
        sessionStorage.removeItem('pending_itinerary_save');
        
        fetch('/api/save_route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(data => {
            if (data && data.success && data.route_id) {
                // Redirigir al historial e indicarle que resalte la nueva ruta
                window.location.href = `/historial?new_route_id=${data.route_id}&auto_saved=1`;
            } else if (data && data.success) {
                // Fallback por si no viene el route_id
                window.location.href = `/historial?auto_saved=1`;
            }
        })
        .catch(console.error);
    }
});
