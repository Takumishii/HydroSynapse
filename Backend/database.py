import sqlite3
import os
from typing import List, Dict, Any

class SQLiteDatabase:
    """
    Gestor de Base de Datos SQLite para HydroSynapse.
    Almacena perfiles de planta personalizados y el historial de recetas.
    """
    def __init__(self, db_name="hidrosynapse.db"):
        # La base de datos se guarda en la misma carpeta que el script
        self.db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_name)
        self._initialize_db()

    def _initialize_db(self):
        """Crea la conexión y asegura que las tablas existan."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Tabla 1: Perfiles Personalizados (Objetivos de PPM)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT UNIQUE NOT NULL,
                N REAL NOT NULL,
                P REAL NOT NULL,
                K REAL NOT NULL,
                Ca REAL NOT NULL,
                Mg REAL NOT NULL
            );
        """)

        # Tabla 2: Historial de Recetas Calculadas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                volumen_L REAL NOT NULL,
                perfil_usado TEXT NOT NULL,
                ec_final REAL NOT NULL,
                dosis_json TEXT NOT NULL
            );
        """)
        
        # Insertar perfiles predeterminados si la base de datos está vacía
        self._insert_default_profiles(cursor)
        
        conn.commit()
        conn.close()

    def _get_connection(self):
        """Retorna una conexión a la base de datos."""
        return sqlite3.connect(self.db_path)

    def _insert_default_profiles(self, cursor: sqlite3.Cursor):
        """Inserta perfiles base para que el software tenga datos de inicio."""
        default_profiles = [
            ("Lechuga (Vegetativo)", 140, 40, 200, 150, 50),
            ("Tomate (Floración)", 180, 50, 280, 200, 60),
            ("Fresa (Maduración)", 100, 30, 300, 100, 40)
        ]
        
        # Intentar insertar solo si no existen
        for profile in default_profiles:
            try:
                cursor.execute(
                    "INSERT INTO profiles (nombre, N, P, K, Ca, Mg) VALUES (?, ?, ?, ?, ?, ?)", 
                    profile
                )
            except sqlite3.IntegrityError:
                # El perfil ya existe, ignorar.
                pass

    def get_all_profiles(self) -> List[Dict[str, Any]]:
        """Recupera todos los perfiles de planta."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT nombre, N, P, K, Ca, Mg FROM profiles ORDER BY nombre")
        rows = cursor.fetchall()
        
        profiles = []
        for row in rows:
            profiles.append({
                "nombre": row[0], "N": row[1], "P": row[2], "K": row[3], 
                "Ca": row[4], "Mg": row[5]
            })
        
        conn.close()
        return profiles

    def get_profile_by_name(self, name: str) -> Dict[str, Any] | None:
        """Recupera un perfil específico por nombre."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT N, P, K, Ca, Mg FROM profiles WHERE nombre = ?", (name,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {"nombre": name, "N": row[0], "P": row[1], "K": row[2], "Ca": row[3], "Mg": row[4]}
        return None

    def save_new_recipe_history(self, volumen_L: float, perfil_usado: str, ec_final: float, dosis_json: str):
        """Guarda una receta calculada en el historial."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        timestamp = datetime.now().isoformat()
        
        cursor.execute(
            "INSERT INTO history (timestamp, volumen_L, perfil_usado, ec_final, dosis_json) VALUES (?, ?, ?, ?, ?)",
            (timestamp, volumen_L, perfil_usado, ec_final, dosis_json)
        )
        
        conn.commit()
        conn.close()

# Necesario para el guardado de historial
from datetime import datetime