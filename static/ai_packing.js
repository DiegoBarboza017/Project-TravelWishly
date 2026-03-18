/**
 * TravelWishly — AI Route Generator + Smart Packing List
 * Módulo de experiencia inmersiva para el Constructor de Viajes
 */

/* =========================================================================
   DATOS: AI ROUTE GENERATOR
========================================================================= */
const AI_RUTAS = {
    tokio: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Analizando rutas óptimas para Tokio, Japón..." },
            { tipo: "gray",   texto: "[DATA] Consultando base de datos de vuelos CDMX → NRT..." },
            { tipo: "green",  texto: "[OK]   Vuelo: CDMX (MEX) → Tokio Narita (NRT) — ~14h con escala en LA" },
            { tipo: "gray",   texto: "[DATA] Calculando transporte interno..." },
            { tipo: "green",  texto: "[OK]   Adquirir IC Card (Suica) al llegar — cubre metro y tren completo" },
            { tipo: "yellow", texto: "[DAY1] Llegada a Narita → Hotel en Shinjuku (zona céntrica recomendada)" },
            { tipo: "white",  texto: "[DAY2] Templo Senso-ji en Asakusa → Harajuku → Shibuya Crossing de noche" },
            { tipo: "white",  texto: "[DAY3] Akihabara (tech/anime) → Mercado Tsukiji → Odaiba" },
            { tipo: "white",  texto: "[DAY4] Excursión a Nikko UNESCO — tren desde Asakusa, ~2h" },
            { tipo: "white",  texto: "[DAY5] Tokyo DisneySea o Teamlab Planets (reservar 3 semanas antes)" },
            { tipo: "white",  texto: "[DAY6] Día libre en Shinjuku → Kabukicho de noche con precaución" },
            { tipo: "white",  texto: "[DAY7] Shinkansen a Kyoto → Fushimi Inari → Gion District" },
            { tipo: "white",  texto: "[DAY8] Osaka → Dotonbori street food → Osaka Castle" },
            { tipo: "white",  texto: "[DAY9] Regreso a Tokio → Compras en Shibuya 109" },
            { tipo: "white",  texto: "[DAY10] Salida desde NRT → MEX" },
            { tipo: "orange", texto: "[WARN] Llevar Yenes en efectivo — muchos negocios no aceptan tarjeta" },
            { tipo: "orange", texto: "[WARN] Evita hablar en voz alta en transporte público (norma cultural)" },
            { tipo: "green",  texto: "[DONE] Ruta generada correctamente. Costo estimado: $35,000–$55,000 MXN" },
        ]
    },
    paris: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Analizando rutas óptimas para París, Francia..." },
            { tipo: "gray",   texto: "[DATA] Consultando vuelos CDMX → CDG..." },
            { tipo: "green",  texto: "[OK]   Vuelo: CDMX → París CDG — ~12h directos (Air France)" },
            { tipo: "green",  texto: "[OK]   Paris Visite Pass (Metro + RER) — movilidad total" },
            { tipo: "yellow", texto: "[DAY1] Llegada CDG → Hotel en Marais o Saint-Germain-des-Prés" },
            { tipo: "white",  texto: "[DAY2] Torre Eiffel (reservar online) → Champs-Élysées → Arc de Triomphe" },
            { tipo: "white",  texto: "[DAY3] Louvre Museum (mínimo 3h) → Jardín de las Tullerías" },
            { tipo: "white",  texto: "[DAY4] Montmartre → Sacré-Cœur → Moulin Rouge de noche" },
            { tipo: "white",  texto: "[DAY5] Versalles todo el día — tren RER C desde Champ de Mars" },
            { tipo: "white",  texto: "[DAY6] Musée d'Orsay → Seine boat tour → Le Marais artístico" },
            { tipo: "white",  texto: "[DAY7] Gastronomía: mercados, macarons Pierre Hermé, wine tasting" },
            { tipo: "white",  texto: "[DAY8] Compras Passeig de Gràcia → Aeropuerto CDG → Regreso" },
            { tipo: "orange", texto: "[WARN] Alta incidencia de carterismo en Montmartre y Torre Eiffel" },
            { tipo: "orange", texto: "[WARN] Restaurantes turísticos cobran 3x — busca 'boulangeries' locales" },
            { tipo: "green",  texto: "[DONE] Ruta generada. Costo estimado: $45,000–$70,000 MXN" },
        ]
    },
    cancun: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Analizando rutas para Cancún, México..." },
            { tipo: "green",  texto: "[OK]   Vuelo: CDMX (MEX) → Cancún (CUN) — ~2.5h directos" },
            { tipo: "green",  texto: "[OK]   Transporte: bus R1/R2 desde aeropuerto ($0.60 USD) o transfer grupal" },
            { tipo: "yellow", texto: "[DAY1] Llegada → Check-in resort All-Inclusive → Playa Delfines" },
            { tipo: "white",  texto: "[DAY2] Chichén Itzá tour (salida 7am) → Cenote Ik Kil" },
            { tipo: "white",  texto: "[DAY3] Isla Mujeres en catamarán → snorkel en arrecife de coral" },
            { tipo: "white",  texto: "[DAY4] Tulum ruins + Cenote Gran Cenote + Playa Paraíso" },
            { tipo: "white",  texto: "[DAY5] Xcaret Park (con 15% descuento online)" },
            { tipo: "white",  texto: "[DAY6] Día libre Zona Hotelera → Mercado 28 souvenirs" },
            { tipo: "white",  texto: "[DAY7] Checkout → Aeropuerto → Regreso CDMX" },
            { tipo: "orange", texto: "[WARN] Usar protector solar BIODEGRADABLE (obligatorio en cenotes)" },
            { tipo: "orange", texto: "[WARN] Temporada de huracanes: jun–nov. Mejor época: dic–abril" },
            { tipo: "green",  texto: "[DONE] Ruta generada. All-Inclusive estimado: $8,000–$18,000 MXN" },
        ]
    },
    new_york: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Analizando rutas para Nueva York, EE.UU..." },
            { tipo: "orange", texto: "[WARN] Visa B1/B2 requerida — gestionarla con 3+ meses de anticipación" },
            { tipo: "green",  texto: "[OK]   Vuelo: CDMX (MEX) → JFK — ~5h directos (Aeroméxico / United)" },
            { tipo: "green",  texto: "[OK]   Metro: MetroCard semanal $34 USD cubre toda la ciudad" },
            { tipo: "yellow", texto: "[DAY1] Llegada JFK → Hotel en Midtown Manhattan o Brooklyn" },
            { tipo: "white",  texto: "[DAY2] Times Square → Central Park → The Metropolitan Museum" },
            { tipo: "white",  texto: "[DAY3] Estatua de la Libertad + Ellis Island (ferry con reserva)" },
            { tipo: "white",  texto: "[DAY4] Brooklyn Bridge → DUMBO → High Line → Chelsea Market" },
            { tipo: "white",  texto: "[DAY5] One World Observatory → Wall St → 9/11 Memorial" },
            { tipo: "white",  texto: "[DAY6] Coney Island → Brooklyn Beach → Little Italy" },
            { tipo: "white",  texto: "[DAY7] MOMA → 5th Avenue → Espectáculo de Broadway ($50–200 USD)" },
            { tipo: "white",  texto: "[DAY8] Woodbury Commons outlets → Aeropuerto JFK → Regreso" },
            { tipo: "orange", texto: "[WARN] Propinas obligatorias: 18–22% en restaurantes" },
            { tipo: "green",  texto: "[DONE] Ruta generada. Costo estimado: $40,000–$65,000 MXN" },
        ]
    },
    ciudad_de_mexico: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Generando ruta premium para Ciudad de México..." },
            { tipo: "green",  texto: "[OK]   Sin vuelo requerido. Metro CDMX: $5 MXN por viaje" },
            { tipo: "yellow", texto: "[DAY1] Zócalo → Catedral Metropolitana → Palacio Nacional (murales Diego Rivera)" },
            { tipo: "white",  texto: "[DAY2] Teotihuacán — salida 7am, Pirámides del Sol y la Luna" },
            { tipo: "white",  texto: "[DAY3] Coyoacán → Casa de Frida Kahlo → Mercado de Artesanías" },
            { tipo: "white",  texto: "[DAY4] Polanco → Museo Nacional de Antropología → Bosque Chapultepec" },
            { tipo: "white",  texto: "[DAY5] Xochimilco en trajinera → Mercado Jamaica → Roma Norte gastronómica" },
            { tipo: "orange", texto: "[WARN] No usar celular visible en la vía pública" },
            { tipo: "orange", texto: "[WARN] Usar Uber/DiDi — evitar taxis de calle" },
            { tipo: "green",  texto: "[DONE] Ruta local generada. Costo estimado: $2,500–$6,000 MXN" },
        ]
    },
    machu_picchu: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Calculando ruta de alta montaña para Machu Picchu..." },
            { tipo: "gray",   texto: "[DATA] Altitud destino: 2,430 msnm. Cusco: 3,400 msnm. Iniciando protocolo..." },
            { tipo: "orange", texto: "[WARN] Obligatorio: 2 noches en Cusco para aclimatación antes de subir" },
            { tipo: "green",  texto: "[OK]   Vuelo: CDMX → Lima (LIM) → Cusco (CUZ) con escala en Lima" },
            { tipo: "yellow", texto: "[DAY1-2] Cusco: Aclimatación → Plaza de Armas → Qorikancha Temple" },
            { tipo: "white",  texto: "[DAY3] Valle Sagrado: Pisac ruins + mercado artesanal + Ollantaytambo" },
            { tipo: "white",  texto: "[DAY4] Tren PeruRail: Cusco → Aguas Calientes (pueblo base MP)" },
            { tipo: "white",  texto: "[DAY5] Machu Picchu — entrada obligatoria a las 6am (RESERVAR 3+ MESES antes)" },
            { tipo: "white",  texto: "[DAY6] Huayna Picchu opcional — solo 400 personas/día (ticket separado)" },
            { tipo: "white",  texto: "[DAY7] Regreso a Cusco → mercado San Pedro → Pisco Sour experience" },
            { tipo: "white",  texto: "[DAY8] Vuelo Cusco → Lima → última noche en Miraflores" },
            { tipo: "white",  texto: "[DAY9] Lima → CDMX. Comprar ají y pisco en aeropuerto" },
            { tipo: "orange", texto: "[WARN] Entradas a Machu Picchu se agotan — reservar en machupicchu.gob.pe" },
            { tipo: "green",  texto: "[DONE] Ruta andina generada. Costo estimado: $38,000–$58,000 MXN" },
        ]
    },
    dubai: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Analizando ruta de lujo para Dubái, EAU..." },
            { tipo: "green",  texto: "[OK]   Visa: Mexicanos la reciben GRATIS al aterrizar (visa on arrival 30 días)" },
            { tipo: "green",  texto: "[OK]   Vuelo: CDMX → Dubái (DXB) — escala en Madrid o Frankfurt (~18h)" },
            { tipo: "yellow", texto: "[DAY1] Llegada DXB → Hotel en Downtown Dubai o Dubai Marina" },
            { tipo: "white",  texto: "[DAY2] Burj Khalifa (At the Top) → Dubai Mall → Fountain Show" },
            { tipo: "white",  texto: "[DAY3] Desert Safari → duna bashing → cena beduina bajo las estrellas" },
            { tipo: "white",  texto: "[DAY4] Palm Jumeirah → Atlantis The Palm → Aquaventure Waterpark" },
            { tipo: "white",  texto: "[DAY5] Deira Souks (Gold + Spice Souk) → Creek Abra boat → Old Dubai" },
            { tipo: "white",  texto: "[DAY6] Burj Al Arab → JBR Beach → Dubai Frame" },
            { tipo: "white",  texto: "[DAY7] Mall of the Emirates → Ski Dubai → Aeropuerto DXB → CDMX" },
            { tipo: "orange", texto: "[WARN] Vestimenta cubierta en zonas públicas y mezquitas" },
            { tipo: "orange", texto: "[WARN] Evitar verano (jun–sep): temperaturas superan 45°C. Mejor époa: nov–mar" },
            { tipo: "green",  texto: "[DONE] Ruta de lujo generada. Costo estimado: $50,000–$90,000 MXN" },
        ]
    },
    barcelona: {
        pasos: [
            { tipo: "cyan",   texto: "[INIT] Analizando ruta cultural para Barcelona, España..." },
            { tipo: "green",  texto: "[OK]   Vuelo: CDMX → Barcelona (BCN) — directo o vía Madrid (~11h)" },
            { tipo: "green",  texto: "[OK]   Transporte: T-Casual 10 viajes (€12) cubre metro, bus y cercanías" },
            { tipo: "yellow", texto: "[DAY1] Llegada BCN → Hotel en Gràcia, Eixample o El Born" },
            { tipo: "white",  texto: "[DAY2] Sagrada Família (reserva skip-the-line obligatoria) → Casa Batlló" },
            { tipo: "white",  texto: "[DAY3] Barrio Gótico → Las Ramblas → Mercado de La Boqueria" },
            { tipo: "white",  texto: "[DAY4] Park Güell → Bunkers del Carmel al atardecer" },
            { tipo: "white",  texto: "[DAY5] Playa Barceloneta → Paella en El Born → Palau de la Música" },
            { tipo: "white",  texto: "[DAY6] Camp Nou Tour (FCB) → Poblenou → ruta modernista" },
            { tipo: "white",  texto: "[DAY7] Excursión Montserrat → monasterio → vistas panorámicas" },
            { tipo: "white",  texto: "[DAY8] Compras Passeig de Gràcia → Aeropuerto BCN → Regreso CDMX" },
            { tipo: "orange", texto: "[WARN] Barrio Gótico y Las Ramblas: alta incidencia de carterismo — mochila delantera" },
            { tipo: "green",  texto: "[DONE] Ruta cultural generada. Costo estimado: $35,000–$60,000 MXN" },
        ]
    }
};

