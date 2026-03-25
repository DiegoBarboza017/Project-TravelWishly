import sqlite3
import traceback

try:
    print("Connecting to local DB...")
    conn = sqlite3.connect('instance/travelwishly.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE saved_routes ADD COLUMN mochila_state TEXT")
    except sqlite3.OperationalError:
        pass # Already exists
        
    try:
        cursor.execute("ALTER TABLE saved_routes ADD COLUMN vibes_state TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE saved_routes ADD COLUMN packing_state TEXT")
    except sqlite3.OperationalError:
        pass
        
    conn.commit()
    conn.close()
    print("Migration successful.")
except Exception as e:
    print("Error:", str(e))
    traceback.print_exc()
