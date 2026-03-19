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
                setTimeout(() => { world.controls().autoRotate = true; }, 10000);

                document.getElementById('modalCountryName').innerText = countryName;
                document.getElementById('modalCost').innerText = info.cost;
                document.getElementById('modalTypes').innerText = info.types;
                document.getElementById('modalAlerts').innerText = `[${info.dangerLevel.toUpperCase()}] - ${info.alerts}`;

                const modalEl = document.getElementById('countryModal');
                if (modalEl) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }
            };

            world.onPolygonClick(polygon => showCountryDetails(polygon));

            // --- Buscador ---
            const searchInput = document.getElementById('countrySearchInput');
            const searchBtn = document.getElementById('countrySearchBtn');
            const searchError = document.getElementById('searchError');

            const performSearch = () => {
                const query = searchInput.value.trim().toLowerCase();
                if (!query) return;

                const feature = countries.features.find(f => {
                    const admin = f.properties.ADMIN ? f.properties.ADMIN.toLowerCase() : '';
                    const name = f.properties.NAME ? f.properties.NAME.toLowerCase() : '';
                    return admin.includes(query) || name.includes(query) || (admin === 'united states of america' && query === 'usa');
                });

                if (feature) {
                    if (searchError) searchError.classList.add('d-none');
                    // Pintar de blanco temporalmente el país buscado
                    world.polygonCapColor(d => d === feature ? '#ffffff' : generateCountryInfo(d.properties.ADMIN).color);
                    showCountryDetails(feature);
                } else {
                    if (searchError) searchError.classList.remove('d-none');
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
                    }
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
