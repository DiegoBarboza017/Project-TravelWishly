/**
 * TravelWishly — AI Route Generator + Smart Packing List
 * Módulo de experiencia inmersiva para el Constructor de Viajes
 */

/* Fila de Generador de Rutas Obsoleto Eliminado */

/* =========================================================================
   DATOS: SMART PACKING LIST
========================================================================= */
const PACKING_DATA = {
    tokio: {
        clima: "Templado / Frío",
        categorias: [
            { nombre: "🧥 Ropa", icono: "bi-tags-fill", items: [
                "Abrigo impermeable ligero", "2 suéteres / polares",
                "Pantalones cómodos (4)", "Ropa interior térmica",
                "Calcetines gruesos (5 pares)", "Zapatos cómodos para caminar",
                "1 outfit formal (Izakaya premium)"
            ]},
            { nombre: "💊 Salud", icono: "bi-heart-pulse-fill", items: [
                "Seguro médico internacional", "Mascarilla desechable / reutilizable",
                "Medicamentos personales con receta", "Pastillas para el jetlag",
                "Repelente mosquitos (verano)"
            ]},
            { nombre: "📱 Tech & Docs", icono: "bi-phone-fill", items: [
                "Pasaporte (6+ meses vigencia)", "Adaptador tipo A (Japón: tipo A/B)",
                "Pocket WiFi o eSIM japonesa", "PowerBank 20,000 mAh",
                "Google Translate offline (Japonés)", "Google Maps offline Tokio"
            ]},
            { nombre: "💴 Finanzas", icono: "bi-cash-coin", items: [
                "Yenes en efectivo (¥30,000 mínimo)", "Tarjeta de crédito sin comisión internacional",
                "Suica / IC Card (comprar en aeropuerto)", "Copia impresa de reservas de hotel"
            ]}
        ]
    },
    cancun: {
        clima: "Tropical / Calor Intenso",
        categorias: [
            { nombre: "👙 Ropa de Playa", icono: "bi-water", items: [
                "Traje de baño (3+)", "Shorts y camisetas ligeras (5)",
                "Cover-up / pareo", "Sandalias de agua",
                "Chanclas de playa", "Sombrero de ala ancha"
            ]},
            { nombre: "☀️ Protección UV", icono: "bi-brightness-high-fill", items: [
                "Protector solar BIODEGRADABLE FPS 50+", "Camisa manga larga anti-UV",
                "Gafas de sol polarizadas", "Aloe vera / after-sun"
            ]},
            { nombre: "🤿 Actividades", icono: "bi-binoculars-fill", items: [
                "Snorkel propio (opcional)", "Funda impermeable para celular",
                "Zapatos acuáticos para cenotes", "Mochila de día (10–15L)"
            ]},
            { nombre: "📄 Documentos", icono: "bi-file-earmark-text-fill", items: [
                "INE o pasaporte vigente", "Reservas de hotel impresas",
                "Seguro de viaje (incl. actividades acuáticas)", "Efectivo en pesos MXN"
            ]}
        ]
    },
    paris: {
        clima: "Templado / Lluvia Variable",
        categorias: [
            { nombre: "👗 Estilo Europeo", icono: "bi-suit-heart-fill", items: [
                "Trench coat o abrigo elegante", "Camisas o blusas (4–5)",
                "Jeans oscuros (2)", "Zapatos de vestir cómodos (caminarás 15km/día)",
                "Bufanda", "1 outfit de noche"
            ]},
            { nombre: "🌧️ Lluvia", icono: "bi-cloud-rain-fill", items: [
                "Paraguas compacto", "Impermeable ligero",
                "Capas (mañanas frías, tardes cálidas)"
            ]},
            { nombre: "📸 Turismo", icono: "bi-camera-fill", items: [
                "Cámara o celular con buena cámara", "Adaptador tipo E/F (Europa)",
                "Paris Museum Pass (ahorra +30%)", "Mapa metro offline", "Riñonera anti-robo"
            ]},
            { nombre: "🥐 Gastronomía", icono: "bi-cup-hot-fill", items: [
                "App TheFork para reservas", "Lista de boulangeries recomendadas",
                "Efectivo EUR (boulangeries sin tarjeta)"
            ]}
        ]
    },
    new_york: {
        clima: "Continental / Muy Variable",
        categorias: [
            { nombre: "🧤 Ropa por Temporada", icono: "bi-thermometer-half", items: [
                "Abrigo de invierno (posible -10°C)", "Capa intermedia (fleece / suéter)",
                "Camisetas base layering", "Botas cómodas impermeables",
                "Guantes y gorro (invierno)", "Ropa de lluvia"
            ]},
            { nombre: "🗽 Documentos USA", icono: "bi-file-earmark-text-fill", items: [
                "Pasaporte + Visa B1/B2 USA", "Copia digital y física de visa",
                "Seguro de viaje (USA: sistema de salud muy caro)", "ESTA si eres europeo/canadiense"
            ]},
            { nombre: "📱 Tech", icono: "bi-wifi", items: [
                "SIM local USA (T-Mobile prepago)", "Adaptador tipo A/B",
                "App Citymapper NYC", "App NYC Subway offline"
            ]},
            { nombre: "💵 Dinero", icono: "bi-currency-dollar", items: [
                "USD efectivo ($200 mínimo)", "Tarjeta sin comisión FX",
                "Propinas siempre: 18–22%", "Uber para JFK (los taxis son carísimos)"
            ]}
        ]
    },
    ciudad_de_mexico: {
        clima: "Templado con Lluvia Vespertina",
        categorias: [
            { nombre: "👟 Ropa Casual", icono: "bi-bag-fill", items: [
                "Ropa casual cómoda (4–5 días)", "Chamarra ligera (noches frescas)",
                "Tenis para caminar", "Paraguas plegable (llueve las tardes)"
            ]},
            { nombre: "🏛️ Cultura", icono: "bi-bank2", items: [
                "Credencial INAPAM o estudiante (descuentos museos)",
                "Lista de museos gratuitos: MUNAL, Bellas Artes",
                "Cámara o celular cargado"
            ]},
            { nombre: "🌮 Gastronomía", icono: "bi-cup-straw", items: [
                "Antiácidos / pastillas digestivas", "Solo agua embotellada",
                "App Google Maps + Yelp para taquerías", "Efectivo (mercados no aceptan tarjeta)"
            ]},
            { nombre: "🔐 Seguridad", icono: "bi-shield-lock-fill", items: [
                "No usar celular visible en la calle", "Dividir efectivo en diferentes bolsillos",
                "Usar Uber o DiDi", "911 guardado en teléfono"
            ]}
        ]
    },
    machu_picchu: {
        clima: "Tropical Andino / Frío Nocturno",
        categorias: [
            { nombre: "🥾 Trekking", icono: "bi-map-fill", items: [
                "Botas impermeables de trekking (obligatorio)", "Calcetines anti-ampolla (3+ pares)",
                "Bastones de senderismo", "Mochila 30–40L con cover de lluvia",
                "Polar + cortaviento impermeable"
            ]},
            { nombre: "🏔️ Alta Altitud", icono: "bi-activity", items: [
                "Diamox recetado (para el soroche/mal de altura)", "Pastillas de mate de coca",
                "Hidratación: mínimo 3L de agua al día", "Evita el alcohol los primeros 2 días en Cusco"
            ]},
            { nombre: "📸 Docs & Tickets", icono: "bi-ticket-detailed-fill", items: [
                "Pasaporte (requerido en la entrada a MP)", "Ticket impreso desde machupicchu.gob.pe",
                "Reserva tren PeruRail confirmada", "Maps.me offline (Perú)"
            ]},
            { nombre: "🌱 Ecología", icono: "bi-tree-fill", items: [
                "Solo protector solar BIODEGRADABLE", "Bolsa reutilizable (prohibido plástico en el sitio)",
                "No llevar comida al área arqueológica"
            ]}
        ]
    },
    dubai: {
        clima: "Desértico / Calor Extremo",
        categorias: [
            { nombre: "🌡️ Clima Extremo", icono: "bi-thermometer-sun", items: [
                "Ropa LIGERA pero que cubra hombros y rodillas", "FPS 70+ protector solar",
                "Botella de agua reutilizable (hidratación constante)",
                "Gafas de sol premium anti-UV"
            ]},
            { nombre: "🕌 Cultura & Religión", icono: "bi-buildings", items: [
                "Pañuelo para cubrir cabeza en mezquitas", "Ropa modesta en zonas públicas",
                "No mostrar afecto en público (norma legal)"
            ]},
            { nombre: "💎 Lujo & Actividades", icono: "bi-star-fill", items: [
                "Outfit formal para restaurantes de lujo", "Traje de baño para pool / beach club",
                "AED en efectivo para propinas", "App Careem (Uber local)"
            ]},
            { nombre: "📋 Docs UAE", icono: "bi-passport", items: [
                "Pasaporte vigente (visa gratis on arrival para México)",
                "Seguro de viaje internacional", "Tarjeta de crédito (Dubai acepta tarjeta casi todo)"
            ]}
        ]
    },
    barcelona: {
        clima: "Mediterráneo / Cálido",
        categorias: [
            { nombre: "👕 Ropa Mediterránea", icono: "bi-brightness-high", items: [
                "Ropa ligera (camisetas, shorts)", "Un outfit semi-formal para restaurantes",
                "Sandalias cómodas de caminar", "Calzado cerrado (Gaudí requiere mucho andar)",
                "Chaqueta ligera para las noches"
            ]},
            { nombre: "🏖️ Playa", icono: "bi-brightness-high-fill", items: [
                "Traje de baño", "FPS 50+ protector solar",
                "Toalla de playa compacta", "Funda impermeable para el celular"
            ]},
            { nombre: "🔒 Anti-Robo", icono: "bi-shield-fill", items: [
                "Cinturón de dinero oculto", "Mochila con cierre de combinación",
                "Fotocopia de pasaporte (no llevar original al salir)",
                "Riñonera delantera — Las Ramblas: zona de alto riesgo"
            ]},
            { nombre: "🎭 Cultura Gaudí", icono: "bi-music-note-beamed", items: [
                "App offline sobre Gaudí y Modernismo", "Reservas impresas: Sagrada Família + Park Güell",
                "Efectivo EUR para mercados", "App TMB Barcelona (metro)"
            ]}
        ]
    }
};

