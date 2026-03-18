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
});

/* =========================================================================
   MÓDULO: CALCULADORA Y PANEL DE ESTADÍSTICAS
========================================================================= */
let donutGráficoInstancia = null; // Almacenamiento de Chart global.

const ESTILOS_VIAJE = {
    'mochilero': { hospedaje: 0.20, vuelos: 0.40, comida: 0.25, actividades: 0.15 },
    'estandar':  { hospedaje: 0.35, vuelos: 0.30, comida: 0.20, actividades: 0.15 },
    'lujo':      { hospedaje: 0.50, vuelos: 0.15, comida: 0.20, actividades: 0.15 }
};

let TASAS_CAMBIO = {
    'MXN': { tasa: 1, simbolo: '$' },
    'USD': { tasa: 1 / 17.0, simbolo: 'USD $' }, // Default fallback
    'EUR': { tasa: 1 / 18.5, simbolo: '€' }      // Default fallback
};

// Fetch asíncrono de divisas de la vida real (API pública grauita)
async function obtenerTasasReales() {
    try {
        console.log("✈️ Solicitando tasas de cambio reales (Base MXN)...");
        // Utilizamos Open Exchange Rates API (dominio público, sin auth key)
        const response = await fetch('https://open.er-api.com/v6/latest/MXN');
        const data = await response.json();
        
        if (data && data.rates) {
            TASAS_CAMBIO['USD'].tasa = data.rates.USD;
            TASAS_CAMBIO['EUR'].tasa = data.rates.EUR;
            console.log("✅ Tasas actualizadas! USD:", data.rates.USD, "| EUR:", data.rates.EUR);
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
}

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
                    '#0d6efd', // Primary Azul
                    '#0dcaf0', // Info Cyan
                    '#ffc107', // Warning Amarillo
                    '#198754'  // Success Verde
                ],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
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
        if (meses === 12) btnElement.innerHTML = '12 ⭐';
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
            const rowStyle = esActual ? 'background: #000; color: #fff;' : '';
            return `<tr style="${rowStyle}">
                <td class="fw-black">${p} meses ${esActual ? '✓' : ''}</td>
                <td>${fmt(c)}</td>
                <td>${fmt(tot)}</td>
                <td class="${esActual ? 'text-warning' : 'text-danger'}">${fmt(int)}</td>
            </tr>`;
        }).join('');
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

// Data Fuente simulando un acceso a un API RESTful backend
const inteligenciaDestinosJSON = {
    'tokio': {
        titulo: "Tokio, Japón",
        cultura: "Tokio fusiona reverencia arraigada por lo antiguo junto a lo ultra-vanguardista digital. Una ley no escrita muy respetada en el entorno nipón es la disciplina pública: hablar fuerte por los teléfonos móviles dentro del Metro se considera inapropiado e intrusivo.",
        puntosInteres: [
            "Sensorial recorrido en el Templo Senso-ji, de noche preferiblemente",
            "Sumergirse en Akihabara (electrónica)",
            "Espectador silencioso en el cruce peatonal de Shibuya"
        ],
        zonasRojas: "Roppongi central pasada la medianoche. Evita promotores que te ofrecen 'drink all you can cheap' en la calle, ya que son estafadores notorios y podrías enfrentarte a cuentas hiper infladas insuperables."
    },
    'buenos_aires': {
        titulo: "Buenos Aires, Argentina",
        cultura: "Pasión de fútbol y asado, una metrópoli repleta de un fuerte sello arquitectónico europeo (apodada la 'París sudamericana') e impulsada por fuertes movidas literias, cafés notables, y el emblemático ambiente romántico del Tango.",
        puntosInteres: [
            "Visita arquitectónica obligatoria al legendario Teatro Colón",
            "Caminata matutina por Puerto Madero de frente al río",
            "Fin de semana feriado en la Feria de San Telmo y antigüedades"
        ],
        zonasRojas: "Limita tu visita nocturna en La Boca netamente a ciertas áreas de Caminito. No ostentes electrónica cara o celulares de gama puntera al cruzar grandes avenidas descuidadamente. Previene tirones de motociclistas ('motochorros')."
    },
    'roma': {
        titulo: "Roma, Italia",
        cultura: "Como pasear por la cuna del imperio en un monumental museo en vivo. Se respira el peso de la iglesia en el Vaticano y es vital que se demuestre respeto al código de vestimenta conservador para no ser rechazado denegado en ingresos eclesiásticos.",
        puntosInteres: [
            "Fotografía en el Coliseo Romano pre comprado virtualmente",
            "Lanzar tu moneda por sobre el hombro izquierdo en la majestuosa Fontana Di Trevi",
            "Almuerzo pausado de la culinaria Trasteveriana genuina"
        ],
        zonasRojas: "Altamente propensos al carterismo sofisticado cercano a zonas pico alrededor de Termini Station (Estación central) y dentro de las aglomeradas rutas de los buses y tren del Metro, principalmente por distracciones o bloqueos de sujetos."
    },
    'estambul': {
        titulo: "Estambul, Turquía",
        cultura: "La fantástica ciudad intercontinental entrelazada donde occidente choca visualmente con oriente. Llamados profundos al rezo a través de amplificadores que inundan las calles desde mezquitas majestuosamente elaboradas. Regatear en bazares no solo es aceptado, es fuertemente esperado por el locatario.",
        puntosInteres: [
            "Visión obligatoria a la Santa Sofía y Mezquita Azul conectadas por espectaculares plazas",
            "Viaje escénico cruzando los dos continentes sobre un ferry del Bósforo",
            "Aperitivo clásico del auténtico Döner Kebab callejero y tes árabes"
        ],
        zonasRojas: "Prohibidamente rechaza la aproximación aleatoria de guías de 'lustradores de zapatos' supuestamente amigables, que acaban extorsionando dinero en las calles y bares locales sin licencia."
    }
};

