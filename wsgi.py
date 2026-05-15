"""
Punto de entrada WSGI para Render.com y PythonAnywhere.
Render usa gunicorn para servir la app, este archivo expone la instancia.
"""
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run()