/** Renderiza el Smart Packing List adaptado Semánticamente */
window.cargarPackingList = function(destinoRawStr = "") {
    let destinoStr = "";
    
    if (typeof destinoRawStr === 'string' && destinoRawStr.trim() !== "") {
        destinoStr = destinoRawStr.toLowerCase();
    } else {
        const d = document.getElementById('rutaDestino');
        if (d && d.value) destinoStr = d.value.toLowerCase();
    }

    if (!destinoStr) return;

    // --- Heurística Semántica de Asignación de Maletas ---
    let tk = "ciudad_de_mexico"; // Default (Urbano templado/casual)
    if (destinoStr.includes("japón") || destinoStr.includes("japon") || destinoStr.includes("corea") || destinoStr.includes("china")) tk = "tokio";
    else if (destinoStr.includes("playa") || destinoStr.includes("cancún") || destinoStr.includes("cancun") || destinoStr.includes("miami") || destinoStr.includes("hawaii") || destinoStr.includes("costa rica") || destinoStr.includes("nicaragua") || destinoStr.includes("panamá") || destinoStr.includes("filipinas") || destinoStr.includes("balí") || destinoStr.includes("bali") || destinoStr.includes("islas")) tk = "cancun";
    else if (destinoStr.includes("francia") || destinoStr.includes("parís") || destinoStr.includes("paris") || destinoStr.includes("londres") || destinoStr.includes("inglaterra") || destinoStr.includes("suiza") || destinoStr.includes("alemania")) tk = "paris";
    else if (destinoStr.includes("nueva york") || destinoStr.includes("canadá") || destinoStr.includes("canada") || destinoStr.includes("estados unidos") || destinoStr.includes("rusia") || destinoStr.includes("nieve")) tk = "new_york";
    else if (destinoStr.includes("andes") || destinoStr.includes("perú") || destinoStr.includes("peru") || destinoStr.includes("machu") || destinoStr.includes("montaña") || destinoStr.includes("bolivia") || destinoStr.includes("chile") || destinoStr.includes("patagonia")) tk = "machu_picchu";
    else if (destinoStr.includes("emiratos") || destinoStr.includes("dubai") || destinoStr.includes("arabia") || destinoStr.includes("egipto") || destinoStr.includes("desierto") || destinoStr.includes("marruecos") || destinoStr.includes("india")) tk = "dubai";
    else if (destinoStr.includes("españa") || destinoStr.includes("barcelona") || destinoStr.includes("mediterráneo") || destinoStr.includes("italia") || destinoStr.includes("grecia") || destinoStr.includes("turquía") || destinoStr.includes("mar")) tk = "barcelona";

    const data = PACKING_DATA[tk];
    if (!data) return;

    const badge = document.getElementById('packingBadge');
    if (badge) badge.innerHTML = `<i class="bi bi-geo-alt-fill text-danger me-1"></i>${destinoRawStr || destinoStr} — ${data.clima}`;

    document.getElementById('packingEmpty').classList.add('d-none');
    document.getElementById('packingGrid').classList.remove('d-none');
    const progressEl = document.getElementById('packingProgress');
    if (progressEl) progressEl.style.display = 'inline';

    const row = document.getElementById('packingCategoriesRow');
    row.innerHTML = '';

    data.categorias.forEach((cat, ci) => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-xl-3';

        const card = document.createElement('div');
        card.className = 'border border-dark border-2 h-100';
        card.style.cssText = 'box-shadow:4px 4px 0 0 #000;';

        const hdr = document.createElement('div');
        hdr.className = 'p-3 border-bottom border-dark border-2 bg-dark text-white fw-bold text-uppercase small d-flex align-items-center gap-2';
        hdr.innerHTML = `<i class="bi ${cat.icono}"></i><span>${cat.nombre}</span>`;
        card.appendChild(hdr);

        const body = document.createElement('div');
        body.className = 'p-3 bg-white';

        cat.items.forEach((item, ii) => {
            const div = document.createElement('div');
            div.className = 'packing-item';
            div.id = `pack_${ci}_${ii}`;
            div.innerHTML = `
                <i class="bi bi-square" style="min-width:18px;font-size:1rem;flex-shrink:0;"></i>
                <span class="packing-label fw-bold" style="font-size:12px;letter-spacing:0.3px;text-transform:uppercase;">${item}</span>
            `;
            div.onclick = () => togglePackingItem(div);
            body.appendChild(div);
        });

        card.appendChild(body);
        col.appendChild(card);
        row.appendChild(col);
    });

    actualizarProgressPacking();
}