/** @function cargarGuiaSegura inserta textualmente insights y listas mediante inyección DOM */
function cargarGuiaSegura() {
    const cajaSelectora = document.getElementById('destinosDropdown');
    const panelUI = document.getElementById('panelDestino');
    
    if(!cajaSelectora || !panelUI) return;
    
    const destinoClave = cajaSelectora.value;
    const objetoData = inteligenciaDestinosJSON[destinoClave];

    // Detener ejecucion si seleccion esta invalida o vacia
    if(!objetoData) return;

    // Despliegue de Panel Oculto Inicial
    panelUI.classList.remove('d-none');

    // Inyección de Strings Base
    document.getElementById('panelTitulo').innerText = objetoData.titulo;
    document.getElementById('panelCultura').innerText = objetoData.cultura;
    document.getElementById('panelEvitar').innerText = objetoData.zonasRojas;

    // Poblamiento Dinámico Iterativo de Checklist Beneficiosa
    const listaHtmlUl = document.getElementById('panelRecomendaciones');
    listaHtmlUl.innerHTML = ''; // Restet

    objetoData.puntosInteres.forEach((punto) => {
        const elementoHijo = document.createElement('li');
        elementoHijo.className = "fs-6 fw-medium d-flex align-items-center bg-white p-2 rounded shadow-sm";
        // Uso de ícono Bootstrap
        elementoHijo.innerHTML = `<i class="bi bi-check-circle-fill text-success me-2"></i> ${punto}`;
        listaHtmlUl.appendChild(elementoHijo);
    });
}

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

const recomendacionesPorInteres = {
    'fiesta': {
        titulo: "Ibiza, España o Cancún, MX",
        desc: "¡Ideal para la vida nocturna ilimitada! Tendrás acceso a clubes de renombre mundial, festivales y fiestas en la playa que nunca terminan. Tu presupuesto debe enfocarse principalmente a entretenimiento y entradas."
    },
    'cultura': {
        titulo: "Roma, Italia o CDMX, MX",
        desc: "Sumérgete en un museo al aire libre. Estás rodeado de ruinas, galerías hiper-realistas y una historia milenaria. Los pases culturales y los recorridos guiados serán tu mayor enfoque, los hospedajes céntricos te darán la mejor experiencia."
    },
    'naturaleza': {
        titulo: "Patagonia, Arg o Chiapas, MX",
        desc: "Respira aire puro y desconéctate del sistema. Perfectos para hiking o ecoturismo responsable. Tus fondos se pueden concentrar en tours locales y transporte rústico; no necesitas lujos para disfrutar asombrosos paisajes y rios."
    },
    'relax': {
        titulo: "Maldivas o Tulum, MX",
        desc: "Tu mente merece un descanso reparador. Aguas celestes y arena blanca. El 60% de tu presupuesto se puede destinar a un resort All-Inclusive de lujo, limitando tus costos en extras, pues el mismo hotel proveerá tu paz mental pura."
    }
};