let aiAnimacionActiva = false;

/** Lanza la animación de terminal typewriter */
async function iniciarGeneradorRuta() {
    const sel = document.getElementById('aiDestinoSelect');
    if (!sel || !sel.value) { alert('⚠️ Selecciona un destino primero.'); return; }
    if (aiAnimacionActiva) return;

    const data = AI_RUTAS[sel.value];
    if (!data) return;

    aiAnimacionActiva = true;
    const empty  = document.getElementById('aiEmptyState');
    const output = document.getElementById('aiTerminalOutput');
    empty.classList.add('d-none');
    output.classList.remove('d-none');
    output.innerHTML = '';

    for (const paso of data.pasos) {
        await escribirLineaTerminal(output, paso.texto, paso.tipo);
        await esperar(160);
    }
    aiAnimacionActiva = false;
}

/** Escribe una línea carácter a carácter (typewriter) */
function escribirLineaTerminal(container, texto, tipo) {
    return new Promise(resolve => {
        const div = document.createElement('div');
        div.className = 't-' + tipo;
        div.style.cssText = 'min-height:1.6em;';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        let idx = 0;
        const timer = setInterval(() => {
            div.textContent += texto[idx];
            idx++;
            container.scrollTop = container.scrollHeight;
            if (idx >= texto.length) { clearInterval(timer); resolve(); }
        }, 16);
    });
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Resetea el terminal */
function limpiarGeneradorRuta() {
    aiAnimacionActiva = false;
    const empty  = document.getElementById('aiEmptyState');
    const output = document.getElementById('aiTerminalOutput');
    if (empty)  empty.classList.remove('d-none');
    if (output) { output.classList.add('d-none'); output.innerHTML = ''; }
    const sel = document.getElementById('aiDestinoSelect');
    if (sel) sel.value = '';
}

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

/** Renderiza el Smart Packing List */
function cargarPackingList() {
    const sel = document.getElementById('packingDestinoSelect');
    if (!sel || !sel.value) return;
    const data = PACKING_DATA[sel.value];
    if (!data) return;

    const badge = document.getElementById('packingBadge');
    if (badge) badge.textContent = data.clima;

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
