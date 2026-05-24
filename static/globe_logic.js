// globe_logic.js - Interactive 3D Earth - Minimalist Architecture
document.addEventListener('DOMContentLoaded', () => {
    const globeContainer = document.getElementById('globeViz');
    if (!globeContainer) return;

    const loader = document.getElementById('globeLoader');

    // Tabla de costos reales por día (hostel/hotel básico + comidas + transporte local)
    // Estimación realista para viajero independiente: hotel básico/hostel + 3 comidas + metro/bus
    // Actualizado con datos de Numbeo, Backpacker Index y Booking 2024-2025
    const COSTOS_PAIS = {
        // América del Norte
        'United States of America': '$150-220 USD', 'Canada': '$130-190 USD', 'Mexico': '$65-95 USD',
        // Europa Occidental
        'France': '$140-200 USD', 'Germany': '$115-170 USD', 'Spain': '$100-150 USD',
        'Italy': '$115-170 USD', 'United Kingdom': '$160-240 USD', 'Netherlands': '$135-195 USD',
        'Switzerland': '$220-320 USD', 'Portugal': '$90-135 USD', 'Greece': '$85-130 USD',
        'Austria': '$125-185 USD', 'Belgium': '$125-185 USD', 'Sweden': '$160-220 USD',
        'Norway': '$200-290 USD', 'Denmark': '$175-255 USD',
        // Europa del Este
        'Czech Republic': '$70-105 USD', 'Poland': '$65-95 USD', 'Hungary': '$65-100 USD',
        'Romania': '$55-85 USD', 'Bulgaria': '$50-80 USD', 'Croatia': '$85-125 USD',
        'Serbia': '$50-80 USD', 'Slovakia': '$65-95 USD',
        // Asia Oriental
        'Japan': '$120-180 USD', 'South Korea': '$90-140 USD', 'China': '$70-110 USD',
        'Taiwan': '$70-105 USD',
        // Sudeste Asiático
        'Thailand': '$55-85 USD', 'Vietnam': '$45-75 USD', 'Indonesia': '$45-75 USD',
        'Philippines': '$45-70 USD', 'Malaysia': '$50-80 USD', 'Cambodia': '$40-65 USD',
        'Singapore': '$140-210 USD', 'Myanmar': '$40-65 USD',
        // Asia del Sur
        'India': '$40-70 USD', 'Nepal': '$35-60 USD', 'Sri Lanka': '$45-70 USD',
        'Bangladesh': '$35-60 USD', 'Pakistan': '$35-60 USD',
        // Medio Oriente
        'United Arab Emirates': '$160-240 USD', 'Turkey': '$65-100 USD', 'Jordan': '$90-135 USD',
        'Israel': '$130-200 USD', 'Saudi Arabia': '$130-200 USD', 'Qatar': '$150-220 USD',
        'Kuwait': '$120-180 USD', 'Oman': '$100-160 USD',
        // África
        'Morocco': '$55-85 USD', 'Egypt': '$45-80 USD', 'South Africa': '$70-110 USD',
        'Kenya': '$75-115 USD', 'Tanzania': '$80-130 USD', 'Ethiopia': '$45-75 USD',
        'Nigeria': '$55-90 USD', 'Ghana': '$50-85 USD',
        // América del Sur
        'Brazil': '$65-100 USD', 'Argentina': '$55-85 USD', 'Peru': '$50-80 USD',
        'Colombia': '$50-80 USD', 'Chile': '$75-115 USD', 'Ecuador': '$55-85 USD',
        'Bolivia': '$40-65 USD', 'Uruguay': '$75-110 USD', 'Venezuela': '$45-75 USD',
        'Paraguay': '$40-70 USD',
        // América Central y Caribe
        'Costa Rica': '$75-115 USD', 'Panama': '$70-105 USD', 'Cuba': '$55-90 USD',
        'Dominican Republic': '$75-115 USD', 'Guatemala': '$50-80 USD',
        'Honduras': '$50-80 USD', 'Nicaragua': '$45-75 USD', 'El Salvador': '$50-80 USD',
        'Jamaica': '$80-125 USD', 'Belize': '$80-120 USD',
        // Oceanía
        'Australia': '$160-240 USD', 'New Zealand': '$155-235 USD',
        'Fiji': '$90-140 USD', 'Papua New Guinea': '$100-160 USD',
        // Default si no se encuentra el país exacto
        '_default': '$70-110 USD'
    };

    // Generador de datos de país con costos reales
    const generateCountryInfo = (country) => {
        const perfiles = ["Aventura / Mochilero", "Inmersión Cultural", "Lujo / Descanso", "Nómada Digital", "Ecoturismo"];
        const dangerLevels = [
            { level: "Bajo Riesgo", alert: "Zona Segura. Procedimientos estándar de viaje.", color: "#28a745" },
            { level: "Precaución", alert: "Mantener precaución en aglomeraciones nocturnas.", color: "#ffc107" },
            { level: "Riesgo Alto", alert: "Revisar alertas climáticas o sociales estacionales.", color: "#fd7e14" },
            { level: "Planificación Especial", alert: "Requiere preparación avanzada. Consulta con una agencia especializada antes de viajar.", color: "#dc3545" }
        ];

        let charSum = 0;
        for (let i = 0; i < country.length; i++) charSum += country.charCodeAt(i);

        const dangerInfo = dangerLevels[(charSum + 2) % dangerLevels.length];
        const costo = COSTOS_PAIS[country] || COSTOS_PAIS['_default'];

        return {
            cost: costo,
            types: perfiles[(charSum + 1) % perfiles.length],
            alerts: dangerInfo.alert,
            dangerLevel: dangerInfo.level,
            color: dangerInfo.color
        };
    };


    // Inicializar el Globo terráqueo B&W
    const world = Globe()
        (globeContainer)
        .width(globeContainer.clientWidth)
        .height(globeContainer.clientHeight)
        .backgroundColor('#ffffff')
        .showAtmosphere(true)
        .atmosphereColor('#000000')
        .atmosphereAltitude(0.12);

    // Obtener geometría de los países (GeoJSON) - Datos libres
    fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
        .then(res => res.json())
        .then(countries => {
            if (loader) loader.style.display = 'none';

            world.polygonsData(countries.features)
                .polygonCapColor(d => {
                    const info = generateCountryInfo(d.properties.ADMIN);
                    return info.color;
                })
                .polygonSideColor(() => '#ffffff') // Bordes blancos internos
                .polygonStrokeColor(() => '#ffffff')
                .polygonAltitude(0.015)
                .onPolygonHover(hoverD => {
                    world.polygonCapColor(d => {
                        if (d === hoverD) return '#ffffff';
                        const info = generateCountryInfo(d.properties.ADMIN);
                        return info.color;
                    });
                });

            const showCountryDetails = (polygon) => {
                const countryName = polygon.properties.ADMIN;
                const info = generateCountryInfo(countryName);

                const lat = polygon.bbox ? (polygon.bbox[1] + polygon.bbox[3]) / 2 : 0;
                const lng = polygon.bbox ? (polygon.bbox[0] + polygon.bbox[2]) / 2 : 0;

                const HOME = { lat: 19.43, lng: -99.13 };
                world.arcsData([{
                    startLat: HOME.lat,
                    startLng: HOME.lng,
                    endLat: lat,
                    endLng: lng,
                    color: ['#000000', '#ffffff']
                }]);

                if (lat !== 0 || lng !== 0) {
                    world.pointOfView({ lat: lat, lng: lng, altitude: 1.5 }, 1200);
                }

                world.controls().autoRotate = false;

                document.getElementById('modalCountryName').innerText = countryName;
                const locFull = document.getElementById('modalLocationFull');
                if (locFull) locFull.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i>[PAÍS] Polígono Nacional`;
                // Parsear el costo (ej: "$65-95 USD") para calcular perfiles
                let costMin = 50, costMax = 90, currency = "USD";
                const matchCost = info.cost.match(/\$?(\d+)(?:\s*-\s*\$?(\d+))?\s*([A-Za-z]+)?/);
                if (matchCost) {
                    costMin = parseInt(matchCost[1], 10);
                    costMax = matchCost[2] ? parseInt(matchCost[2], 10) : costMin;
                    currency = matchCost[3] || "USD";
                }

                const mochileroMin = Math.round(costMin * 0.6);
                const mochileroMax = Math.round(costMax * 0.6);
                const lujoMin = Math.round(costMin * 1.8);
                const lujoMax = Math.round(costMax * 1.8);

                const formatRange = (min, max, cur) => `$${min}-${max} ${cur}`;

                const elMochilero = document.getElementById('modalCostMochilero');
                const elEstandar = document.getElementById('modalCostEstandar');
                const elLujo = document.getElementById('modalCostLujo');

                if (elMochilero) elMochilero.innerText = formatRange(mochileroMin, mochileroMax, currency);
                if (elEstandar) elEstandar.innerText = formatRange(costMin, costMax, currency);
                if (elLujo) elLujo.innerText = formatRange(lujoMin, lujoMax, currency);

                document.getElementById('modalTypes').innerText = info.types;
                document.getElementById('modalAlerts').innerText = `[${info.dangerLevel.toUpperCase()}] - ${info.alerts}`;

                const btnExp = document.getElementById('btnExpedienteCompleto');
                if (btnExp) {
                    btnExp.href = `/guia?q=${encodeURIComponent(countryName)}`;
                }

                const modalEl = document.getElementById('countryModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modal.show();
                }
            };

            world.onPolygonClick(polygon => showCountryDetails(polygon));

            // --- Buscador ---
            const searchInput = document.getElementById('countrySearchInput');
            const searchBtn = document.getElementById('countrySearchBtn');
            const searchError = document.getElementById('searchError');

            const performSearch = async () => {
                const query = searchInput.value.trim().toLowerCase();
                if (!query) return;

                // 1. Intentar match local primero (por país)
                let feature = countries.features.find(f => {
                    const admin = f.properties.ADMIN ? f.properties.ADMIN.toLowerCase() : '';
                    const name = f.properties.NAME ? f.properties.NAME.toLowerCase() : '';
                    return admin === query || name === query || (admin === 'united states of america' && query === 'usa');
                });

                // 2. Si no lo encuentra directo o queremos volar exacto a la CIUDAD, usar API de TODO EL MUNDO
                if(searchBtn) {
                     const oldIco = searchBtn.innerHTML;
                     searchBtn.innerHTML = '<span class="spinner-border spinner-border-sm text-dark" role="status"></span>';
                     try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=es,en`);
                        const data = await res.json();
                        if(data && data.length > 0) {
                            const lat = parseFloat(data[0].lat);
                            const lng = parseFloat(data[0].lon);
                            
                            // Volar a esa ubicacion EXACTA (Ciudad o País) en el globo!
                            const HOME = { lat: 19.43, lng: -99.13 }; // Punto ancla visual
                            world.arcsData([{
                                startLat: HOME.lat, startLng: HOME.lng,
                                endLat: lat, endLng: lng, color: ['#000000', '#ffffff']
                            }]);
                            world.pointOfView({ lat: lat, lng: lng, altitude: 0.8 }, 1500);

                            // Extraer el país para colorearlo si es posible
                            const components = data[0].display_name.split(', ');
                            const countryExtracted = components[components.length-1].toLowerCase();
                            feature = countries.features.find(f => f.properties.ADMIN.toLowerCase() === countryExtracted || f.properties.NAME.toLowerCase() === countryExtracted);
                            
                            if (searchError) searchError.classList.add('d-none');
                            
                            // Construir modal con el dato EXACTO MUNDIAL
                            const info = generateCountryInfo(data[0].display_name);
                            document.getElementById('modalCountryName').innerText = components[0];
                            const locFull = document.getElementById('modalLocationFull');
                            if (locFull) locFull.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i>${data[0].display_name}`;
                            document.getElementById('modalCost').innerText = info.cost;
                            document.getElementById('modalTypes').innerText = info.types;
                            document.getElementById('modalAlerts').innerText = `[${info.dangerLevel.toUpperCase()}] - ${info.alerts}`;
            
                            const btnExp = document.getElementById('btnExpedienteCompleto');
                            if (btnExp) {
                                btnExp.href = `/guia?q=${encodeURIComponent(components[0])}`;
                            }

                            world.controls().autoRotate = false; // Detener globo en search
                            
                            const modalEl = document.getElementById('countryModal');
                            if (modalEl) {
                                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                                modal.show();
                            }
                        } else {
                            if (searchError) searchError.classList.remove('d-none');
                        }
                     } catch(err) {
                         if (searchError) searchError.classList.remove('d-none');
                     }
                     searchBtn.innerHTML = oldIco;
                }
                
                if (feature) {
                    world.polygonCapColor(d => d === feature ? '#ffffff' : generateCountryInfo(d.properties.ADMIN).color);
                }
            };

            if (searchBtn) searchBtn.addEventListener('click', performSearch);
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') performSearch();
                });
                
                searchInput.addEventListener('input', () => {
                    if (searchError) searchError.classList.add('d-none');
                    if (searchInput.value.trim() === '') {
                        world.polygonCapColor(d => generateCountryInfo(d.properties.ADMIN).color);
                        world.controls().autoRotate = true; // Renanudar rotación si se vacía la búsqueda
                    }
                });
            }

            // Reanudar rotación al cerrar el modal genérico
            const globalModalEl = document.getElementById('countryModal');
            if (globalModalEl) {
                globalModalEl.addEventListener('hidden.bs.modal', () => {
                    world.controls().autoRotate = true;
                });
            }
        })
        .catch(err => {
            if (loader) loader.innerText = "Error de Sistema.";
            console.error("Globe Error:", err);
        });

    // Configuración Estética de Arcos
    world.arcColor('color')
         .arcAltitude(0.25)
         .arcStroke(0.8)
         .arcDashLength(0.4)
         .arcDashGap(0.2)
         .arcDashAnimateTime(2000);

    // Interacción y Rotación
    world.controls().autoRotate = true;
    world.controls().autoRotateSpeed = 0.6;
    world.controls().enableZoom = false; // Sin zoom para no romper el canvas de la UI

    // Responsividad
    window.addEventListener('resize', () => {
        world.width(globeContainer.clientWidth);
        world.height(globeContainer.clientHeight);
    });
});
