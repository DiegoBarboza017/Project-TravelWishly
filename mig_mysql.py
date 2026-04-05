import pymysql

try:
    print("Conectando a MySQL local...")
    conn = pymysql.connect(
        host='localhost',
        user='root',
        password='DBserver.17!',
        database='TravelWishly_db'
    )
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE saved_routes ADD COLUMN mochila_state TEXT;")
        print("Añadida columna mochila_state")
    except Exception as e:
        print("Ignorando: ya existe mochila_state")
        
    try:
        cursor.execute("ALTER TABLE saved_routes ADD COLUMN vibes_state TEXT;")
        print("Añadida columna vibes_state")
    except Exception as e:
        print("Ignorando: ya existe vibes_state")
        
    try:
        cursor.execute("ALTER TABLE saved_routes ADD COLUMN packing_state TEXT;")
        print("Añadida columna packing_state")
    except Exception as e:
        print("Ignorando: ya existe packing_state")
        
    conn.commit()
    conn.close()
    print("✅ Migración MySQL exitosa")
except Exception as e:
    print("❌ Error conectando a MySQL:", e)