/** Marca/desmarca item con animación visual */
function togglePackingItem(el) {
    el.classList.toggle('checked');
    const icon = el.querySelector('i');
    if (el.classList.contains('checked')) {
        icon.className = 'bi bi-check-square-fill';
        icon.style.cssText = 'min-width:18px;font-size:1rem;flex-shrink:0;color:#fff;';
    } else {
        icon.className = 'bi bi-square';
        icon.style.cssText = 'min-width:18px;font-size:1rem;flex-shrink:0;';
    }
    actualizarProgressPacking();
}

/** Recalcula y muestra el progreso global */
function actualizarProgressPacking() {
    const todos   = document.querySelectorAll('.packing-item');
    const checked = document.querySelectorAll('.packing-item.checked');
    const total   = todos.length;
    const done    = checked.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    const el = (id) => document.getElementById(id);
    if (el('packingChecked')) el('packingChecked').textContent = done;
    if (el('packingTotal'))   el('packingTotal').textContent   = total;
    if (el('packingPercent')) el('packingPercent').textContent = percent + '%';
    if (el('packingProgressBar')) el('packingProgressBar').style.width = percent + '%';
    if (el('packingStatusMsg')) {
        if (percent === 0)       el('packingStatusMsg').textContent = 'Marca los items que ya tienes listos.';
        else if (percent < 50)   el('packingStatusMsg').textContent = `¡Vas bien! Llevas ${done} de ${total} items listos.`;
        else if (percent < 100)  el('packingStatusMsg').textContent = `¡Casi listo! Solo te faltan ${total - done} items.`;
        else                     el('packingStatusMsg').textContent = '✅ ¡Packing completado! Estás listo para volar. ✈️';
    }
}

