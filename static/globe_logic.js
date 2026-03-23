// globe_logic.js - Interactive 3D Earth - Minimalist Architecture
document.addEventListener('DOMContentLoaded', () => {
    const globeContainer = document.getElementById('globeViz');
    if (!globeContainer) return;

    const loader = document.getElementById('globeLoader');

    // Generador de datos simulados pero sofisticados
    const generateCountryInfo = (country) => {
        const costs = ["$45 USD", "$80 USD", "$110 USD", "$180 USD", "$250 USD", "$400 USD"];
        const perfiles = ["Aventura / Mochilero", "Inmersión Cultural", "Lujo / Descanso", "Nómada Digital", "Ecoturismo"];
        const dangerLevels = [
            { level: "Bajo Riesgo", alert: "Zona Segura. Procedimientos estándar de viaje.", color: "#28a745" },
            { level: "Precaución", alert: "Mantener precaución en aglomeraciones nocturnas.", color: "#ffc107" },
            { level: "Riesgo Alto", alert: "Revisar alertas climáticas o sociales estacionales.", color: "#fd7e14" },
            { level: "Extremo", alert: "Requiere planificación previa severa. Zonas restringidas.", color: "#dc3545" }
        ];

        let charSum = 0;
        for (let i = 0; i < country.length; i++) charSum += country.charCodeAt(i);

        const dangerInfo = dangerLevels[(charSum + 2) % dangerLevels.length];

        return {
            cost: costs[charSum % costs.length],
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
                document.getElementById('modalCost').innerText = info.cost;
                document.getElementById('modalTypes').innerText = info.types;
                document.getElementById('modalAlerts').innerText = `[${info.dangerLevel.toUpperCase()}] - ${info.alerts}`;

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
