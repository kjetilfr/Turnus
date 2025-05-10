import mysql.connector
from config import DB_CONFIG

def get_db_connection():
    return mysql.connector.connect(
        ssl_disabled=True,
        **DB_CONFIG
    )