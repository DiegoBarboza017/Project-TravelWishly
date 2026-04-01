"""
Definición de tablas (Modelos) para PostgreSQL utilizando SQLAlchemy
Se cumplen las especificaciones de: Usuarios, Presupuestos y Destinos.
"""
from database import db

from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relación con presupuestos
    budgets = db.relationship('TripBudget', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class TripBudget(db.Model):
    __tablename__ = 'trip_budgets'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    destination = db.Column(db.String(100), nullable=False)
    annual_income = db.Column(db.Float, nullable=False)
    savings_capacity = db.Column(db.Float, nullable=False)
    target_budget = db.Column(db.Float, nullable=False)
    
    # Desglose de gastos
    estimated_transport = db.Column(db.Float)
    estimated_lodging = db.Column(db.Float)
    estimated_food = db.Column(db.Float)
    estimated_extras = db.Column(db.Float)

class DestinationGuide(db.Model):
    __tablename__ = 'destination_guides'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    country = db.Column(db.String(100))
    cultural_info = db.Column(db.Text)
    places_to_visit = db.Column(db.Text)
    things_to_do = db.Column(db.Text)
    areas_to_avoid = db.Column(db.Text)

class SavedRoute(db.Model):
    __tablename__ = 'saved_routes'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    origen = db.Column(db.String(100), nullable=False)
    destino = db.Column(db.String(100), nullable=False)
    duracion_dias = db.Column(db.Integer, nullable=False)
    fecha_ideal = db.Column(db.String(50))
    mochila_state = db.Column(db.Text)
    vibes_state = db.Column(db.Text)
    packing_state = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SavingsReminder(db.Model):
    """Plan de ahorro mensual con recordatorios por correo electrónico"""
    __tablename__ = 'savings_reminders'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    destination = db.Column(db.String(100), nullable=False)
    monthly_amount = db.Column(db.Float, nullable=False)
    total_months = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(10), nullable=False, default='MXN')
    currency_symbol = db.Column(db.String(10), nullable=False, default='$')
    start_date = db.Column(db.DateTime, default=datetime.utcnow)
    next_reminder = db.Column(db.DateTime, nullable=False)
    reminders_sent = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    user = db.relationship('User', backref=db.backref('savings_reminders', lazy=True))









