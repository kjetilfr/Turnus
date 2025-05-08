import mysql.connector

db = mysql.connector.connect(
    host="test",
    user="test",
    password="test",
    database="test",
    ssl_disabled=True
)

cursor = db.cursor(dictionary=True)
