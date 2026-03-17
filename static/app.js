/**
 * Lógica Front-End para Interfaz Interactiva Web (TravelWishly)
 * Framework agnóstico - Vanilla Javascript moderno
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("✈️ TravelWishly Core JavaScript Inicializado con Exito");
});

/* =========================================================================
   MÓDULO: CALCULADORA Y PANEL DE ESTADÍSTICAS
========================================================================= */
let donutGráficoInstancia = null; // Almacenamiento de Chart global.

/** @function calcularDistribucion ejecuta reglas de negocio prespuestarias */
function calcularDistribucion() {
    const inputIngresos = document.getElementById('ingresosMensuales');
    const inputAhorros = document.getElementById('capacidadAhorro');
    const inputViaje = document.getElementById('viajeObjetivo');

    if(!inputIngresos || !inputAhorros || !inputViaje) return; // Fail fast

    const ingreso = parseFloat(inputIngresos.value);
    const ahorroPorcentaje = parseFloat(inputAhorros.value);
    const capitalViajeEst = parseFloat(inputViaje.value);

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
    // Ahorro monetario en base a la capacidad porcentual elegida
    const capacidadMonetariaAhorro = ingreso * (ahorroPorcentaje / 100);
    // Calcular meses brutos y redondear
    const mesesParaAhorrarAprox = Math.ceil(capitalViajeEst / capacidadMonetariaAhorro);

    // -- Modelo Económico de TravelWishly para Desgloses Típicos Internacionales Multi-Categoría
    // Valores ponderados en base a promedios standard
    const distribucion = {
        hospedaje: capitalViajeEst * 0.35,  // 35%
        vuelos: capitalViajeEst * 0.30,     // 30%
        comida: capitalViajeEst * 0.20,     // 20%
        actividades: capitalViajeEst * 0.15 // 15%
    };

    renderizarPanelGraficas(distribucion);
    actualizarTextosDeInsights(capacidadMonetariaAhorro, mesesParaAhorrarAprox);
}

/** 
 * Actualiza el Canvas Chart.js del Frontend con transiciones animadas 
 * @param {Object} distr - Objeto con valores numéricos calculados.
 */
function renderizarPanelGraficas(distr) {
    const canvas = document.getElementById('budgetGraphic');
    const placeholder = document.getElementById('chartPlaceholder');
    
    // Switch de UI
    placeholder.classList.add('d-none');
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
                'Hospedaje Booking (35%)', 
                'Transporte Terrestre y Vuelos (30%)', 
                'Presupuesto Alimentación Culinaria (20%)', 
                'Actividades de Guía Local (15%)'
            ],
            datasets: [{
                label: 'Cifra Asignada (USD $)',
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
                        label: function(ctx) { return ' $' + ctx.parsed.toFixed(2); }
                    }
                }
            }
        }
    });
}

function actualizarTextosDeInsights(monedaAhorradaXMes, cantMeses) {
    const contenedor = document.getElementById('calculoInsights');
    const textoInfo = document.getElementById('mesesAhorroTexto');
    
    contenedor.classList.remove('d-none');
    
    // Logica plurar/singular simple
    let mesPalabra = cantMeses === 1 ? "mes" : "meses";
    textoInfo.innerHTML = `Basado en tu situación, guardando <strong>$${monedaAhorradaXMes.toFixed(2)} USD</strong> mensuales, necesitarás aproximadamente <strong>${cantMeses} ${mesPalabra}</strong> de disciplina constante para consolidar el fondo necesario de tu aventura asegurada.`;
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
