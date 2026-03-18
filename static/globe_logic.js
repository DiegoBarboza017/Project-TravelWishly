// globe_logic.js - Interactive 3D Earth - Minimalist Architecture
document.addEventListener('DOMContentLoaded', () => {
    const globeContainer = document.getElementById('globeViz');
    if (!globeContainer) return;

    const loader = document.getElementById('globeLoader');

    // Generador de datos simulados pero sofisticados
    const generateCountryInfo = (country) => {
        const costs = ["$45 USD", "$80 USD", "$110 USD", "$180 USD", "$250 USD", "$400 USD"];
        const perfiles = ["Aventura / Mochilero", "Inmersión Cultural", "Lujo / Descanso", "Nómada Digital", "Ecoturismo"];
        const alertas = [
            "Zona Segura. Procedimientos estándar de viaje.",
            "Mantener precaución en aglomeraciones nocturnas.",
            "Requiere planificación previa severa. Zonas restringidas.",
            "Excelentes condiciones para estancias prolongadas.",
            "Revisar alertas climáticas estacionales antes de volar."
        ];

        let charSum = 0;
        for (let i = 0; i < country.length; i++) charSum += country.charCodeAt(i);

        return {
            cost: costs[charSum % costs.length],
            types: perfiles[(charSum + 1) % perfiles.length],
            alerts: alertas[(charSum + 2) % alertas.length]
        };
    };

    // Inicializar el Globo terráqueo B&W
    const world = Globe()
        (globeContainer)
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
                .polygonCapColor(() => '#000000') // Negros puros
                .polygonSideColor(() => '#ffffff') // Bordes blancos internos
                .polygonStrokeColor(() => '#ffffff')
                .polygonAltitude(0.015)
                .onPolygonHover(hoverD => {
                    world.polygonCapColor(d => d === hoverD ? '#cccccc' : '#000000');
                })
                .onPolygonClick(polygon => {
                    const countryName = polygon.properties.ADMIN;
                    const info = generateCountryInfo(countryName);

                    // Puntos de referencia para Arcos (Aproximados por centroide virtual)
                    // Nota: En un entorno real se usaría una tabla de Lat/Lng por país
                    const lat = polygon.bbox ? (polygon.bbox[1] + polygon.bbox[3]) / 2 : 0;
                    const lng = polygon.bbox ? (polygon.bbox[0] + polygon.bbox[2]) / 2 : 0;

                    // Dibujar Arco de Vuelo desde México (HOME)
                    const HOME = { lat: 19.43, lng: -99.13 };
                    world.arcsData([{
                        startLat: HOME.lat,
                        startLng: HOME.lng,
                        endLat: lat,
                        endLng: lng,
                        color: ['#000000', '#ffffff'] // Gradiente B&W
                    }]);

                    // Detener rotación momentanea para enfocar
                    world.controls().autoRotate = false;
                    setTimeout(() => { world.controls().autoRotate = true; }, 10000);

                    // Actualizar Modal
                    document.getElementById('modalCountryName').innerText = countryName;
                    document.getElementById('modalCost').innerText = info.cost;
                    document.getElementById('modalTypes').innerText = info.types;
                    document.getElementById('modalAlerts').innerText = info.alerts;

                    const modalEl = document.getElementById('countryModal');
                    if (modalEl) {
                        const modal = new bootstrap.Modal(modalEl);
                        modal.show();
                    }
                });
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
