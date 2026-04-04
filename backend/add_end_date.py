import sqlite3

def migrate():
    conn = sqlite3.connect('parking.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE parking_requests ADD COLUMN end_date TEXT")
        conn.commit()
        print("Migration successful: added 'end_date' column to 'parking_requests'")
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e).lower():
            print("Column 'end_date' already exists.")
        else:
            print(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
