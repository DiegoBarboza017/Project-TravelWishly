"""
TravelWishly - Lógica principal del servidor web (Flask)
Estructura según lineamientos de calidad para mantenibilidad (ISO/IEC 25010)
"""

import os
from dotenv import load_dotenv

# Determinar ruta absoluta para PythonAnywhere WSGI
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

import uuid
import requests
from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response, send_from_directory
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Mail, Message
from database import db
from sqlalchemy.pool import NullPool
import threading
import webbrowser
from models import User, TripBudget, DestinationGuide, SavedRoute, SavingsReminder
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, timezone
from flask import jsonify
from apscheduler.schedulers.background import BackgroundScheduler

# === OpenWeather API Key (cambiar por la tuya en openweathermap.org) ===
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '7bc4ccdffadb356912aeb175eb943099')

# ============================================================
# INICIALIZACIÓN DE LA APLICACIÓN (Patrón Application Factory)
# ============================================================
# ¿Por qué usar una función create_app()?
# Esto se conoce como "Application Factory". Permite crear múltiples instancias 
# de la aplicación (por ejemplo, una para desarrollo y otra para pruebas automáticas) 
# sin que interfieran entre sí. Ayuda mucho a la mantenibilidad del código.
def create_app():
    app = Flask(__name__)
    
    # --------------------------------------------------------
    # CONFIGURACIÓN DE SEGURIDAD
    # --------------------------------------------------------
    # SECRET_KEY es vital para Flask. Se usa para firmar de forma segura las 
    # cookies de sesión (donde guardamos si el usuario está logueado) y otros 
    # tokens. Si alguien descubre esta llave, podría falsificar sesiones.
    # Usamos os.environ.get para intentar leerla de un archivo .env, y si no 
    # existe, usamos un valor por defecto para que la app no explote en desarrollo.
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secr3t_travelwishly_k3y_for_dev')

    # --------------------------------------------------------
    # CONFIGURACIÓN DE CORREOS (Flask-Mail)
    # --------------------------------------------------------
    # Aquí configuramos cómo enviará correos la aplicación (ej. para Magic Links).
    # Se usa el servidor SMTP de Gmail por su fiabilidad y porque es gratuito.
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 465
    app.config['MAIL_USE_TLS'] = False
    app.config['MAIL_USE_SSL'] = True
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', 'travelwishly.bot@gmail.com')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_USERNAME', 'travelwishly.bot@gmail.com')
    mail = Mail(app)

    # ============================================================
    # SCHEDULER (PROGRAMADOR) DE RECORDATORIOS DE AHORRO
    # ============================================================
    # ¿Por qué usar un Scheduler?
    # Los usuarios crean "Planes de Ahorro" que duran meses. Necesitamos un mecanismo 
    # que, de forma invisible y automática, revise cada cierto tiempo si le toca a 
    # algún usuario recibir su correo recordatorio mensual.
    def enviar_recordatorios_ahorro():
        """
        Job que revisa la base de datos buscando planes activos que ya cumplieron
        sus 30 días de espera y envía un correo electrónico.
        """
        # app.app_context() es necesario porque estamos en un hilo secundario
        # y Flask necesita saber a qué aplicación pertenece esta base de datos.
        with app.app_context():
            try:
                ahora = datetime.now(timezone.utc)
                
                # Buscamos en la base de datos planes que cumplan 3 condiciones:
                # 1. Están activos
                # 2. La fecha de "próximo recordatorio" ya pasó o es ahora
                # 3. Aún no se han enviado todos los recordatorios prometidos
                planes = SavingsReminder.query.filter(
                    SavingsReminder.is_active == True,
                    SavingsReminder.next_reminder <= ahora,
                    SavingsReminder.reminders_sent < SavingsReminder.total_months
                ).all()

                for plan in planes:
                    usuario = User.query.get(plan.user_id)
                    if not usuario:
                        continue

                    mes_actual = plan.reminders_sent + 1
                    monto_fmt = f"{plan.currency_symbol}{plan.monthly_amount:,.2f} {plan.currency}"

                    cuerpo = (
                        f"Hola {usuario.username} ✈️\n\n"
                        f"Este es tu recordatorio #{mes_actual} de {plan.total_months} "
                        f"para tu viaje a {plan.destination}.\n\n"
                        f"💰 No olvides tu ahorro mensual de {monto_fmt}\n\n"
                        f"¡Vas muy bien! Sigue así y pronto estarás haciendo las maletas 🧳\n\n"
                        f"— El equipo de TravelWishly"
                    )

                    try:
                        msg = Message(
                            subject=f"✈️ Recordatorio de ahorro #{mes_actual}: {monto_fmt} para {plan.destination}",
                            recipients=[usuario.email],
                            body=cuerpo
                        )
                        mail.send(msg)
                        print(f"[SCHEDULER] Correo enviado a {usuario.email} (plan #{plan.id}, mes {mes_actual})")
                    except Exception as mail_err:
                        print(f"[SCHEDULER] Error enviando correo a {usuario.email}: {mail_err}")

                    plan.reminders_sent += 1
                    plan.next_reminder = ahora + timedelta(days=30)

                    if plan.reminders_sent >= plan.total_months:
                        plan.is_active = False
                        print(f"[SCHEDULER] Plan #{plan.id} completado. Marcado como inactivo.")

                db.session.commit()
            except Exception as e:
                print(f"[SCHEDULER] Error general: {e}")

    # Función para enviar el correo de validación a los 5 minutos de crear un viaje
    def enviar_recordatorio_prueba_5min(email, destino, base_url):
        with app.app_context():
            try:
                cuerpo = (
                    f"¡Hola viajero! ✈️\n\n"
                    f"Este es el primer recordatorio de prueba para tu próximo viaje a {destino}.\n"
                    f"Tu itinerario se ha guardado correctamente y nuestro sistema de alertas "
                    f"está activado y funcionando al 100%.\n\n"
                    f"Puedes ver tu itinerario en cualquier momento aquí: {base_url}historial\n\n"
                    f"— El equipo de TravelWishly"
                )
                msg = Message(
                    subject=f"✅ Prueba de Recordatorio Activa: Viaje a {destino}",
                    recipients=[email],
                    body=cuerpo
                )
                mail.send(msg)
                print(f"[SCHEDULER] 5-min Recordatorio de prueba enviado a {email} para {destino}")
            except Exception as e:
                print(f"[SCHEDULER] Error en recordatorio 5-min: {e}")

    # Iniciar scheduler (solo una vez, evitando doble arranque en modo debug)
    if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        scheduler = BackgroundScheduler()
        scheduler.add_job(enviar_recordatorios_ahorro, 'interval', hours=1, id='savings_reminder_job')
        scheduler.start()
        app.apscheduler = scheduler  # Exponer el scheduler para crear trabajos dinámicos
        print("[SCHEDULER] APScheduler iniciado — revisando recordatorios cada hora.")

    # Configuración de base de datos — MySQL/Clever Cloud en producción, SQLite como fallback local
    default_db_path = 'sqlite:///' + os.path.join(basedir, 'instance', 'travelwishly.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', default_db_path)

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Prevenir Caídas por Max_User_Connections imponiendo cierre inmediato
    if "mysql" in app.config['SQLALCHEMY_DATABASE_URI']:
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'poolclass': NullPool,
            'pool_pre_ping': True
        }

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
            
            try:
                msg = Message(
                    subject='¡Bienvenido a TravelWishly! 🌍',
                    recipients=[email],
                    body=f'Hola {username},\n\nGracias por registrarte en TravelWishly. ¡Estamos muy emocionados de ayudarte a planear tu próxima aventura!\n\nSaludos,\nEl equipo de TravelWishly'
                )
                mail.send(msg)
            except Exception as e:
                print(f"Error enviando correo de bienvenida: {e}")

            flash('Usuario registrado exitosamente. Se ha enviado un correo a tu cuenta.', 'success')
            next_page = request.args.get('next')
            return redirect(url_for('login', next=next_page) if next_page else url_for('login'))
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
                session['user_email'] = user.email
                
                # Gestión Férrea de Persistencia
                if request.form.get('rememberMe'):
                    session.permanent = True
                    session.pop('expires_at', None) # Sesión eterna ligada a cookies permanentes
                else:
                    session.permanent = False # Cookie volátil 
                    # Seguro estricto de back-end: Timeout de 30 mins para burlar la restauración mágica del navegador
                    session['expires_at'] = (datetime.now() + timedelta(minutes=30)).timestamp()
                    
                flash('Bienvenido de nuevo. Sesión iniciada correctamente.', 'success')
                next_page = request.args.get('next')
                return redirect(next_page if next_page else url_for('index'))
            else:
                flash('Credenciales incorrectas.', 'error')
                return redirect(url_for('login'))
                
        return render_template('login.html')

    # ============================================================
    # AUTENTICACIÓN SIN CONTRASEÑA ("MAGIC LINKS")
    # ============================================================
    # ¿Por qué usar Magic Links?
    # Mejoran la experiencia del usuario (UX) al no obligarlos a recordar otra 
    # contraseña. Simplemente ingresan su correo y reciben un enlace seguro.
    @app.route('/magic-login', methods=['POST'])
    def magic_login():
        """Genera y envía un enlace de acceso único al correo del usuario."""
        email = request.form.get('google_email')
        if not email or '@' not in email:
            flash('Por favor, ingresa un correo válido.', 'error')
            return redirect(url_for('login'))
        
        # URLSafeTimedSerializer crea un 'token' (un texto encriptado) que contiene 
        # el correo del usuario. Como está firmado con nuestra SECRET_KEY, 
        # nadie puede falsificarlo.
        s = get_reset_serializer()
        token = s.dumps(email, salt='magic-link-salt')
        
        # Creamos la URL completa a la que el usuario debe hacer clic
        next_page = request.args.get('next')
        magic_link = url_for('magic_auth', token=token, next=next_page, _external=True)
        
        try:
            msg = Message(
                subject='Tu enlace de acceso seguro a TravelWishly 🌍',
                recipients=[email],
                body=f'Hola viajero,\n\nHaz clic en el siguiente enlace para entrar a TravelWishly al instante:\n{magic_link}\n\nEste enlace expira pronto y solo puede usarse una vez.\n\nSaludos,\nEl equipo de TravelWishly'
            )
            mail.send(msg)
            flash('Te hemos enviado un enlace de un solo clic a tu correo. ¡Revísalo para entrar al instante!', 'success')
        except Exception as e:
            print(f"Error enviando magic link: {e}")
            # Failsafe para evitar que el usuario se quede bloqueado si el correo falla en el servidor
            flash(f'Hubo un problema enviando el correo. Sin embargo, puedes entrar haciendo clic aquí: <a href="{magic_link}" class="fw-bold text-dark text-decoration-underline">Entrar a mi cuenta</a>', 'error')
            
        next_page = request.args.get('next')
        return redirect(url_for('login', next=next_page) if next_page else url_for('login'))

    # Esta ruta es la que se abre cuando el usuario hace clic en el correo
    @app.route('/magic-auth/<token>')
    def magic_auth(token):
        """Valida el enlace e inicia sesión (o registra) automáticamente"""
        s = get_reset_serializer()
        try:
            email = s.loads(token, salt='magic-link-salt', max_age=900)
            email = email.lower().strip()
        except:
            flash('El enlace de acceso es inválido o ha expirado.', 'error')
            return redirect(url_for('login'))
            
        try:
            user = User.query.filter_by(email=email).first()
            is_new_user = False
            
            # Funcionalidad "Lazy Registration": Si el correo no existe en la base 
            # de datos, creamos la cuenta automáticamente sin pedir más datos.
            if not user:
                base_name = email.split('@')[0]
                username_to_try = base_name
                counter = 1
                # Garantizar que el username sea único para no causar un IntegrityError (Error 500)
                while User.query.filter_by(username=username_to_try).first() is not None:
                    username_to_try = f"{base_name}{counter}"
                    counter += 1
                    
                # Le asignamos una contraseña aleatoria imposible de adivinar, 
                # ya que el usuario solo usará el correo para entrar.
                user = User(username=username_to_try, email=email, password_hash=generate_password_hash(uuid.uuid4().hex))
                db.session.add(user)
                db.session.commit()
                is_new_user = True
                
            # Iniciar la sesión
            session['user_id'] = user.id
            session['username'] = user.username
            session['user_email'] = user.email
            session.permanent = False
            session['expires_at'] = (datetime.now() + timedelta(minutes=60)).timestamp()
            
            if is_new_user:
                flash('¡Cuenta creada exitosamente! Bienvenido/a a TravelWishly.', 'success')
            else:
                flash(f'¡Bienvenido de nuevo, {user.username}!', 'success')
            
            # ¿Por qué renderizamos 'magic_success.html' en vez de redirigir al Dashboard?
            # Porque usualmente el usuario abre este enlace desde su celular o en una pestaña 
            # ajena, y necesitamos que pueda "Aceptar" para continuar.
            next_page = request.args.get('next')
            return render_template('magic_success.html', user=user, next_page=next_page)
        except Exception as e:
            return f"<h1>Error Crítico Interno (TravelWishly Debug)</h1><p>Ha ocurrido un error en la base de datos: <b>{str(e)}</b></p><p>Por favor toma una captura de esta pantalla y envíala.</p>", 500

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
                
                try:
                    msg = Message(
                        subject='Recuperación de contraseña en TravelWishly',
                        recipients=[email],
                        body=f'Hola {user.username},\n\nHas solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:\n{reset_link}\n\nSi no fuiste tú quien solicitó esto, ignora este mensaje.\n\nSaludos,\nEl equipo de TravelWishly'
                    )
                    mail.send(msg)
                    flash('Se ha enviado un correo con el enlace de recuperación a tu cuenta.', 'success')
                except Exception as e:
                    print(f"Error enviando correo de recuperación: {e}")
                    flash('Error interno al intentar enviar el correo. Por favor contacta soporte.', 'error')
                
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

    @app.context_processor
    def utility_processor():
        def get_flag(destino):
            destino_lower = (destino or '').lower()
            mapping = {
                'japon': '🇯🇵', 'japón': '🇯🇵', 'tokio': '🇯🇵', 'kyoto': '🇯🇵', 'kioto': '🇯🇵',
                'alemania': '🇩🇪', 'berlin': '🇩🇪', 'munich': '🇩🇪',
                'argentina': '🇦🇷', 'buenos aires': '🇦🇷', 'patagonia': '🇦🇷',
                'australia': '🇦🇺', 'sydney': '🇦🇺', 'melbourne': '🇦🇺',
                'brasil': '🇧🇷', 'rio': '🇧🇷', 'sao paulo': '🇧🇷',
                'canada': '🇨🇦', 'canadá': '🇨🇦', 'toronto': '🇨🇦', 'vancouver': '🇨🇦',
                'colombia': '🇨🇴', 'bogota': '🇨🇴', 'bogotá': '🇨🇴', 'medellin': '🇨🇴', 'medellín': '🇨🇴',
                'corea': '🇰🇷', 'seul': '🇰🇷', 'seúl': '🇰🇷',
                'costa rica': '🇨🇷',
                'cuba': '🇨🇺',
                'chile': '🇨🇱', 'santiago': '🇨🇱',
                'china': '🇨🇳', 'pekin': '🇨🇳', 'shanghai': '🇨🇳',
                'egipto': '🇪🇬',
                'dubai': '🇦🇪', 'dubái': '🇦🇪', 'emiratos': '🇦🇪',
                'espana': '🇪🇸', 'españa': '🇪🇸', 'madrid': '🇪🇸', 'barcelona': '🇪🇸', 'ibiza': '🇪🇸',
                'estados unidos': '🇺🇸', 'usa': '🇺🇸', 'eeuu': '🇺🇸', 'new york': '🇺🇸', 'nueva york': '🇺🇸', 'los angeles': '🇺🇸',
                'francia': '🇫🇷', 'paris': '🇫🇷', 'parís': '🇫🇷',
                'grecia': '🇬🇷', 'atenas': '🇬🇷', 'santorini': '🇬🇷',
                'india': '🇮🇳',
                'indonesia': '🇮🇩', 'bali': '🇮🇩',
                'italia': '🇮🇹', 'roma': '🇮🇹', 'venecia': '🇮🇹',
                'jordania': '🇯🇴',
                'marruecos': '🇲🇦',
                'mexico': '🇲🇽', 'méxico': '🇲🇽', 'cancun': '🇲🇽', 'cancún': '🇲🇽', 'tulum': '🇲🇽',
                'nueva zelanda': '🇳🇿',
                'paises bajos': '🇳🇱', 'países bajos': '🇳🇱', 'amsterdam': '🇳🇱', 'ámsterdam': '🇳🇱',
                'peru': '🇵🇪', 'perú': '🇵🇪', 'cusco': '🇵🇪', 'machu picchu': '🇵🇪',
                'polinesia': '🇵🇫', 'bora bora': '🇵🇫',
                'reino unido': '🇬🇧', 'londres': '🇬🇧', 'uk': '🇬🇧', 'inglaterra': '🇬🇧',
                'dominicana': '🇩🇴', 'punta cana': '🇩🇴',
                'suiza': '🇨🇭',
                'tailandia': '🇹🇭', 'bangkok': '🇹🇭',
                'turquia': '🇹🇷', 'turquía': '🇹🇷'
            }
            for kw, flag in mapping.items():
                if kw in destino_lower:
                    return flag
            return '✈️'
        return dict(get_flag=get_flag)

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
        # Acepta ?destino= (desde inicio/home) o ?q= (legacy desde buscador)
        destino_inicial = request.args.get('destino', '').strip() or request.args.get('q', '').strip()
        return render_template('guia.html', destino_inicial=destino_inicial)

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
            import json
            token = uuid.uuid4().hex
            itinerary_steps = data.get('itinerary_steps') or data.get('itinerario_steps') or []
            nueva_ruta = SavedRoute(
                user_id=session['user_id'],
                origen=data.get('origen'),
                destino=data.get('destino'),
                duracion_dias=int(data.get('duracion_dias')),
                fecha_ideal=data.get('fecha_ideal', ''),
                mochila_state=data.get('mochila_state', '[]'),
                vibes_state=data.get('vibes_state', '[]'),
                packing_state=data.get('packing_state', '[]'),
                itinerary_state=json.dumps(itinerary_steps),
                is_draft=bool(data.get('is_draft', False)),
                share_token=token
            )
            db.session.add(nueva_ruta)
            db.session.commit()

            usuario = User.query.get(session['user_id'])
            destino_txt = data.get('destino', '—')

            # ── Enviar email de resumen del viaje ────────────────────────────
            try:
                from flask_mail import Message
                if usuario and usuario.email:
                    origen_txt      = data.get('origen', '—')
                    duracion_txt    = data.get('duracion_dias', '—')
                    fecha_txt       = data.get('fecha_ideal', '') or 'Sin fecha definida'
                    mochila_items   = data.get('mochila_detalle', [])   # list[{nombre, costo}]
                    total_mochila   = data.get('total_mochila', 0)
                    presupuesto     = data.get('presupuesto_viaje', None)
                    itinerario_pasos= data.get('itinerary_steps') or data.get('itinerario_steps', [])

                    # Construir filas de gastos de mochila
                    filas_mochila = ''
                    if mochila_items:
                        for item in mochila_items:
                            costo_fmt = f"${item['costo']:,} MXN" if item['costo'] > 0 else 'Gratis'
                            filas_mochila += f"""
                            <tr>
                                <td style="padding:8px 12px;border-bottom:1px solid #eee;">{item['nombre']}</td>
                                <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">{costo_fmt}</td>
                            </tr>"""
                    else:
                        filas_mochila = '<tr><td colspan="2" style="padding:8px 12px;color:#888;">Sin extras seleccionados</td></tr>'

                    # Construir lista de itinerario
                    pasos_html = ''
                    for i, paso in enumerate(itinerario_pasos, 1):
                        pasos_html += f'<li style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">{paso}</li>'
                    if not pasos_html:
                        pasos_html = '<li style="color:#888;">Ruta generada automáticamente</li>'

                    # Gran total
                    resumen_presupuesto = ''
                    if presupuesto:
                        gran_total = (presupuesto or 0) + (total_mochila or 0)
                        resumen_presupuesto = f"""
                        <tr style="background:#f8f9fa;">
                            <td style="padding:8px 12px;font-weight:700;">💰 Presupuesto del Viaje</td>
                            <td style="padding:8px 12px;text-align:right;font-weight:700;">${presupuesto:,} MXN</td>
                        </tr>
                        <tr style="background:#e8f4fd;">
                            <td style="padding:8px 12px;font-weight:700;">🧳 Gastos Extras (Mochila)</td>
                            <td style="padding:8px 12px;text-align:right;font-weight:700;">${total_mochila:,} MXN</td>
                        </tr>
                        <tr style="background:#000;color:#fff;">
                            <td style="padding:10px 12px;font-weight:900;font-size:15px;">GRAN TOTAL ESTIMADO</td>
                            <td style="padding:10px 12px;text-align:right;font-weight:900;font-size:15px;">${gran_total:,} MXN</td>
                        </tr>"""

                    html_body = f"""
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                        <div style="background:#000;color:#fff;padding:28px 32px;">
                            <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:2px;">✈️ TRAVELWISHLY</h1>
                            <p style="margin:6px 0 0;font-size:14px;opacity:0.7;">Resumen de tu Viaje Planeado</p>
                        </div>
                        <div style="padding:24px 32px;background:#fff;border:1px solid #eee;">
                            <h2 style="font-size:20px;font-weight:900;margin-top:0;">
                                ¡Tu viaje a <span style="border-bottom:3px solid #000;">{destino_txt}</span> está guardado! 🎉
                            </h2>
                            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8f9fa;border:2px solid #000;">
                                <tr><td style="padding:8px 12px;font-weight:700;">📍 Origen</td><td style="padding:8px 12px;">{origen_txt}</td></tr>
                                <tr><td style="padding:8px 12px;font-weight:700;">🏁 Destino</td><td style="padding:8px 12px;">{destino_txt}</td></tr>
                                <tr><td style="padding:8px 12px;font-weight:700;">📅 Días de Estadía</td><td style="padding:8px 12px;">{duracion_txt} días</td></tr>
                                <tr><td style="padding:8px 12px;font-weight:700;">🗓️ Fecha Tentativa</td><td style="padding:8px 12px;">{fecha_txt}</td></tr>
                            </table>

                            <h3 style="font-weight:900;font-size:15px;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:6px;">
                                🗺️ Tu Itinerario Personalizado
                            </h3>
                            <ol style="padding-left:20px;margin-bottom:24px;">{pasos_html}</ol>

                            <h3 style="font-weight:900;font-size:15px;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:6px;">
                                💼 Gastos Extras — Mochila & Documentos
                            </h3>
                            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:2px solid #000;">
                                {filas_mochila}
                                <tr style="background:#000;color:#fff;">
                                    <td style="padding:8px 12px;font-weight:900;">TOTAL EXTRAS</td>
                                    <td style="padding:8px 12px;text-align:right;font-weight:900;">${total_mochila:,} MXN</td>
                                </tr>
                            </table>

                            {'<h3 style="font-weight:900;font-size:15px;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:6px;">💰 Resumen Financiero</h3><table style="width:100%;border-collapse:collapse;border:2px solid #000;">' + resumen_presupuesto + '</table>' if resumen_presupuesto else ''}

                            <p style="color:#666;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
                                Puedes ver y editar este viaje en cualquier momento desde tu 
                                <a href="{request.host_url}historial" style="color:#000;font-weight:700;text-decoration:underline;">Historial de Viajes</a> en TravelWishly.
                            </p>
                        </div>
                        <div style="background:#f0f0f0;padding:12px 32px;text-align:center;font-size:11px;color:#888;">
                            TravelWishly — Tu planificador de viajes inteligente
                        </div>
                    </div>"""

                    msg = Message(
                        subject=f"✈️ Tu viaje a {destino_txt} está guardado — TravelWishly",
                        recipients=[usuario.email],
                        html=html_body
                    )
                    mail.send(msg)
            except Exception as mail_err:
                print(f"[SAVE_ROUTE] Email de resumen no enviado: {mail_err}")

            # Programar el correo de recordatorio de prueba a los 5 minutos
            if hasattr(app, 'apscheduler'):
                # Usamos una función lambda o pasamos args a la función del scheduler
                run_time = datetime.now(timezone.utc) + timedelta(minutes=5)
                # El id del job lleva un UUID para evitar colisiones si se guardan varios viajes rápido
                job_id = f"recordatorio_5min_{nueva_ruta.id}_{uuid.uuid4().hex[:6]}"
                if usuario and usuario.email:
                    app.apscheduler.add_job(
                        func=enviar_recordatorio_prueba_5min,
                        trigger='date',
                        run_date=run_time,
                        args=[usuario.email, destino_txt, request.host_url],
                        id=job_id
                    )
                    print(f"[SCHEDULER] Programado recordatorio de 5 minutos para viaje #{nueva_ruta.id} a las {run_time}")

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

    @app.route('/api/save_draft', methods=['POST'])
    def save_draft():
        """API: Guardar borrador de viaje (sin enviar email)"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401

        data = request.get_json()
        if not data or not data.get('destino'):
            return jsonify({'success': False, 'message': 'Datos incompletos'}), 400

        try:
            import json
            itinerary_steps = data.get('itinerary_steps') or data.get('itinerario_steps') or []

            # Si ya existe un draft para este destino del usuario, actualizarlo
            existing = SavedRoute.query.filter_by(
                user_id=session['user_id'],
                destino=data.get('destino'),
                is_draft=True
            ).first()

            is_final_flag = data.get('is_final', False)
            is_draft_val = not is_final_flag

            if existing:
                existing.origen = data.get('origen', existing.origen)
                existing.duracion_dias = int(data.get('duracion_dias', existing.duracion_dias))
                existing.fecha_ideal = data.get('fecha_ideal', existing.fecha_ideal)
                existing.mochila_state = data.get('mochila_state', existing.mochila_state)
                existing.vibes_state = data.get('vibes_state', existing.vibes_state)
                existing.packing_state = data.get('packing_state', existing.packing_state)
                existing.itinerary_state = json.dumps(itinerary_steps)
                existing.is_draft = is_draft_val
                db.session.commit()
                return jsonify({'success': True, 'message': 'Viaje actualizado.', 'route_id': existing.id})
            else:
                borrador = SavedRoute(
                    user_id=session['user_id'],
                    origen=data.get('origen', 'Por definir'),
                    destino=data.get('destino'),
                    duracion_dias=int(data.get('duracion_dias', 1)),
                    fecha_ideal=data.get('fecha_ideal', ''),
                    mochila_state=data.get('mochila_state', '[]'),
                    vibes_state=data.get('vibes_state', '[]'),
                    packing_state=data.get('packing_state', '[]'),
                    itinerary_state=json.dumps(itinerary_steps),
                    is_draft=is_draft_val
                )
                db.session.add(borrador)
                db.session.commit()
                return jsonify({'success': True, 'message': 'Borrador guardado.', 'route_id': borrador.id})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/api/finalize_route/<int:route_id>', methods=['POST'])
    def finalize_route(route_id):
        """API: Convertir borrador a viaje definitivo"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401

        ruta = SavedRoute.query.filter_by(id=route_id, user_id=session['user_id']).first()
        if not ruta:
            return jsonify({'success': False, 'message': 'Ruta no encontrada'}), 404

        ruta.is_draft = False
        db.session.commit()
        return jsonify({'success': True, 'message': 'Viaje finalizado y guardado en tu historial.'})

    @app.route('/api/send_finance_summary', methods=['POST'])
    def send_finance_summary():
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Debes iniciar sesión para recibir este correo.'}), 401
            
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'Datos inválidos.'}), 400
            
        usuario = User.query.get(session['user_id'])
        if not usuario:
            return jsonify({'success': False, 'message': 'Usuario no encontrado.'}), 404
            
        destino = data.get('destino', 'Tu próximo viaje')
        monto = data.get('monto', 0)
        enganche = data.get('enganche', 0)
        tasa = data.get('tasa', 0)
        meses = data.get('meses', 0)
        cuota = data.get('cuota', 0)
        total_pagar = data.get('total_pagar', 0)
        intereses = data.get('intereses', 0)
        
        cuerpo = (
            f"Hola {usuario.username} ✈️\n\n"
            f"Aquí tienes el resumen de tu simulación de crédito para {destino}:\n\n"
            f"💰 Costo Total: ${monto:,.2f} MXN\n"
            f"💵 Enganche Pagado: ${enganche:,.2f} MXN\n"
            f"📈 Tasa de Interés: {tasa}%\n"
            f"📅 Plazo: {meses} meses\n"
            f"➡️ Pago Mensual: ${cuota:,.2f} MXN\n"
            f"🔥 Intereses Proyectados: ${intereses:,.2f} MXN\n"
            f"💳 Gran Total a Pagar: ${total_pagar:,.2f} MXN\n\n"
            f"Sigue planificando tu aventura con nosotros en TravelWishly 🌍\n\n"
            f"— El equipo de TravelWishly"
        )
        
        try:
            msg = Message(
                subject=f"📊 Resumen de Financiamiento para {destino} — TravelWishly",
                recipients=[usuario.email],
                body=cuerpo
            )
            mail.send(msg)
            return jsonify({'success': True, 'message': 'Resumen enviado exitosamente a tu correo.'})
        except Exception as e:
            print(f"[FINANCE_SUMMARY] Error enviando correo: {e}")
            return jsonify({'success': False, 'message': 'Hubo un problema al enviar el correo.'}), 500

    # ============================================================
    # RUTAS API: PLANES DE AHORRO CON RECORDATORIOS POR EMAIL
    # ============================================================

    @app.route('/api/save_savings_plan', methods=['POST'])
    def save_savings_plan():
        """API: Registrar un nuevo plan de ahorro y enviar el primer correo inmediatamente"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Debes iniciar sesión para activar recordatorios.'}), 401

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'Datos inválidos.'}), 400

        destination   = data.get('destination', '').strip()
        monthly_amount = float(data.get('monthly_amount', 0))
        total_months  = int(data.get('total_months', 1))
        currency      = data.get('currency', 'MXN').upper()
        currency_symbol = data.get('currency_symbol', '$')

        if not destination or monthly_amount <= 0 or total_months < 1:
            return jsonify({'success': False, 'message': 'Datos del plan incompletos o inválidos.'}), 400

        ahora = datetime.now(timezone.utc)
        # El PRIMER recordatorio se envía ahora mismo; el siguiente en 30 días
        nuevo_plan = SavingsReminder(
            user_id        = session['user_id'],
            destination    = destination,
            monthly_amount = monthly_amount,
            total_months   = total_months,
            currency       = currency,
            currency_symbol= currency_symbol,
            start_date     = ahora,
            next_reminder  = ahora,   # inmediatamente disponible para el scheduler
            reminders_sent = 0,
            is_active      = True
        )
        db.session.add(nuevo_plan)
        db.session.commit()

        # Enviar el PRIMER correo de forma inmediata (sin esperar el scheduler)
        usuario = User.query.get(session['user_id'])
        monto_fmt = f"{currency_symbol}{monthly_amount:,.2f} {currency}"
        cuerpo_inicial = (
            f"Hola {usuario.username} ✈️\n\n"
            f"¡Tu plan de ahorro para {destination} ha sido activado con éxito!\n\n"
            f"💰 Tu cuota mensual es de {monto_fmt} durante {total_months} mes{'es' if total_months > 1 else ''}.\n\n"
            f"Recibirás un recordatorio cada mes para mantenerte en el camino correcto.\n"
            f"¡Empieza a ahorrar desde hoy y pronto estarás en {destination}! 🌍\n\n"
            f"— El equipo de TravelWishly"
        )
        try:
            msg = Message(
                subject=f"✈️ Plan de ahorro activado: {monto_fmt}/mes para {destination}",
                recipients=[usuario.email],
                body=cuerpo_inicial
            )
            mail.send(msg)
            # Marcar el primer envío hecho y programar el siguiente en 30 días
            nuevo_plan.reminders_sent = 1
            nuevo_plan.next_reminder  = ahora + timedelta(days=30)
            if nuevo_plan.reminders_sent >= nuevo_plan.total_months:
                nuevo_plan.is_active = False
            db.session.commit()
            print(f"[SAVINGS] Primer correo enviado a {usuario.email} para plan #{nuevo_plan.id}")
        except Exception as e:
            print(f"[SAVINGS] Error enviando correo inicial: {e}")

        return jsonify({'success': True, 'message': f'Plan de ahorro activado. ¡Revisá tu correo {usuario.email}!', 'plan_id': nuevo_plan.id})

    # ==========================================
    # RUTAS PWA (OFFLINE MODE)
    # ==========================================
    @app.route('/sw.js')
    def service_worker():
        response = make_response(send_from_directory('static', 'sw.js'))
        response.headers['Content-Type'] = 'application/javascript'
        response.headers['Service-Worker-Allowed'] = '/'
        return response

    @app.route('/manifest.json')
    def manifest():
        return send_from_directory('static', 'manifest.json')

    @app.route('/api/savings_plans', methods=['GET'])
    def get_savings_plans():
        """API: Ver planes de ahorro activos del usuario"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401

        planes = SavingsReminder.query.filter_by(user_id=session['user_id']).order_by(SavingsReminder.start_date.desc()).all()
        resultado = []
        for p in planes:
            resultado.append({
                'id': p.id,
                'destination': p.destination,
                'monthly_amount': p.monthly_amount,
                'total_months': p.total_months,
                'currency': p.currency,
                'currency_symbol': p.currency_symbol,
                'reminders_sent': p.reminders_sent,
                'is_active': p.is_active,
                'next_reminder': p.next_reminder.strftime('%Y-%m-%d %H:%M') if p.next_reminder else None
            })
        return jsonify({'success': True, 'plans': resultado})

    @app.route('/api/savings_plans/<int:plan_id>', methods=['DELETE'])
    def delete_savings_plan(plan_id):
        """API: Cancelar un plan de ahorro activo"""
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401

        plan = SavingsReminder.query.filter_by(id=plan_id, user_id=session['user_id']).first()
        if not plan:
            return jsonify({'success': False, 'message': 'Plan no encontrado.'}), 404

        plan.is_active = False
        db.session.commit()
        return jsonify({'success': True, 'message': 'Plan de ahorro cancelado.'})

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
            'packing_state': ruta.packing_state,
            'itinerary_state': ruta.itinerary_state,
            'is_draft': ruta.is_draft
        })

    # Instanciación automática de las tablas para ambiente de desarrollo local
    with app.app_context():
        try:
            # Asegurar que la carpeta instance exista
            os.makedirs(os.path.join(basedir, 'instance'), exist_ok=True)
            db.create_all()
        except Exception as e:
            print(f"Aviso de BD: {e}")
        # Migración suave: añadir is_draft si no existe — compatible SQLite y MySQL
        try:
            from sqlalchemy import text, inspect as sa_inspect
            inspector = sa_inspect(db.engine)
            existing_cols = [c['name'] for c in inspector.get_columns('saved_routes')]
            if 'is_draft' not in existing_cols:
                with db.engine.connect() as conn:
                    db_dialect = db.engine.dialect.name  # 'sqlite' o 'mysql'
                    if db_dialect == 'sqlite':
                        conn.execute(text("ALTER TABLE saved_routes ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0"))
                    else:
                        conn.execute(text("ALTER TABLE saved_routes ADD COLUMN is_draft TINYINT(1) NOT NULL DEFAULT 0"))
                    conn.commit()
                print("[MIGRATION] Columna is_draft añadida a saved_routes.")
            else:
                print("[MIGRATION] Columna is_draft ya existe — OK.")

            if 'share_token' not in existing_cols:
                with db.engine.connect() as conn:
                    db_dialect = db.engine.dialect.name
                    conn.execute(text("ALTER TABLE saved_routes ADD COLUMN share_token VARCHAR(36) UNIQUE"))
                    conn.commit()
                print("[MIGRATION] Columna share_token añadida a saved_routes. Asignando UUIDs a las antiguas...")
                # Llenar tokens antiguos
                with app.app_context():
                    rutas = SavedRoute.query.filter_by(share_token=None).all()
                    for r in rutas:
                        r.share_token = uuid.uuid4().hex
                    if rutas:
                        db.session.commit()
            else:
                print("[MIGRATION] Columna share_token ya existe — OK.")

            if 'itinerary_state' not in existing_cols:
                with db.engine.connect() as conn:
                    conn.execute(text("ALTER TABLE saved_routes ADD COLUMN itinerary_state TEXT"))
                    conn.commit()
                print("[MIGRATION] Columna itinerary_state añadida a saved_routes.")
            else:
                print("[MIGRATION] Columna itinerary_state ya existe — OK.")
        except Exception as e:
            print(f"[MIGRATION] Aviso: {e}")

    # ============================================================
    # PROXIES DE APIS EXTERNAS
    # ============================================================
    # ¿Por qué creamos estas rutas si el frontend podría llamar a OpenWeather directamente?
    # 1. Seguridad: Ocultamos nuestra API KEY (OPENWEATHER_API_KEY) en el servidor.
    # 2. CORS: Los navegadores bloquean peticiones directas desde el frontend a otros 
    #    dominios por seguridad. Al hacerlo desde Python, evitamos ese bloqueo.

    # ===== WEATHER PROXY ENDPOINT (Clima) =====
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

    # ===== EXCHANGE RATE PROXY ENDPOINT (Divisas) =====
    # Usamos este diccionario como "Caché" temporal en memoria RAM.
    _exchange_cache = {}  # Guarda datos en este formato: { base: {data, timestamp} }

    @app.route('/api/exchange')
    def api_exchange():
        import time
        base = request.args.get('base', 'USD').strip().upper()
        now = time.time()
        
        # ¿Por qué usar Caché?
        # Las APIs gratuitas de divisas tienen límites (ej. 1000 peticiones por día).
        # Si 50 usuarios piden el tipo de cambio del USD, en vez de gastar 50 peticiones,
        # hacemos 1 sola, la guardamos aquí, y durante 30 minutos (1800 segundos) 
        # le enviamos a todos los usuarios los datos guardados. ¡Ahorro extremo!
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

    @app.route('/api/check_session')
    def api_check_session():
        """Polling route para que el JS sepa si el usuario fue autenticado exitosamente en otra pestaña"""
        if 'user_id' in session and 'username' in session:
            return jsonify({'logged_in': True, 'username': session['username']})
        return jsonify({'logged_in': False})

    # ===== IMAGE SEARCH PROXY ENDPOINT =====
    _image_cache = {}

    # Colección de imágenes de viaje de Unsplash verificadas (no requieren API key, son públicas)
    UNSPLASH_TRAVEL_IDS = [
        'photo-1503220317375-aaad61436b1b', 'photo-1488646953014-c8cb2c610e75',
        'photo-1476514525535-07fb3b4ae5f1', 'photo-1500530855697-b586d89ba3ee',
        'photo-1469854523086-cc02fe5d8800', 'photo-1452421822248-d4c2b47f0c81',
        'photo-1507525428034-b723cf961d3e', 'photo-1530521954074-e64f6810b32d',
        'photo-1539635278303-d4002c07eae3', 'photo-1436491865332-7a61a109cc05',
        'photo-1508050919630-b135583b29ab', 'photo-1525625293386-3f8f99389edd',
        'photo-1520250497591-112f2f40a3f4', 'photo-1551882547-ff40c4a49f41',
        'photo-1566073771259-6a8506099945', 'photo-1582719508461-905c673771fd',
        'photo-1571896349842-33c89424de2d', 'photo-1542314831-068cd1dbfeeb',
        'photo-1455587734955-081b22074882', 'photo-1564501049412-61c2a3083791',
    ]

    @app.route('/api/get_image')
    def api_get_image():
        import hashlib, time
        query = request.args.get('query', '')
        limit = int(request.args.get('limit', 1))

        if not query:
            return jsonify({'urls': [f'https://images.unsplash.com/{UNSPLASH_TRAVEL_IDS[i % len(UNSPLASH_TRAVEL_IDS)]}?w=800&q=80&fit=crop' for i in range(limit)]})

        cache_key = f"{query}_{limit}"
        if cache_key in _image_cache:
            return jsonify({'urls': _image_cache[cache_key]})

        urls = []

        # 1. Intentar Wikimedia Commons primero (Sin rate limit, altamente confiable para monumentos)
        try:
            # Limpiar query de palabras clave genéricas para evitar dilución en búsqueda de Wikimedia
            clean_query = query.lower()
            for term in ['travel', 'photography', 'high quality', 'hd', '4k', 'beautiful', 'scenic', 'photo']:
                clean_query = clean_query.replace(term, '')
            clean_query = ' '.join(clean_query.split()).strip()

            wiki_url = 'https://commons.wikimedia.org/w/api.php'
            headers = {'User-Agent': 'TravelWishlyApp/1.0 (info@travelwishly.com)'}
            params = {
                'action': 'query',
                'generator': 'search',
                'gsrsearch': clean_query,
                'gsrnamespace': 6,
                'gsrlimit': limit,
                'prop': 'imageinfo',
                'iiprop': 'url',
                'format': 'json'
            }
            res = requests.get(wiki_url, params=params, headers=headers, timeout=5).json()
            pages = res.get('query', {}).get('pages', {})
            for page in pages.values():
                img_info = page.get('imageinfo', [])
                if img_info:
                    img_url = img_info[0].get('url')
                    if img_url and img_url not in urls:
                        urls.append(img_url)
            
            print(f"[WIKI SEARCH] Query: '{clean_query}' -> Encontradas {len(urls)} imágenes.")
        except Exception as e:
            print(f"[WIKI SEARCH ERROR] {query}: {e}")

        # 2. Si faltan imágenes, intentar DuckDuckGo como fallback secundario
        if len(urls) < limit:
            try:
                from duckduckgo_search import DDGS
                with DDGS() as ddgs:
                    remaining = limit - len(urls)
                    results = list(ddgs.images(query, max_results=remaining + 5))
                    trusted = ['unsplash.com', 'wikimedia.org', 'wikipedia.org', 'pexels.com',
                               'pixabay.com', 'staticflickr.com', 'imgur.com']
                    for img in results:
                        url = img.get('image', '')
                        if url and url not in urls and any(d in url for d in trusted):
                            urls.append(url)
                        if len(urls) >= limit:
                            break
            except Exception as e:
                print(f"[DDG SEARCH ERROR] {query}: {e}")

        # 3. Fallback de emergencia: Unsplash determinista con seed
        if len(urls) < limit:
            seed = int(hashlib.md5(query.encode()).hexdigest(), 16)
            for i in range(limit - len(urls)):
                idx = (seed + i) % len(UNSPLASH_TRAVEL_IDS)
                photo_id = UNSPLASH_TRAVEL_IDS[idx]
                w = 800 + (i % 3) * 100
                urls.append(f'https://images.unsplash.com/{photo_id}?w={w}&q=80&fit=crop&auto=format')

        _image_cache[cache_key] = urls[:limit]
        return jsonify({'urls': urls[:limit]})

    # =======================================================
    # NUEVOS MÓDULOS (SHARING & LEIA 2.0 AI)
    # =======================================================

    @app.route('/api/suggest_hotels', methods=['POST'])
    def suggest_hotels():
        """
        Backend para sugerir hoteles usando Inteligencia Artificial (Gemini).
        ¿Por qué usamos este backend en vez de llamar a Gemini desde el frontend (JS)?
        Porque si lo hacemos desde el JS, nuestra API KEY quedaría expuesta al público 
        y cualquiera podría robarla. Al hacerlo en Python, la llave está segura en el servidor.
        """
        gemini_key = os.environ.get('GEMINI_API_KEY', '').strip()
        if not gemini_key:
            return jsonify({'success': False, 'message': 'API Key no configurada'})

        data = request.get_json()
        destino = data.get('destino', '')
        if not destino:
            return jsonify({'success': False, 'message': 'Destino requerido'})

        # --------------------------------------------------------
        # INGENIERÍA DE PROMPTS (Prompt Engineering)
        # --------------------------------------------------------
        # Le damos instrucciones muy estrictas a la IA para que devuelva la 
        # información exactamente en el formato JSON que nuestro frontend necesita.
        # Esto evita que la IA responda con texto libre ("Hola, aquí tienes tus hoteles: ...")
        # que rompería nuestra aplicación.
        prompt = (
            f"Actua como un experto agente de viajes. Sugiere 3 opciones o zonas reales de hospedaje en {destino} "
            f"con estilos variados (Mochilero, Estandar, Lujo). "
            f"Devuelve la respuesta estrictamente en este formato JSON valido (un arreglo de 3 objetos), "
            f"sin texto adicional ni markdown de bloques de codigo:\n"
            f'[\n'
            f'  {{"nombre": "Nombre del hotel o zona", "estilo": "Mochilero/Estandar/Lujo", "precio": "Precio est. por noche", "razon": "Por que conviene hospedarse aqui (muy breve)"}}\n'
            f']'
        )

        try:
            import json
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 1024
                }
            }
            res = requests.post(url, json=payload, timeout=25)
            res_data = res.json()
            print(f"[HOTELS] Status: {res.status_code}")
            if 'candidates' in res_data and len(res_data['candidates']) > 0:
                txt = res_data['candidates'][0]['content']['parts'][0]['text']
                try:
                    txt = txt.strip()
                    txt = txt.replace('```json\n', '').replace('```json', '').replace('\n```', '').replace('```', '').strip()
                    start_idx = txt.find('[')
                    end_idx = txt.rfind(']')
                    if start_idx != -1 and end_idx != -1:
                        txt = txt[start_idx:end_idx+1]
                    hoteles = json.loads(txt)
                    return jsonify({'success': True, 'hoteles': hoteles})
                except Exception as ex:
                    print("Error JSON parse en hoteles:", ex, "TXT:", txt)
            else:
                print("suggest_hotels: no candidates:", res_data)
        except Exception as e:
            print("Error suggest_hotels:", e)

        # --------------------------------------------------------
        # SISTEMA DE FALLBACK (PLAN B)
        # --------------------------------------------------------
        # ¿Qué pasa si la API de Google falla, no hay internet, o se acaba nuestra cuota?
        # En vez de mostrarle un error feo al usuario, inyectamos estas zonas genéricas 
        # que funcionan para literalmente cualquier ciudad del mundo.
        # Esto garantiza la estabilidad de la app en producción.
        hoteles_fallback = [
            {"nombre": f"Zona Centro / Casco Histórico de {destino}", "estilo": "Estandar", "precio": "~$50-120 USD/noche", "razon": "Céntrico, fácil acceso a transporte y atracciones principales"},
            {"nombre": f"Área de Hostales / Budget Zone de {destino}", "estilo": "Mochilero", "precio": "~$15-35 USD/noche", "razon": "Ideal para viajeros con presupuesto, ambiente social y buenas conexiones"},
            {"nombre": f"Distrito Turístico / Hotel Zone de {destino}", "estilo": "Lujo", "precio": "~$150-350 USD/noche", "razon": "Zona premium con servicios completos, comodidad y seguridad garantizada"}
        ]
        return jsonify({'success': True, 'hoteles': hoteles_fallback, 'source': 'fallback'})

    @app.route('/api/seasonality', methods=['POST'])
    def seasonality():
        """Backend para análisis de temporadas y eventos usando Gemini"""
        gemini_key = os.environ.get('GEMINI_API_KEY', '').strip()
        if not gemini_key:
            return jsonify({'success': False, 'message': 'API Key no configurada'})
            
        data = request.get_json()
        destino = data.get('destino', '')
        mes = data.get('mes', '')
        
        if not destino:
            return jsonify({'success': False, 'message': 'Destino requerido'})
            
        contexto_fecha = f"El usuario planea viajar en el mes de {mes}." if mes else "El usuario quiere saber sobre las temporadas en general."
        
        prompt = (
            f"Actúa como un planificador de viajes experto. Analiza el destino '{destino}'. {contexto_fecha} "
            f"Proporciona información completa sobre las 3 temporadas de viaje: ALTA (cuando hay más turistas y precios altos), MEDIA (temporada intermedia con buen equilibrio), y BAJA (menos turistas y precios más económicos). "
            f"Incluye hasta 3 eventos/festividades famosas del lugar. "
            f"Devuelve la respuesta ESTRICTAMENTE en este formato JSON válido (un solo objeto), sin markdown ni texto extra:\n"
            f'{{\n'
            f'  "temporada": "ALTA/MEDIA/BAJA",\n'
            f'  "clima": "Breve descripción del clima actual",\n'
            f'  "razon": "Por qué es temporada alta/media/baja ahora (muy breve)",\n'
            f'  "temporada_alta_meses": "Meses de temporada alta (mayor turismo y precios altos)",\n'
            f'  "temporada_alta_razon": "Por qué es temporada alta (eventos, vacaciones, clima ideal)",\n'
            f'  "temporada_media_meses": "Meses de temporada media",\n'
            f'  "temporada_media_razon": "Por qué es temporada media (transición, clima variable, precios intermedios)",\n'
            f'  "temporada_baja_meses": "Meses de temporada baja",\n'
            f'  "temporada_baja_razon": "Por qué es temporada baja (clima, menos turistas, precios, etc.)",\n'
            f'  "eventos": ["Evento 1 (Mes)", "Evento 2 (Mes)"]\n'
            f'}}'
        )

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 800}
            }
            res = requests.post(url, json=payload, timeout=25)
            res_data = res.json()
            if 'candidates' in res_data and len(res_data['candidates']) > 0:
                import json
                txt = res_data['candidates'][0]['content']['parts'][0]['text']
                try:
                    txt = txt.strip()
                    txt = txt.replace('```json\n', '').replace('```json', '').replace('\n```', '').replace('```', '').strip()
                    start_idx = txt.find('{')
                    end_idx = txt.rfind('}')
                    if start_idx != -1 and end_idx != -1:
                        txt = txt[start_idx:end_idx+1]
                    datos = json.loads(txt)
                    # Asegurarse de que están todos los campos
                    if 'temporada' not in datos:
                        datos['temporada'] = 'MEDIA'
                    return jsonify({'success': True, 'data': datos})
                except Exception as ex:
                    print("[SEASONALITY] JSON parse error:", ex, "TXT:", txt)
            else:
                print("[SEASONALITY] No candidates in response:", res_data)
        except Exception as e:
            print("[SEASONALITY] Exception:", e)

        # ----------------------------------------------------------------
        # FALLBACK UNIVERSAL (¿Qué pasa si la IA falla?)
        # ----------------------------------------------------------------
        # Si Gemini se queda sin cuota o no responde, usamos este algoritmo matemático
        # que funciona para CUALQUIER país del mundo.
        # Usa el mes de viaje proporcionado por el usuario si está disponible,
        # o el mes actual del servidor como respaldo.
        import datetime as _dt
        d_lower = destino.lower()

        # Convertir el mes en texto al número correspondiente
        meses_map = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12
        }
        mes_viaje = meses_map.get(mes.lower().strip(), None) if mes else None
        mes_actual = mes_viaje if mes_viaje else _dt.datetime.now().month

        # ----------------------------------------------------------------
        # OVERRIDES ESPECÍFICOS POR PAÍS (antes de la lógica genérica)
        # Para destinos con temporadas que no siguen el patrón hemisférico estándar
        # ----------------------------------------------------------------
        override_temporada = None
        override_clima = None
        override_razon = None

        # JAPÓN: Temporada ALTA en primavera (Sakura) y otoño (Koyo/Momiji)
        if any(x in d_lower for x in ['japón', 'japon', 'japan', 'tokyo', 'tokio', 'kyoto', 'kioto', 'osaka', 'hiroshima', 'nara']):
            if mes_actual in [3, 4]:  # Sakura (flores de cerezo)
                override_temporada = 'ALTA'
                override_clima = 'Primavera — temporada de Sakura (flores de cerezo), clima ideal entre 10-18°C'
                override_razon = 'TEMPORADA ALTA por Sakura: las flores de cerezo (marzo-abril) atraen millones de turistas. Hoteles con meses de anticipación y precios al máximo'
            elif mes_actual in [10, 11]:  # Koyo / Momiji (foliaje otoñal)
                override_temporada = 'ALTA'
                override_clima = 'Otoño — temporada de Koyo (foliaje otoñal rojo/dorado), clima fresco entre 12-20°C'
                override_razon = 'TEMPORADA ALTA por Koyo: el foliaje otoñal (octubre-noviembre) es tan popular como el Sakura. Alta demanda, precios elevados y parques llenos de colores'
            elif mes_actual in [7, 8]:  # Verano caluroso y húmedo
                override_temporada = 'ALTA'
                override_clima = 'Verano caluroso y húmedo — hasta 35°C con alta humedad. Temporada de festivales (matsuri)'
                override_razon = 'Temporada alta por vacaciones de verano y festivales tradicionales (Obon, Gion Matsuri). Calor intenso pero gran ambiente cultural'
            elif mes_actual in [12, 1, 2]:  # Invierno
                override_temporada = 'BAJA'
                override_clima = 'Invierno frío — nieve en regiones del norte. Ideal para onsen y esquí en Hokkaido'
                override_razon = 'Temporada baja: menos turistas y mejores precios, excepto en destinos de esquí. Excelente para onsen (baños termales) y experiencias de invierno'

        # TAILANDIA / BALI / SUDESTE ASIÁTICO: temporada seca = ALTA
        elif any(x in d_lower for x in ['tailandia', 'thailand', 'bangkok', 'phuket', 'bali', 'indonesia', 'vietnam', 'camboya', 'cambodia']):
            if mes_actual in [11, 12, 1, 2, 3]:  # Temporada seca = alta turística
                override_temporada = 'ALTA'
                override_clima = 'Temporada seca — clima soleado y fresco, ideal para playas y templos'
                override_razon = 'Temporada alta: clima seco y agradable (noviembre-marzo). Máxima afluencia turística y precios elevados'
            elif mes_actual in [6, 7, 8, 9, 10]:  # Monzón = temporada baja
                override_temporada = 'BAJA'
                override_clima = 'Temporada de monzones — lluvias frecuentes y humedad alta'
                override_razon = 'Temporada baja por monzones: lluvias diarias aunque cortas. Precios más bajos y menos turistas. Las playas pueden estar cerradas'

        # INDIA: invierno = alta temporada (octubre-marzo)
        elif any(x in d_lower for x in ['india', 'delhi', 'mumbai', 'rajasthan', 'goa', 'kerala']):
            if mes_actual in [10, 11, 12, 1, 2, 3]:
                override_temporada = 'ALTA'
                override_clima = 'Invierno indio — clima seco y agradable, ideal para visitar templos y ciudades históricas'
                override_razon = 'Temporada alta en India: el invierno (octubre-marzo) ofrece el mejor clima para viajar. Evita el calor extremo y los monzones'
            elif mes_actual in [4, 5]:
                override_temporada = 'BAJA'
                override_clima = 'Pre-monzón — calor extremo de hasta 45°C en el norte'
                override_razon = 'Temporada baja: calor extremo antes de los monzones. Precios bajos pero condiciones muy exigentes'

        # Paises/regiones del hemisferio SUR (estaciones invertidas)
        hemisferio_sur = any(x in d_lower for x in [
            'argentina', 'chile', 'australia', 'nueva zelanda', 'new zealand',
            'sudafrica', 'south africa', 'brasil', 'brazil', 'uruguay',
            'paraguay', 'bolivia', 'peru', 'ecuador',
            'mozambique', 'zimbabwe', 'zambia', 'madagascar', 'namibia',
            'angola', 'botswana', 'lesotho', 'eswatini', 'swaziland',
            'papua nueva guinea', 'papua new guinea', 'fiji', 'tonga', 'samoa'
        ])

        # Usar override si existe, de lo contrario usar lógica genérica por hemisferio
        if override_temporada:
            temporada_fb = override_temporada
            clima_fb = override_clima
            razon_fb = override_razon
            mejor_fb = 'Marzo-Abril (Sakura) y Octubre-Noviembre (Koyo)' if any(x in d_lower for x in ['japón', 'japon', 'japan']) else 'Noviembre a Marzo (temporada seca)'
        else:
            # Si es hemisferio sur, desplazamos 6 meses para invertir la logica
            mes_calc = mes_actual if not hemisferio_sur else ((mes_actual + 5) % 12 + 1)

            if mes_calc in [6, 7, 8]:
                temporada_fb = 'ALTA'
                clima_fb = 'Verano — dias calidos y soleados con alta afluencia turistica'
                razon_fb = 'Temporada de verano con alta demanda y precios elevados'
                mejor_fb = 'Junio a Agosto' if not hemisferio_sur else 'Diciembre a Febrero'
            elif mes_calc in [12, 1]:
                temporada_fb = 'ALTA'
                clima_fb = 'Festividades de fin de ano — clima invernal festivo'
                razon_fb = 'Vacaciones de Navidad y Ano Nuevo generan alta demanda turistica'
                mejor_fb = 'Junio a Agosto' if not hemisferio_sur else 'Diciembre a Febrero'
            elif mes_calc in [4, 5, 9, 10]:
                temporada_fb = 'MEDIA'
                clima_fb = 'Primavera/Otono — clima agradable con menos multitudes'
                razon_fb = 'Temporada intermedia: buen clima y precios mas accesibles que en verano'
                mejor_fb = 'Junio a Agosto' if not hemisferio_sur else 'Diciembre a Febrero'
            else:  # 2, 3, 11
                temporada_fb = 'BAJA'
                clima_fb = 'Invierno — temporada tranquila con tarifas mas economicas'
                razon_fb = 'Temporada baja: menos turistas y precios economicos ideales para presupuesto ajustado'
                mejor_fb = 'Junio a Agosto' if not hemisferio_sur else 'Diciembre a Febrero'

        t_baja  = 'Noviembre, Enero, Febrero, Marzo' if not hemisferio_sur else 'Mayo, Junio, Julio'
        t_media = 'Abril, Mayo, Septiembre, Octubre' if not hemisferio_sur else 'Octubre, Noviembre, Marzo'
        t_alta  = 'Junio, Julio, Agosto, Diciembre' if not hemisferio_sur else 'Diciembre, Enero, Febrero'

        datos_fallback = {
            'temporada': temporada_fb,
            'clima': clima_fb,
            'razon': razon_fb,
            'temporada_alta_meses': t_alta,
            'temporada_alta_razon': 'Mayor afluencia turística, precios elevados y alta demanda de reservaciones',
            'temporada_media_meses': t_media,
            'temporada_media_razon': 'Primavera y otoño — clima agradable con precios intermedios y afluencia moderada de turistas',
            'temporada_baja_meses': t_baja,
            'temporada_baja_razon': 'Menor afluencia turistica y precios mas economicos — ideal para viajeros con presupuesto ajustado',
            'eventos': [
                'Festividades y ferias locales (consultar agenda cultural del destino)',
                'Mercados artesanales y eventos regionales',
                'Gastronomia y cultura local todo el ano'
            ]
        }
        return jsonify({'success': True, 'data': datos_fallback, 'source': 'fallback'})

    @app.route('/api/phrases', methods=['POST'])
    def survival_phrases():
        """Genera frases de supervivencia para un destino"""
        gemini_key = os.environ.get('GEMINI_API_KEY', '').strip()
        if not gemini_key:
            return jsonify({'success': False})
            
        data = request.get_json()
        destino = data.get('destino', '')
        if not destino:
            return jsonify({'success': False})
            
        prompt = (
            f"You are a JSON generator. Given the travel destination '{destino}', "
            f"identify the 2 main spoken languages there. "
            f"If it's a Spanish-speaking country/city, use Spanish as lang 1 and English as lang 2. "
            f"Translate these 6 phrases into both languages: "
            f"Hola, Gracias, Disculpe, Dónde está el baño, Ayuda, La cuenta por favor. "
            f"Reply ONLY with a valid JSON array, no extra text, no markdown. Example format:\n"
            f'[{{"idioma":"Español","lang_code":"es-MX","phrases":[{{"es":"Hola","local":"¡Hola!"}},{{"es":"Gracias","local":"Gracias"}}]}},{{"idioma":"English","lang_code":"en-US","phrases":[{{"es":"Hola","local":"Hello"}},{{"es":"Gracias","local":"Thank you"}}]}}]\n'
            f"Now generate the full 6-phrase array for both languages of '{destino}':"
        )
        
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}
            }
            res = requests.post(url, json=payload, timeout=20)
            res_data = res.json()
            print(f"[PHRASES] Status: {res.status_code}")
            if 'candidates' in res_data and len(res_data['candidates']) > 0:
                txt = res_data['candidates'][0]['content']['parts'][0]['text']
                import json
                print(f"[PHRASES] Raw response: {txt[:300]}")
                txt = txt.strip()
                txt = txt.replace('```json\n', '').replace('```json', '').replace('\n```', '').replace('```', '').strip()
                start_idx = txt.find('[')
                end_idx = txt.rfind(']')
                if start_idx != -1 and end_idx != -1:
                    txt = txt[start_idx:end_idx+1]
                try:
                    datos = json.loads(txt)
                    # Traducir los nombres de los idiomas al español
                    dict_tr = {
                        'arabic': 'Árabe',
                        'berber': 'Bereber',
                        'french': 'Francés',
                        'spanish': 'Español',
                        'english': 'Inglés',
                        'japanese': 'Japonés',
                        'italian': 'Italiano',
                        'german': 'Alemán',
                        'portuguese': 'Portugués',
                        'dutch': 'Neerlandés',
                        'thai': 'Tailandés',
                        'vietnamese': 'Vietnamita',
                        'chinese': 'Chino',
                        'korean': 'Coreano',
                        'russian': 'Ruso',
                        'hindi': 'Hindi',
                        'bengali': 'Bengalí',
                        'punjabi': 'Panyabí',
                        'indonesian': 'Indonesio',
                        'javanese': 'Javanés',
                        'icelandic': 'Islandés',
                        'czech': 'Checo',
                        'tahitian': 'Tahitiano',
                        'greek': 'Griego',
                        'turkish': 'Turco',
                        'polish': 'Polaco',
                        'swedish': 'Sueco',
                        'norwegian': 'Noruego',
                        'danish': 'Danés',
                        'finnish': 'Finés',
                        'hebrew': 'Hebreo',
                        'urdu': 'Urdu',
                        'persian': 'Persa',
                        'swahili': 'Suajili',
                        'catalan': 'Catalán',
                        'galician': 'Gallego',
                        'basque': 'Vasco',
                        'quechua': 'Quechua',
                        'aymara': 'Aimara',
                        'guarani': 'Guaraní'
                    }
                    if isinstance(datos, list):
                        for item in datos:
                            if isinstance(item, dict) and 'idioma' in item:
                                val = item['idioma'].strip().lower()
                                if val in dict_tr:
                                    item['idioma'] = dict_tr[val]
                    return jsonify({'success': True, 'data': datos})
                except Exception as parse_err:
                    print(f"[PHRASES] JSON parse error: {parse_err} | TXT: {txt[:200]}")
            else:
                print(f"[PHRASES] No candidates in response: {res_data}")
        except Exception as e:
            print(f"[PHRASES] Exception: {e}")

        # --- FALLBACK GARANTIZADO: frases por idioma detectado ---
        d = destino.lower()
        en_phrases = [{"es":"Hola","local":"Hello"},{"es":"Gracias","local":"Thank you"},{"es":"Disculpe","local":"Excuse me"},{"es":"¿Dónde está el baño?","local":"Where is the restroom?"},{"es":"Ayuda","local":"Help!"},{"es":"La cuenta por favor","local":"Check, please"}]
        es_phrases = [{"es":"Hola","local":"Hola"},{"es":"Gracias","local":"Gracias"},{"es":"Disculpe","local":"Disculpe"},{"es":"¿Dónde está el baño?","local":"¿Dónde está el baño?"},{"es":"Ayuda","local":"Ayuda"},{"es":"La cuenta por favor","local":"La cuenta por favor"}]

        if any(x in d for x in ['japan','japon','tokyo','osaka']):
            langs = [{"idioma":"Japonés","lang_code":"ja-JP","phrases":[{"es":"Hola","local":"Konnichiwa"},{"es":"Gracias","local":"Arigatou"},{"es":"Disculpe","local":"Sumimasen"},{"es":"¿Dónde está el baño?","local":"Toire wa doko desu ka?"},{"es":"Ayuda","local":"Tasukete!"},{"es":"La cuenta por favor","local":"Okaikei onegaishimasu"}]},{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases}]
        elif any(x in d for x in ['france','paris','francais','senegal','cameroon','cameroun','cote','haiti','belgium']):
            langs = [{"idioma":"Francés","lang_code":"fr-FR","phrases":[{"es":"Hola","local":"Bonjour"},{"es":"Gracias","local":"Merci"},{"es":"Disculpe","local":"Excusez-moi"},{"es":"¿Dónde está el baño?","local":"Où sont les toilettes?"},{"es":"Ayuda","local":"Au secours!"},{"es":"La cuenta por favor","local":"L'addition s'il vous plaît"}]},{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases}]
        elif any(x in d for x in ['brazil','brasil','portugal','angola']):
            langs = [{"idioma":"Português","lang_code":"pt-BR","phrases":[{"es":"Hola","local":"Olá"},{"es":"Gracias","local":"Obrigado/a"},{"es":"Disculpe","local":"Desculpe"},{"es":"¿Dónde está el baño?","local":"Onde fica o banheiro?"},{"es":"Ayuda","local":"Socorro!"},{"es":"La cuenta por favor","local":"A conta por favor"}]},{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases}]
        elif any(x in d for x in ['italy','italia','rome','milan','venice']):
            langs = [{"idioma":"Italiano","lang_code":"it-IT","phrases":[{"es":"Hola","local":"Ciao"},{"es":"Gracias","local":"Grazie"},{"es":"Disculpe","local":"Mi scusi"},{"es":"¿Dónde está el baño?","local":"Dov'è il baño?"},{"es":"Ayuda","local":"Aiuto!"},{"es":"La cuenta por favor","local":"Il conto per favore"}]},{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases}]
        elif any(x in d for x in ['germany','austria','berlin','munich','deutsch']):
            langs = [{"idioma":"Alemán","lang_code":"de-DE","phrases":[{"es":"Hola","local":"Hallo"},{"es":"Gracias","local":"Danke"},{"es":"Disculpe","local":"Entschuldigung"},{"es":"¿Dónde está el baño?","local":"Wo ist die Toilette?"},{"es":"Ayuda","local":"Hilfe!"},{"es":"La cuenta por favor","local":"Die Rechnung bitte"}]},{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases}]
        elif any(x in d for x in ['china','beijing','shanghai','guangzhou']):
            langs = [{"idioma":"Chino","lang_code":"zh-CN","phrases":[{"es":"Hola","local":"Nǐ hǎo"},{"es":"Gracias","local":"Xièxiè"},{"es":"Disculpe","local":"Duìbuqǐ"},{"es":"¿Dónde está el baño?","local":"Xǐshǒujiān zài nǎlǐ?"},{"es":"Ayuda","local":"Jiùmìng!"},{"es":"La cuenta por favor","local":"Mǎidān"}]},{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases}]
        elif any(x in d for x in ['morocco', 'marruecos', 'marrakech', 'rabat', 'morroco']):
            langs = [
                {
                    "idioma": "Árabe",
                    "lang_code": "ar-MA",
                    "phrases": [
                        {"es": "Hola", "local": "السلام عليكم (Salam Alaykum)"},
                        {"es": "Gracias", "local": "شكراً (Shukran)"},
                        {"es": "Disculpe", "local": "عذراً (Adhran)"},
                        {"es": "¿Dónde está el baño?", "local": "أين الحمام؟ (Ayna al-hammam?)"},
                        {"es": "Ayuda", "local": "مساعدة (Musa'adah)"},
                        {"es": "La cuenta por favor", "local": "الحساب من فضلك (Al-hisab min fadlik)"}
                    ]
                },
                {
                    "idioma": "Bereber",
                    "lang_code": "ber",
                    "phrases": [
                        {"es": "Hola", "local": "Azul"},
                        {"es": "Gracias", "local": "Tanmirt"},
                        {"es": "Disculpe", "local": "Surfegh"},
                        {"es": "¿Dónde está el baño?", "local": "Mani gh illa Lbit lma?"},
                        {"es": "Ayuda", "local": "Tiwwisi"},
                        {"es": "La cuenta por favor", "local": "Lfetura, afak"}
                    ]
                }
            ]
        elif any(x in d for x in ['united states','usa','england','australia','canada','new zealand','ireland','uk','nigeria','ghana','kenya','south africa']):
            langs = [{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases},{"idioma":"Español","lang_code":"es-MX","phrases":es_phrases}]
        else:
            # Genérico: español + inglés
            langs = [{"idioma":"Español","lang_code":"es-MX","phrases":es_phrases},{"idioma":"Inglés","lang_code":"en-US","phrases":en_phrases}]

        return jsonify({'success': True, 'data': langs, 'source': 'fallback'})


    @app.route('/shared/<token>')
    def shared_itinerary(token):
        """Módulo Compartición: Ver viaje de modo solo lectura usando token unico."""
        ruta = SavedRoute.query.filter_by(share_token=token).first_or_404()
        import json
        pasos = []
        if ruta.itinerary_state:
            try:
                pasos = json.loads(ruta.itinerary_state)
            except Exception:
                pasos = []
        return render_template('shared_itinerary.html', ruta=ruta, pasos=pasos)

    @app.route('/api/gemini_chat', methods=['POST'])
    def gemini_chat():
        """Backend Leia 2.0 — usa HTTP REST a Gemini (compatible con free tier)."""
        gemini_key = os.environ.get('GEMINI_API_KEY', '').strip()
        if not gemini_key:
            return jsonify({'reply': '⚠️ Hola! Para que Leia pueda ayudarte necesito que el administrador configure la clave de inteligencia artificial (GEMINI_API_KEY) en el servidor. 🐾'})

        data = request.get_json()
        user_message = data.get('message', '')
        contexto = data.get('contexto', 'Navegando TravelWishly')

        system_instruction = (
            f"Eres Leia, una asistente virtual de viajes amigable y profesional, diseñada exclusivamente para TravelWishly. "
            f"Personalidad: cálida, empática y servicial. Ocasionalmente puedes usar un emoji de gata (🐾). "
            f"Contexto actual del usuario: '{contexto}'. "
            f"ESTRUCTURA DE TRAVELWISHLY: Los menús superiores son 'Inicio', 'Explorar' (para ver el globo y destinos), "
            f"'Presupuesto' (para calcular costos), 'Itinerario' (rutas), 'Financiamiento' (planes de ahorro) e 'Historial' (donde se guardan los viajes). "
            f"IMPORTANTE: No inventes iconos (como corazones) o secciones que no existen. Tus respuestas deben ser exactas, amigables, cortas (máx 80 palabras) en español y sin dar rodeos. "
            f"Usa formato Markdown solo cuando sea útil (listas, negritas)."
        )

        # Mensaje combinado: instruccion de sistema + pregunta del usuario
        full_prompt = f"{system_instruction}\n\nUsuario: {user_message}"

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": full_prompt}]}],
                "generationConfig": {
                    "temperature": 0.5,
                    "maxOutputTokens": 2048
                }
            }
            res = requests.post(url, json=payload, timeout=30)
            res_data = res.json()

            if 'candidates' in res_data and len(res_data['candidates']) > 0:
                txt = res_data['candidates'][0]['content']['parts'][0]['text']
                return jsonify({'reply': txt})
            else:
                print(f"[API GEMINI ERROR] {res_data}")
                err_msg = res_data.get('error', {}).get('message', 'Sin respuesta del modelo.')
                if 'quota' in err_msg.lower() or '429' in str(res.status_code):
                    return jsonify({'reply': '🐾 Estoy recibiendo muchas consultas en este momento. Espera un par de minutos e inténtalo de nuevo, ¿de acuerdo?'})
                return jsonify({'reply': f'🐾 No pude obtener respuesta: {err_msg}'})
        except requests.exceptions.Timeout:
            return jsonify({'reply': '🐾 Mi conexión tardó demasiado. Por favor inténtalo de nuevo en un momento.'})
        except Exception as e:
            return jsonify({'reply': '🐾 Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.'})

    return app

