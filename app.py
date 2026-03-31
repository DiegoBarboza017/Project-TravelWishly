"""
TravelWishly - Lógica principal del servidor web (Flask)
Estructura según lineamientos de calidad para mantenibilidad (ISO/IEC 25010)
"""
import os
import uuid
import requests
from flask import Flask, render_template, request, redirect, url_for, flash, session
from itsdangerous import URLSafeTimedSerializer
from database import db
import threading
import webbrowser
from models import User, TripBudget, DestinationGuide, SavedRoute
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from flask import jsonify

# === OpenWeather API Key (cambiar por la tuya en openweathermap.org) ===
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '7bc4ccdffadb356912aeb175eb943099')

# Módulo de Inicialización - Contribución inicial por Diego Barboza
def create_app():
    app = Flask(__name__)
    
    # Configuración de seguridad y base de datos (PostgreSQL)
    # Recomendación: Utilizar variables de entorno en producción.
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secr3t_travelwishly_k3y_for_dev')

    # Use SQLite by default for easy local execution without needing PostgreSQL setup
  # Configuración para MySQL en la Nube (Clever Cloud)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://u6wvnic50rzyhxn1:tjsmM6Y9O0ZLfTfnU49M@buatnltezoxagpbswdbx-mysql.services.clever-cloud.com:3306/buatnltezoxagpbswdbx'

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Inicialización de la Base de Datos
    db.init_app(app)

    # ==========================
    # RUTAS DE LA APLICACIÓN
    # ==========================

    @app.before_request
    def check_session_expiration():
        # Validar tiempos inactivos para sesiones no permanentes (evita el bug de navegadores que restauran pestañas cerradas)
        if 'user_id' in session and 'expires_at' in session:
            try:
                expires_at = float(session['expires_at'])
                if datetime.now().timestamp() > expires_at:
                    session.clear()
                    flash('Tu sesión temporal expiró por seguridad. Inicia sesión nuevamente.', 'error')
                    return redirect(url_for('login'))
                else:
                    # Renovar protección de inactividad mientras el usuario navegue
                    session['expires_at'] = (datetime.now() + timedelta(minutes=30)).timestamp()
            except:
                pass


    @app.route('/')
    def index():
        """Landing Page de TravelWishly"""
        return render_template('index.html')

    @app.route('/registro', methods=['GET', 'POST'])
    def registro():
        """Módulo de Usuario: Creación de perfil"""
        if request.method == 'POST':
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            
            if not username or not email or not password:
                flash('Por favor, completa todos los campos.', 'error')
                return redirect(url_for('registro'))
                
            existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
            if existing_user:
                flash('El usuario o correo electrónico ya están en uso.', 'error')
                return redirect(url_for('registro'))
            
            hashed_password = generate_password_hash(password)
            new_user = User(username=username, email=email, password_hash=hashed_password)
            db.session.add(new_user)
            db.session.commit()
            
            flash('Usuario registrado exitosamente. 🚀 ¡Bienvenido!', 'success')
            return redirect(url_for('login'))
        return render_template('registro.html')

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        """Módulo de Usuario: Autenticación seguro"""
        if request.method == 'POST':
            identifier = request.form.get('user_email')
            password = request.form.get('password')
            
            if not identifier or not password:
                flash('Por favor, ingresa tu usuario/correo y contraseña.', 'error')
                return redirect(url_for('login'))
                
            user = User.query.filter((User.username == identifier) | (User.email == identifier)).first()
            
            # Validación estricta Case-Sensitive en Python (ya que MySQL puede ser Case-Insensitive por defecto)
            identifier_is_exact_match = False
            if user:
                if user.username == identifier or user.email == identifier:
                    identifier_is_exact_match = True

            if user and identifier_is_exact_match and check_password_hash(user.password_hash, password):
                session['user_id'] = user.id
                session['username'] = user.username
                
                # Gestión Férrea de Persistencia
                if request.form.get('rememberMe'):
                    session.permanent = True
                    session.pop('expires_at', None) # Sesión eterna ligada a cookies permanentes
                else:
                    session.permanent = False # Cookie volátil 
                    # Seguro estricto de back-end: Timeout de 30 mins para burlar la restauración mágica del navegador
                    session['expires_at'] = (datetime.now() + timedelta(minutes=30)).timestamp()
                    
                flash('Bienvenido de nuevo. Sesión iniciada correctamente.', 'success')
                return redirect(url_for('dashboard'))
            else:
                flash('Credenciales incorrectas.', 'error')
                return redirect(url_for('login'))
                
        return render_template('login.html')

    def get_reset_serializer():
        return URLSafeTimedSerializer(app.config['SECRET_KEY'])

    @app.route('/reset-password', methods=['GET', 'POST'])
    def reset_password():
        """Módulo de Usuario: Solicitar recuperación de cuenta"""
        if request.method == 'POST':
            email = request.form.get('email')
            user = User.query.filter_by(email=email).first()
            
            if user:
                s = get_reset_serializer()
                token = s.dumps(user.email, salt='reset-password-salt')
                reset_link = url_for('reset_with_token', token=token, _external=True)
                print(f"LINK DE RECUPERACIÓN PARA {email}: {reset_link}")
                flash('Enlace de recuperación generado. Revisa la terminal para continuar.', 'success')
                return redirect(url_for('login'))
            else:
                flash('No se encontró una cuenta con ese correo.', 'error')
                return redirect(url_for('reset_password'))
            
        return render_template('reset_password.html')

    @app.route('/reset-password/<token>', methods=['GET', 'POST'])
    def reset_with_token(token):
        """Módulo de Usuario: Establecer nueva contraseña"""
        s = get_reset_serializer()
        try:
            email = s.loads(token, salt='reset-password-salt', max_age=3600) # Expira en 1 hora
        except:
            flash('El enlace de recuperación es inválido o ha expirado.', 'error')
            return redirect(url_for('reset_password'))
            
        user = User.query.filter_by(email=email).first()
        if not user:
            flash('Usuario no encontrado.', 'error')
            return redirect(url_for('registro'))
            
        if request.method == 'POST':
            password = request.form.get('password')
            if not password or len(password) < 8:
                flash('La contraseña debe tener al menos 8 caracteres.', 'error')
                return redirect(url_for('reset_with_token', token=token))
                
            user.password_hash = generate_password_hash(password)
            db.session.commit()
            flash('Tu contraseña ha sido actualizada. Ya puedes iniciar sesión.', 'success')
            return redirect(url_for('login'))
            
        return render_template('reset_password_token.html', token=token)

    @app.route('/logout')
    def logout():
        """Módulo de Usuario: Cerrar Sesión"""
        session.clear()
        flash('Has cerrado sesión exitosamente.', 'success')
        return redirect(url_for('index'))

    @app.route('/dashboard')
    def dashboard():
        """Panel Principal: Calculadora de presupuestos y gráficas dinámicas"""
        return render_template('dashboard.html')

    @app.route('/constructor')
    def constructor():
        """Centro de Controles: Personalización y Armado de Viaje"""
        return render_template('constructor.html')

    @app.route('/financiamiento')
    def financiamiento():
        """Simulador de Préstamos y Tarjetas de Crédito para Viajes"""
        return render_template('financiamiento.html')

    @app.route('/guia')
    def guia():
        """Guía Turística: Visualización de información cultural inteligente"""
        return render_template('guia.html')

    @app.route('/historial')
    def historial():
        """Módulo de Historial: Ver Viajes Guardados del Usuario"""
        if 'user_id' not in session:
            flash('Debes iniciar sesión para ver tu historial de viajes.', 'error')
            return redirect(url_for('login'))
            
        rutas = SavedRoute.query.filter_by(user_id=session['user_id']).order_by(SavedRoute.created_at.asc()).all()
        return render_template('historial.html', rutas=rutas)

    @app.route('/api/save_route', methods=['POST'])
    def save_route():
        """API: Guardar Itinerario Silenciosamente en Base de Datos"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401
            
        data = request.get_json()
        if not data or not data.get('origen') or not data.get('destino') or not data.get('duracion_dias'):
            return jsonify({'success': False, 'message': 'Datos incompletos'}), 400
            
        try:
            nueva_ruta = SavedRoute(
                user_id=session['user_id'],
                origen=data.get('origen'),
                destino=data.get('destino'),
                duracion_dias=int(data.get('duracion_dias')),
                fecha_ideal=data.get('fecha_ideal', ''),
                mochila_state=data.get('mochila_state', '[]'),
                vibes_state=data.get('vibes_state', '[]'),
                packing_state=data.get('packing_state', '[]')
            )
            db.session.add(nueva_ruta)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Viaje guardado exitosamente en tu Historial.'})
        except Exception as e:
            db.session.rollback()
            print(f"Error guardando ruta: {e}")
            return jsonify({'success': False, 'message': 'Error de servidor SQL al guardar la ruta.'}), 500

    @app.route('/api/delete_route/<int:route_id>', methods=['DELETE'])
    def delete_route(route_id):
        """API: Eliminar Itinerario del Historial"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401
            
        ruta = SavedRoute.query.filter_by(id=route_id, user_id=session['user_id']).first()
        if not ruta:
            return jsonify({'success': False, 'message': 'Ruta no encontrada o acceso denegado'}), 404
            
        db.session.delete(ruta)
        db.session.commit()
        return jsonify({'success': True})

    @app.route('/api/get_route/<int:route_id>', methods=['GET'])
    def get_route(route_id):
        """API: Recuperar datos profundos de Itinerario para Auto-Hidratación"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401
            
        ruta = SavedRoute.query.filter_by(id=route_id, user_id=session['user_id']).first()
        if not ruta:
            return jsonify({'success': False, 'message': 'Ruta no encontrada o acceso denegado'}), 404
            
        return jsonify({
            'success': True,
            'origen': ruta.origen,
            'destino': ruta.destino,
            'duracion_dias': ruta.duracion_dias,
            'fecha_ideal': ruta.fecha_ideal,
            'mochila_state': ruta.mochila_state,
            'vibes_state': ruta.vibes_state,
            'packing_state': ruta.packing_state
        })

    # Instanciación automática de las tablas para ambiente de desarrollo local
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print(f"Aviso de BD: {e}")

    # ===== WEATHER PROXY ENDPOINT =====
    @app.route('/api/weather')
    def api_weather():
        city = request.args.get('city', '').strip()
        if not city:
            return jsonify({'error': 'Ciudad requerida'}), 400
        try:
            url = 'https://api.openweathermap.org/data/2.5/weather'
            params = {'q': city, 'appid': OPENWEATHER_API_KEY, 'units': 'metric', 'lang': 'es'}
            resp = requests.get(url, params=params, timeout=5)
            if resp.status_code != 200:
                return jsonify({'error': f'Ciudad no encontrada: {city}'}), 404
            data = resp.json()
            return jsonify({
                'city': data['name'],
                'country': data['sys']['country'],
                'temp': round(data['main']['temp'], 1),
                'feels_like': round(data['main']['feels_like'], 1),
                'description': data['weather'][0]['description'].capitalize(),
                'icon_code': data['weather'][0]['icon'],
                'humidity': data['main']['humidity'],
                'wind': round(data['wind']['speed'], 1)
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # ===== EXCHANGE RATE PROXY ENDPOINT =====
    _exchange_cache = {}  # { base: {data, timestamp} }

    @app.route('/api/exchange')
    def api_exchange():
        import time
        base = request.args.get('base', 'USD').strip().upper()
        now = time.time()
        # Cache por 30 minutos para no abusar la API
        if base in _exchange_cache and now - _exchange_cache[base]['ts'] < 1800:
            return jsonify(_exchange_cache[base]['data'])
        try:
            resp = requests.get(f'https://open.er-api.com/v6/latest/{base}', timeout=6)
            if resp.status_code != 200:
                return jsonify({'error': 'Base no soportada'}), 400
            data = resp.json()
            result = {
                'base': base,
                'rates': data.get('rates', {}),
                'updated': data.get('time_last_update_utc', ''),
                'currencies': sorted(data.get('rates', {}).keys())
            }
            _exchange_cache[base] = {'data': result, 'ts': now}
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000/")

if __name__ == '__main__':
    aplicacion = create_app()
    threading.Timer(1.25, open_browser).start()
    aplicacion.run(debug=True, port=5000, use_reloader=False)
