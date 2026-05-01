@echo off
:: Ir a la carpeta exacta del proyecto
cd /d "c:\Tec\6to Semestre\Ingenieria De Software\Proyecto TravelWhisly"

:: Activar el entorno virtual
call .\venv\Scripts\activate.bat

:: Ejecutar la aplicacion
python app.py

:: Evitar que la ventana negra se cierre sola si hay un error
pause