/** @function recomendarDestino procesa la entrada del panel de intereses del constructor */
function recomendarDestino(interesStr, btnElement) {
    // Resetear colores de todos los botones
    const botones = document.querySelectorAll('.btn-interes');
    if(botones.length > 0) {
        botones.forEach(b => {
            b.classList.remove('btn-dark', 'text-white');
            b.classList.add('btn-outline-dark');
        });
        
        // Colorear el presionado
        if(btnElement) {
            btnElement.classList.remove('btn-outline-dark');
            btnElement.classList.add('btn-dark', 'text-white');
        }
    }

    const rec = recomendacionesPorInteres[interesStr];
    if(!rec) return;

    const panelObj = document.getElementById('panelDestinoRecomendado');
    if(panelObj) {
        panelObj.classList.remove('d-none');
        document.getElementById('recomendacionTitulo').innerText = rec.titulo;
        document.getElementById('recomendacionDesc').innerText = rec.desc;
    }
}

/* =========================================================================
   MÓDULO: EXPORTAR PDF DEL CONSTRUCTOR
========================================================================= */

/** @function exportarReportePDF recopila el estado del constructor y genera un PDF profesional */
function exportarReportePDF() {
    const btnPDF = document.getElementById('btnExportarPDF');
    if (btnPDF) {
        btnPDF.disabled = true;
        btnPDF.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Generando...';
    }

    // 1. Fecha actual
    const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const elFecha = document.getElementById('pdfFecha');
    if (elFecha) elFecha.innerText = `Generado: ${fecha}`;

    // 2. Lista mochila
    const items = [
        { id: 'checkPasaporte', label: '🛂 Pasaporte Mexicano 10 Años', valor: '$3,940 MXN' },
        { id: 'checkSeguro',    label: '🏥 Seguro Médico de Viaje',      valor: '$1,200 MXN' },
        { id: 'checkVisa',     label: '🗂️ Trámite de Visa',              valor: '$3,400 MXN' },
        { id: 'checkMaleta',   label: '🧳 Maleta Documentada Extra',     valor: '$900 MXN' },
    ];

    const seleccionados = items.filter(it => {
        const el = document.getElementById(it.id);
        return el && el.checked;
    });

    const listaPDF = document.getElementById('pdfListaMochila');
    if (listaPDF) {
        if (seleccionados.length === 0) {
            listaPDF.innerHTML = '<p style="color: #888; font-style: italic;">Ningún preparativo seleccionado.</p>';
        } else {
            listaPDF.innerHTML = seleccionados.map(it =>
                `<div style="display:flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 6px 0;">
                    <span>${it.label}</span>
                    <strong>${it.valor}</strong>
                </div>`
            ).join('');
        }
    }

    // 3. Total mochila
    const totalText = document.getElementById('totalMochila');
    const pdfTotalEl = document.getElementById('pdfTotal');
    if (pdfTotalEl && totalText) pdfTotalEl.innerText = totalText.innerText;

    // 4. Destino recomendado
    const tituloEl = document.getElementById('recomendacionTitulo');
    const descEl   = document.getElementById('recomendacionDesc');
    const pdfDest  = document.getElementById('pdfDestino');
    const pdfDescEl = document.getElementById('pdfDestinoDesc');
    if (pdfDest && tituloEl) pdfDest.innerText = tituloEl.innerText !== '—' ? tituloEl.innerText : 'Sin selección de interés.';
    if (pdfDescEl && descEl) pdfDescEl.innerText = descEl.innerText !== '—' ? descEl.innerText : '';

    // 5. Mostrar temporalmente el div oculto y generar
    const reporteEl = document.getElementById('reportePDF');
    if (!reporteEl) { console.error('No se encontró #reportePDF'); return; }

    // Sacarlo del escondite momentaneamente para captura
    const originalStyle = reporteEl.style.cssText;
    reporteEl.style.position = 'fixed';
    reporteEl.style.left = '-9999px';
    reporteEl.style.top = '0';

    const opciones = {
        margin:       [10, 10, 10, 10],
        filename:     `TravelWishly_Reporte_${new Date().getFullYear()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opciones).from(reporteEl).save().then(() => {
        // Restaurar estado original
        reporteEl.style.cssText = originalStyle;
        if (btnPDF) {
            btnPDF.disabled = false;
            btnPDF.innerHTML = '<i class="bi bi-file-earmark-pdf-fill me-2"></i>Exportar PDF';
        }
    }).catch(err => {
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

/** @function convertCurrency Realiza la conversión entre las divisas seleccionadas en el dashboard */
async function convertCurrency() {
    const amount = parseFloat(document.getElementById('currencyAmount').value);
    const from = document.getElementById('fromCurrency').value;
    const to = document.getElementById('toCurrency').value;
    const resultEl = document.getElementById('currencyResult');

    if (isNaN(amount) || amount <= 0) {
        resultEl.innerText = "--";
        return;
    }

    resultEl.innerText = "⏳...";

    try {
        const response = await fetch(`https://open.er-api.com/v6/latest/${from}`);
        const data = await response.json();
        
        if (data && data.rates && data.rates[to]) {
            const converted = amount * data.rates[to];
            resultEl.innerText = `${converted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${to}`;
        } else {
            resultEl.innerText = "Error";
        }
    } catch (error) {
        console.error("Error en conversión:", error);
        resultEl.innerText = "Offline";
    }
}

