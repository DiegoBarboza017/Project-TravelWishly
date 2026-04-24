#!/usr/bin/env python3
"""Reemplaza la funcion toggleHospedajeAI con buscarHotelesIA en ai_packing.js"""

with open('static/ai_packing.js', 'rb') as f:
    content = f.read().decode('utf-8')

MARKER_START = '/* =========================================================================\r\n   HOSPEDAJE INTELIGENTE\r\n========================================================================= */'
MARKER_END = 'window.analizarFechaConstructor'

idx_start = content.find(MARKER_START)
idx_end = content.find(MARKER_END)

if idx_start < 0:
    print("ERROR: No se encontro el marcador de inicio")
    exit(1)
if idx_end < 0:
    print("ERROR: No se encontro el marcador de fin")
    exit(1)

print(f"Bloque encontrado: chars {idx_start} - {idx_end}")

NEW_BLOCK = r"""/* =========================================================================
   HOSPEDAJE INTELIGENTE - Boton con reintentos automaticos
========================================================================= */
window.buscarHotelesIA = async function(intentoNum) {
    var btn = document.getElementById('btnBuscarHoteles');
    var container = document.getElementById('contenedorHospedajeAI');
    var grid = document.getElementById('gridHoteles');
    var intento = intentoNum || 1;
    var MAX_INTENTOS = 3;

    var destinoEl = document.getElementById('rutaDestino');
    var destino = destinoEl ? destinoEl.value.trim() : '';
    if (!destino) {
        if (btn) {
            btn.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-2 text-warning"></i>Ingresa un destino primero';
            btn.disabled = false;
            setTimeout(function() { btn.innerHTML = '<i class="bi bi-search me-2"></i>Buscar Alojamientos con IA'; }, 2500);
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Buscando' + (intento > 1 ? ' (intento ' + intento + '/' + MAX_INTENTOS + ')' : '...');
    }
    if (container) container.classList.remove('d-none');
    if (grid) grid.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border spinner-border-sm text-dark" role="status"></div><p class="mt-2 fw-bold text-uppercase small mb-0">Consultando IA de viajes...</p></div>';

    try {
        var res = await fetch('/api/suggest_hotels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destino: destino })
        });
        var data = await res.json();

        if (data.success && data.hoteles && data.hoteles.length > 0) {
            grid.innerHTML = '';
            data.hoteles.forEach(function(hotel) {
                var col = document.createElement('div');
                col.className = 'col-12';
                var badgeClass = 'bg-secondary';
                if (hotel.estilo && hotel.estilo.toLowerCase().indexOf('mochilero') >= 0) badgeClass = 'bg-success';
                else if (hotel.estilo && hotel.estilo.toLowerCase().indexOf('lujo') >= 0) badgeClass = 'bg-dark';
                else badgeClass = 'bg-primary';
                col.innerHTML =
                    '<div class="card rounded-0 border-dark border-2 p-3 bg-white hover-lift" style="box-shadow: 3px 3px 0 0 rgba(0,0,0,0.2);">' +
                    '<div class="d-flex justify-content-between align-items-start mb-2">' +
                    '<h6 class="fw-black mb-0" style="font-size: 15px;">' + hotel.nombre + '</h6>' +
                    '<span class="badge ' + badgeClass + ' rounded-0 border border-dark text-uppercase" style="font-size: 10px;">' + hotel.estilo + '</span>' +
                    '</div>' +
                    '<p class="small text-muted fw-bold mb-2" style="font-size: 12px; line-height: 1.3;"><i class="bi bi-info-circle-fill me-1 text-dark"></i>' + hotel.razon + '</p>' +
                    '<div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-dark border-1">' +
                    '<span class="fw-black text-dark" style="font-size: 13px;">~ ' + hotel.precio + '</span>' +
                    '<div class="d-flex gap-2">' +
                    '<a href="https://www.google.com/maps/search/Hotels+in+' + encodeURIComponent(hotel.nombre) + '+' + encodeURIComponent(destino) + '" target="_blank" class="btn btn-sm btn-outline-dark rounded-0 fw-bold border-2" style="font-size: 10px;"><i class="bi bi-geo-alt-fill"></i> Mapa</a>' +
                    '<a href="https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(destino) + '" target="_blank" class="btn btn-sm btn-dark rounded-0 fw-bold border-2" style="font-size: 10px;"><i class="bi bi-calendar-check-fill"></i> Reservar</a>' +
                    '</div></div></div>';
                grid.appendChild(col);
            });
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-check-circle-fill me-2 text-success"></i>Actualizar sugerencias';
            }
        } else {
            throw new Error(data.message || 'Respuesta vacia de la IA');
        }
    } catch(e) {
        console.warn('[HotelsAI] Intento ' + intento + ' fallido:', e.message);
        if (intento < MAX_INTENTOS) {
            var delay = intento * 1800;
            if (grid) grid.innerHTML = '<div class="col-12 text-center py-3 small fw-bold text-muted"><i class="bi bi-arrow-clockwise me-1"></i>Reintentando en ' + (delay/1000) + 's... (' + intento + '/' + MAX_INTENTOS + ')</div>';
            setTimeout(function() { window.buscarHotelesIA(intento + 1); }, delay);
        } else {
            if (grid) grid.innerHTML = '<div class="col-12 py-3"><div class="alert alert-warning border-dark border-2 rounded-0 fw-bold small mb-0"><i class="bi bi-wifi-off me-2"></i>No se pudo obtener sugerencias. Intenta de nuevo.</div></div>';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Reintentar busqueda';
            }
        }
    }
};

// Compatibilidad con llamadas antiguas al toggle
window.toggleHospedajeAI = function() { window.buscarHotelesIA(); };

""".replace('\n', '\r\n')

new_content = content[:idx_start] + NEW_BLOCK + content[idx_end:]
with open('static/ai_packing.js', 'wb') as f:
    f.write(new_content.encode('utf-8'))

print("OK: archivo actualizado correctamente")
print(f"Nuevo tamano: {len(new_content)} chars")