/* =========================================================================
   HOSPEDAJE INTELIGENTE
========================================================================= */
window.toggleHospedajeAI = async function() {
    const isChecked = document.getElementById('checkHospedajeAI').checked;
    const container = document.getElementById('contenedorHospedajeAI');
    const grid = document.getElementById('gridHoteles');
    
    if (!isChecked) {
        container.classList.add('d-none');
        return;
    }
    
    // Obtener destino
    const destinoEl = document.getElementById('rutaDestino');
    const destino = destinoEl ? destinoEl.value.trim() : '';
    if (!destino) {
        alert("Por favor ingresa un destino principal antes de buscar alojamiento.");
        document.getElementById('checkHospedajeAI').checked = false;
        return;
    }
    
    container.classList.remove('d-none');
    grid.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 fw-bold text-uppercase small">Analizando zonas con IA...</p></div>';
    
    try {
        const res = await fetch('/api/suggest_hotels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destino: destino })
        });
        const data = await res.json();
        
        if (data.success && data.hoteles) {
            grid.innerHTML = '';
            data.hoteles.forEach(hotel => {
                const col = document.createElement('div');
                col.className = 'col-12';
                
                // Color por estilo
                let badgeClass = 'bg-secondary';
                if (hotel.estilo.toLowerCase().includes('mochilero')) badgeClass = 'bg-success';
                else if (hotel.estilo.toLowerCase().includes('lujo')) badgeClass = 'bg-dark';
                else badgeClass = 'bg-primary';

                col.innerHTML = `
                    <div class="card rounded-0 border-dark border-2 p-3 bg-white hover-lift" style="box-shadow: 3px 3px 0 0 rgba(0,0,0,0.2); transition: 0.2s;">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="fw-black mb-0" style="font-size: 15px;">${hotel.nombre}</h6>
                            <span class="badge ${badgeClass} rounded-0 border border-dark text-uppercase" style="font-size: 10px;">${hotel.estilo}</span>
                        </div>
                        <p class="small text-muted fw-bold mb-2" style="font-size: 12px; line-height: 1.3;"><i class="bi bi-info-circle-fill me-1 text-dark"></i>${hotel.razon}</p>
                        <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-dark border-1">
                            <span class="fw-black text-dark" style="font-size: 13px;">~ ${hotel.precio}</span>
                            <div class="d-flex gap-2">
                                <a href="https://www.google.com/maps/search/Hotels+in+${encodeURIComponent(hotel.nombre)}+${encodeURIComponent(destino)}" target="_blank" class="btn btn-sm btn-outline-dark rounded-0 fw-bold border-2" style="font-size: 10px;" title="Ver en Google Maps"><i class="bi bi-geo-alt-fill"></i> Mapa</a>
                                <a href="https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destino)}" target="_blank" class="btn btn-sm btn-dark rounded-0 fw-bold border-2" style="font-size: 10px;" title="Ver precios en Booking"><i class="bi bi-calendar-check-fill"></i> Reservar</a>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(col);
            });
        } else {
            grid.innerHTML = `<div class="col-12 text-center py-3"><p class="text-danger fw-bold mb-0">Error: ${data.message}</p></div>`;
        }
    } catch (e) {
        grid.innerHTML = `<div class="col-12 text-center py-3"><p class="text-danger fw-bold mb-0">No se pudo conectar con el servidor.</p></div>`;
    }
};

window.analizarFechaConstructor = async function() {
    const fechaInput = document.getElementById('rutaFecha');
    const destinoInput = document.getElementById('rutaDestino');
    const feedbackBox = document.getElementById('fechaSeasonalityFeedback');
    const iconSpan = document.getElementById('fechaSeasonalityIcon');
    const textSpan = document.getElementById('fechaSeasonalityText');
    
    if(!fechaInput || !destinoInput || !feedbackBox) return;
    
    const fechaVal = fechaInput.value;
    const destinoVal = destinoInput.value;
    
    if(!fechaVal || !destinoVal) {
        feedbackBox.classList.add('d-none');
        return;
    }
    
    // Ajustar mes (getMonth() es 0-index)
    // Usamos utc para que coincida con lo ingresado y evitar desfase de timezone
    const fechaParts = fechaVal.split('-');
    const year = parseInt(fechaParts[0]);
    const month = parseInt(fechaParts[1]) - 1;
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mesStr = meses[month];
    
    feedbackBox.classList.remove('d-none');
    iconSpan.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
    textSpan.innerText = 'Analizando temporada para tu fecha...';
    
    try {
        const res = await fetch('/api/seasonality', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ destino: destinoVal, mes: mesStr })
        });
        const data = await res.json();
        
        if (data.success && data.data) {
            const s = data.data;
            const seasonUpper = s.temporada.toUpperCase();
            
            let color = "text-dark"; // media
            let icon = "bi-calendar-minus-fill text-warning";
            if (seasonUpper.includes("ALTA")) {
                color = "text-danger";
                icon = "bi-calendar-x-fill text-danger";
            }
            if (seasonUpper.includes("BAJA")) {
                color = "text-success";
                icon = "bi-calendar-check-fill text-success";
            }
            
            iconSpan.innerHTML = `<i class="bi ${icon}"></i>`;
            textSpan.innerHTML = `<span class="${color}">TEMPORADA ${seasonUpper}:</span> ${s.razon}`;
            
        } else {
            feedbackBox.classList.add('d-none');
        }
    } catch(e) {
        feedbackBox.classList.add('d-none');
    }
};
