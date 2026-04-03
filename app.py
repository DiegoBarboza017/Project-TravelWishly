"""
TravelWishly - Lógica principal del servidor web (Flask)
Estructura según lineamientos de calidad para mantenibilidad (ISO/IEC 25010)
"""
import os
import uuid
import requests
from flask import Flask, render_template, request, redirect, url_for, flash, session
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Mail, Message
from database import db
import threading
import webbrowser
from models import User, TripBudget, DestinationGuide, SavedRoute, SavingsReminder
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from flask import jsonify
from apscheduler.schedulers.background import BackgroundScheduler

# === OpenWeather API Key (cambiar por la tuya en openweathermap.org) ===
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '7bc4ccdffadb356912aeb175eb943099')

# Módulo de Inicialización - Contribución inicial por Diego Barboza
def create_app():
    app = Flask(__name__)
    
    # Configuración de seguridad y base de datos (PostgreSQL)
    # Recomendación: Utilizar variables de entorno en producción.
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secr3t_travelwishly_k3y_for_dev')

    # Configuración de Flask-Mail
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = 'travelwishly.bot@gmail.com'
    app.config['MAIL_PASSWORD'] = 'crdudnuprbwngito'
    app.config['MAIL_DEFAULT_SENDER'] = 'travelwishly.bot@gmail.com'
    mail = Mail(app)

    # ============================================================
    # SCHEDULER DE RECORDATORIOS DE AHORRO EN SEGUNDO PLANO
    # ============================================================
    def enviar_recordatorios_ahorro():
        """Job que revisa y envía recordatorios de ahorro mensuales pendientes"""
        with app.app_context():
            try:
                ahora = datetime.utcnow()
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

    # Iniciar scheduler (solo una vez, evitando doble arranque en modo debug)
    if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        scheduler = BackgroundScheduler()
        scheduler.add_job(enviar_recordatorios_ahorro, 'interval', hours=1, id='savings_reminder_job')
        scheduler.start()
        print("[SCHEDULER] APScheduler iniciado — revisando recordatorios cada hora.")

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
                return redirect(url_for('index'))
            else:
                flash('Credenciales incorrectas.', 'error')
                return redirect(url_for('login'))
                
        return render_template('login.html')

    @app.route('/magic-login', methods=['POST'])
    def magic_login():
        """Módulo de Autenticación sin contraseña (Vía Email Seguro)"""
        email = request.form.get('google_email')
        if not email or '@' not in email:
            flash('Por favor, ingresa un correo válido.', 'error')
            return redirect(url_for('login'))
        
        s = get_reset_serializer()
        token = s.dumps(email, salt='magic-link-salt')
        magic_link = url_for('magic_auth', token=token, _external=True)
        
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
            flash('Hubo un error enviando tu enlace de acceso. Intenta de nuevo más tarde.', 'error')
            
        return redirect(url_for('login'))

    @app.route('/magic-auth/<token>')
    def magic_auth(token):
        """Valida el enlace e inicia sesión (o registra) automáticamente"""
        s = get_reset_serializer()
        try:
            email = s.loads(token, salt='magic-link-salt', max_age=900) # Expira en 15 mins
        except:
            flash('El enlace de acceso es inválido o ha expirado.', 'error')
            return redirect(url_for('login'))
            
        user = User.query.filter_by(email=email).first()
        is_new_user = False
        if not user:
            # Registro automático
            username_base = email.split('@')[0]
            user = User(username=username_base, email=email, password_hash=generate_password_hash(uuid.uuid4().hex))
            db.session.add(user)
            db.session.commit()
            is_new_user = True
            
        session['user_id'] = user.id
        session['username'] = user.username
        session['user_email'] = user.email
        session.permanent = False
        session['expires_at'] = (datetime.now() + timedelta(minutes=60)).timestamp()
        
        if is_new_user:
            flash('¡Cuenta creada exitosamente! Bienvenido/a a TravelWishly.', 'success')
        else:
            flash(f'¡Bienvenido de nuevo, {user.username}!', 'success')
        
        # En vez de llevarnos al Dashboard en esta nueva pestaña molesta, 
        # mostramos una página limplia de éxito que se auto-cerrará.
        return render_template('magic_success.html')

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
        destino_inicial = request.args.get('q', '').strip()
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

            # ── Enviar email de resumen del viaje ────────────────────────────
            try:
                from flask_mail import Message
                usuario = User.query.get(session['user_id'])
                if usuario and usuario.email:
                    origen_txt      = data.get('origen', '—')
                    destino_txt     = data.get('destino', '—')
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

        ahora = datetime.utcnow()
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

    @app.route('/api/check_session')
    def api_check_session():
        """Polling route para que el JS sepa si el usuario fue autenticado exitosamente en otra pestaña"""
        if 'user_id' in session and 'username' in session:
            return jsonify({'logged_in': True, 'username': session['username']})
        return jsonify({'logged_in': False})

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

