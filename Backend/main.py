# backend/main.py
from flask import Flask, jsonify
from flask_cors import CORS # Importante: Manejo de CORS

app = Flask(__name__)
# Habilitar CORS para que Electron pueda acceder al backend sin problemas de seguridad
CORS(app) 

@app.route('/api/datos')
def obtener_datos():
    # El mismo endpoint que tu frontend espera
    return jsonify({"mensaje": "Hola desde Flask", "valor": 100})

if __name__ == '__main__':
    # Usamos modo debug=True para desarrollo (con hot-reload)
    # Importante: Mantener el puerto 8000 para que Electron se conecte
    app.run(host='127.0.0.1', port=8000, debug=True)