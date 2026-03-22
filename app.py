"""
TravelWishly - Lógica principal del servidor web (Flask)
Estructura según lineamientos de calidad para mantenibilidad (ISO/IEC 25010)
"""
import os
import uuid
from flask import Flask, render_template, request, redirect, url_for, flash, session
from itsdangerous import URLSafeTimedSerializer
from database import db
import threading
import webbrowser
from models import User, TripBudget, DestinationGuide
from werkzeug.security import generate_password_hash, check_password_hash

# Módulo de Inicialización - Contribución inicial por Diego Barboza
def create_app():
    app = Flask(__name__)
    
    # Configuración de seguridad y base de datos (PostgreSQL)
    # Recomendación: Utilizar variables de entorno en producción.
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secr3t_travelwishly_k3y_for_dev')

    # Use SQLite by default for easy local execution without needing PostgreSQL setup
  # Configuración para MySQL Local
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:DBserver.17!@localhost/TravelWishly_db'

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Inicialización de la Base de Datos
    db.init_app(app)

    # ==========================
    # RUTAS DE LA APLICACIÓN
    # ==========================

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
                # Mantener sesión iniciada
                if request.form.get('rememberMe'):
                    session.permanent = True
                else:
                    session.permanent = False
                    
                session['user_id'] = user.id
                session['username'] = user.username
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

    # Instanciación automática de las tablas para ambiente de desarrollo local
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            print(f"Aviso de BD: {e}")

    return app

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000/")

if __name__ == '__main__':
    aplicacion = create_app()
    threading.Timer(1.25, open_browser).start()
    aplicacion.run(debug=True, port=5000, use_reloader=False)
