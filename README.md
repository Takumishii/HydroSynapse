# HydroSynapse
Un proyecto para avanzar con el otro proyecto: Sistema de Cálculo de Nutrientes del Agua mediante Balance Estequiométrico Automático

# Requeriments
(Electron + Python/Flask)

Esta es una aplicación de escritorio híbrida que utiliza el **Patrón Sidecar**.
- **Frontend (GUI):** Electron (Node.js/HTML/JS)
- **Backend (Lógica/API):** Python 3 (Flask)

---

##  1. Previos

Asegúrate de tener instaladas las siguientes herramientas en tu sistema operativo:

- **Node.js** (v18 o superior)
- **Python** (v3.10 o superior, con la casilla "Add to PATH" marcada)
- **Git** o **Github Desktop**

---

## **Lo siguiente es solo para desarrolladores**

## ⚙️ 2. Instalación del Entorno

Abre tu terminal, clona el repositorio e inicia la configuración en el directorio principal:

```bash
git clone <URL_DEL_REPOSITORIO>
cd mi-app-

cd backend

# 1. Crear entorno virtual
# Windows (Recomendado):
python -m venv venv
# Mac/Linux:
python3 -m venv venv

# 2. Activar entorno virtual
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 3. Instalar Flask y Flask-CORS (Las librerías necesarias)
pip install -r requirements.txt

cd ../frontend

## 3. Modo Desarrollo (Ejecución Diaria)

Para trabajar, necesitas tener dos terminales abiertas y ejecutando procesos:

Terminal 1: Servidor Python (Backend)

Aquí levantas el motor Flask para el hot-reload (actualización automática al guardar).

cd backend
# Asegúrate de que (venv) esté activo. Si no, actívalo de nuevo.
python main.py

El servidor iniciará en http://127.0.0.1:8000 con debug activado.

Terminal 2: Ventana Electron (Frontend)

Una vez que el servidor Flask esté activo, inicia la ventana de la aplicación.
cd frontend
npm start

La ventana de la aplicación de escritorio se abrirá y comenzará a comunicarse con el Backend.

## 4. Compilación y Distribución (Build Final)

(Estos comandos solo se usan cuando el proyecto está listo para ser entregado al cliente final).

Para generar el instalador auto-contenido (que no requiere que el cliente tenga Python o Node instalados), usa PyInstaller y electron-builder.

# 1. Crear el ejecutable de Python
cd backend
pyinstaller --onefile --noconsole main.py

# 2. Compilar el instalador final (Requiere electron-builder en package.json)
cd ../frontend
npm run dist

---