def get_all_local_ips_with_names():
    """
    Obtiene todas las IPs locales activas con el nombre de red WiFi (SSID) o alias de interfaz.
    Usa PowerShell + netsh wlan en Windows para identificar la red de cada IP.
    """
    import socket, subprocess, re, json

    ip_to_label = {}

    # ─── Paso 1: PowerShell → alias de interfaz por IP ───────────────────────
    try:
        ps_cmd = (
            'Get-NetIPAddress -AddressFamily IPv4 | '
            'Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | '
            'Select-Object InterfaceAlias, IPAddress | ConvertTo-Json'
        )
        raw = subprocess.check_output(
            ['powershell', '-NoProfile', '-Command', ps_cmd],
            encoding='utf-8', errors='replace',
            creationflags=0x08000000  # CREATE_NO_WINDOW
        )
        data = json.loads(raw.strip())
        if isinstance(data, dict):
            data = [data]
        for item in data:
            ip    = (item.get('IPAddress')     or '').strip()
            alias = (item.get('InterfaceAlias') or 'Red').strip()
            if ip:
                ip_to_label[ip] = alias
    except Exception:
        pass

    # ─── Paso 2: netsh wlan → SSID por alias de adaptador WiFi ───────────────
    alias_to_ssid = {}
    try:
        wlan_raw = subprocess.check_output(
            ['netsh', 'wlan', 'show', 'interfaces'],
            encoding='utf-8', errors='replace',
            creationflags=0x08000000
        )
        cur_name = None
        for line in wlan_raw.splitlines():
            # Detectar nombre del adaptador (ej: "Wi-Fi", "Wi-Fi 2")
            m_name = re.search(r'^\s+(?:Nombre|Name)\s*:\s*(.+)', line)
            if m_name:
                cur_name = m_name.group(1).strip()
            # Detectar SSID (línea "SSID", no "BSSID")
            m_ssid = re.match(r'^\s+SSID\s+:\s+(.+)', line)
            if m_ssid and cur_name:
                ssid = m_ssid.group(1).strip()
                if ssid:
                    alias_to_ssid[cur_name] = ssid
                    cur_name = None          # reset para el siguiente adaptador
    except Exception:
        pass

    # ─── Paso 3: enriquecer labels con el SSID cuando coincidan ──────────────
    for ip, alias in list(ip_to_label.items()):
        # Coincidencia exacta de alias
        if alias in alias_to_ssid:
            ip_to_label[ip] = f'📶 WiFi: {alias_to_ssid[alias]}'
        else:
            # Coincidencia parcial (ej: "Wi-Fi 2" contiene "Wi-Fi")
            for k, ssid in alias_to_ssid.items():
                if k.lower() in alias.lower() or alias.lower() in k.lower():
                    ip_to_label[ip] = f'📶 WiFi: {ssid}'
                    break

    # ─── Paso 4: fallback si PowerShell no funcionó ──────────────────────────
    if not ip_to_label:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            ip_to_label[ip] = 'Red principal'
        except Exception:
            ip_to_label['127.0.0.1'] = 'Localhost'

    return [(ip, label) for ip, label in sorted(ip_to_label.items())]