/** @function actualizarClimaGlobal Simula y refresca datos de clima para destinos populares */
function actualizarClimaGlobal() {
    const cities = [
        { id: 'weather-tokyo', base: 12, icon: 'bi-cloud-sun' },
        { id: 'weather-ny', base: 5, icon: 'bi-snow' },
        { id: 'weather-paris', base: 10, icon: 'bi-cloud-rain' },
        { id: 'weather-cancun', base: 28, icon: 'bi-brightness-high' }
    ];

    cities.forEach(city => {
        const el = document.getElementById(city.id);
        if (el) {
            const temp = (city.base + (Math.random() * 4 - 2)).toFixed(1);
            el.innerHTML = `${temp}°C <i class="bi ${city.icon}"></i>`;
        }
    });
}

/* =========================================================================
   MÓDULO: LÍNEA DE TIEMPO INTERACTIVA (CONSTRUCTOR)
======================================================================== */

let travelTimeline = [];

/** @function agregarEventoTimeline Permite añadir pasos al itinerario visual */
function agregarEventoTimeline() {
    const input = document.getElementById('timelineInput');
    const container = document.getElementById('timelineContainer');
    
    if (!input || !container || input.value.trim() === "") return;

    const eventText = input.value.trim();
    travelTimeline.push(eventText);
    input.value = "";

    renderizarTimeline();
}

/** @function renderizarTimeline Dibuja los nodos del itinerario */
function renderizarTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    if (travelTimeline.length === 0) {
        container.innerHTML = '<p class="text-muted fw-bold text-center py-4">Aún no has definido pasos para tu ruta.</p>';
        return;
    }

    container.innerHTML = travelTimeline.map((step, index) => `
        <div class="d-flex align-items-start mb-4 position-relative">
            <div class="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" 
                 style="width: 32px; height: 32px; min-width: 32px; z-index: 2; border: 2px solid #000;">
                ${index + 1}
            </div>
            <div class="ms-3 p-3 border border-dark border-3 bg-white w-100 hover-lift" style="box-shadow: 4px 4px 0 0 #000;">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-black text-uppercase small" style="letter-spacing: 0.5px;">${step}</span>
                    <button class="btn btn-sm btn-outline-danger border-0 rounded-0" onclick="eliminarEventoTimeline(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            ${index < travelTimeline.length - 1 ? '<div class="position-absolute bg-dark" style="width: 3px; height: 100%; left: 14.5px; top: 32px; z-index: 1;"></div>' : ''}
        </div>
    `).join('');
}


/** @function eliminarEventoTimeline */
function eliminarEventoTimeline(index) {
    travelTimeline.splice(index, 1);
    renderizarTimeline();
}

// Inicializadores Extra para Dashboard
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('weather-tokyo')) {
        actualizarClimaGlobal();
        // Simulación de actualización de clima cada 15 segundos
        setInterval(actualizarClimaGlobal, 15000);
    }
});
