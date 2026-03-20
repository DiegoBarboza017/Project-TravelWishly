"""
TravelWishly - Lógica principal del servidor web (Flask)
Estructura según lineamientos de calidad para mantenibilidad (ISO/IEC 25010)
"""
import os
from flask import Flask, render_template, request, redirect, url_for, flash, session
from database import db
import threading
import webbrowser
from models import User, TripBudget, DestinationGuide

# Módulo de Inicialización - Contribución inicial por Diego Barboza
def create_app():
    app = Flask(__name__)
    
    # Configuración de seguridad y base de datos (PostgreSQL)
    # Recomendación: Utilizar variables de entorno en producción.
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secr3t_travelwishly_k3y_for_dev')
    # Use SQLite by default for easy local execution without needing PostgreSQL setup
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///travelwishly.db')
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
            # Integrar aquí la lógica de extracción de datos (request.form)
            # y alta en base de datos.
            flash('🚀 ¡Bienvenido! Tu cuenta ha sido creada exitosamente.', 'success')
            return redirect(url_for('login'))
        return render_template('registro.html')

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        """Módulo de Usuario: Autenticación seguro"""
        if request.method == 'POST':
            # Integrar la validación y session setup.
            flash('Sesión iniciada correctamente.', 'success')
            return redirect(url_for('dashboard'))
        return render_template('login.html')

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