def open_browser(local_url):
    webbrowser.open_new(local_url)

if __name__ == '__main__':
    aplicacion = create_app()
    
    # Obtener todas las IPs locales activas con nombre de red
    redes = get_all_local_ips_with_names()
    primary_url = f"http://{redes[0][0]}:5000/"
    
    # Generar un QR por cada red encontrada
    try:
        import qrcode
        print("\n" + "="*58)
        print(f"🌍   TRAVELWISHLY DISPONIBLE EN TU RED LOCAL   🌍")
        print("="*58)
        if len(redes) > 1:
            print(f"   ✅ Se detectaron {len(redes)} interfaces de red activas.")
            print("   👉 Usa el QR de la red a la que está conectado tu celular.\n")
        else:
            print("   👉 Escanea el QR para entrar desde tu celular:\n")

        for ip, label in redes:
            url = f"http://{ip}:5000/"
            qr = qrcode.QRCode(border=2)
            qr.add_data(url)
            qr.make(fit=True)
            print(f"  {label}")
            print(f"  IP: {ip}  →  {url}")
            print("-"*48)
            qr.print_ascii(invert=True)
            print()
        
        print("="*58)
        print("💡 CONSEJO — Si tu celular está en una red distinta:")
        print("   Intenta escanear el QR de otra red de la lista.")
        print("   Las redes NETGEAR y el módem pueden ser subredes")
        print("   distintas — el celular solo accede a la misma.")
        print("="*58 + "\n")
    except ImportError:
        print(f"\n🌍 TravelWishly disponible en:")
        for ip, label in redes:
            print(f"   → http://{ip}:5000/  ({label})")
        print()

    # Abre la PC directamente con la primera IP encontrada
    threading.Timer(1.5, open_browser, args=[primary_url]).start()
    
    # Correr servidor escuchando en todas las interfaces (0.0.0.0)
    aplicacion.run(host='0.0.0.0', debug=True, port=5000, use_reloader=False)

