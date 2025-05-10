from flask import Flask, request, jsonify, render_template, redirect, url_for, make_response
import jwt
import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from db_1 import get_db_connection
from config import SECRET_KEY, JWT_ALGORITHM

app = Flask(__name__)
app.config['cool'] = SECRET_KEY

# ---------------- JWT Decorator ---------------- #
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('token')  # Get token from cookie

        if not token:
            return redirect(url_for('login'))

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
            request.user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return redirect(url_for('login'))
        except jwt.InvalidTokenError:
            return redirect(url_for('login'))

        return f(*args, **kwargs)
    return decorated

# ---------------- Register ---------------- #
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('register.html')

    username = request.form['username']
    password = request.form['password']

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM TurnusUsers WHERE username = %s", (username,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return "User already exists", 409

    hashed_password = generate_password_hash(password)
    cursor.execute("INSERT INTO TurnusUsers (username, password) VALUES (%s, %s)", (username, hashed_password))
    conn.commit()
    cursor.close()
    conn.close()
    return redirect(url_for('login'))

# ---------------- Login ---------------- #
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    username = request.form['username']
    password = request.form['password']

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM TurnusUsers WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not check_password_hash(user['password'], password):
        return "Invalid credentials", 401

    token = jwt.encode({
        'user_id': user['id'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, SECRET_KEY, algorithm=JWT_ALGORITHM)

    resp = make_response(redirect(url_for('protected')))
    resp.set_cookie('token', token)
    return resp

# ---------------- Protected Page ---------------- #
@app.route('/protected')
@token_required
def protected():
    return render_template('protected.html', user_id=request.user_id)

# ---------------- Logout ---------------- #
@app.route('/logout')
def logout():
    resp = make_response(redirect(url_for('login')))
    resp.delete_cookie('token')
    return resp

# ---------------- Run App ---------------- #
if __name__ == '__main__':
    app.run(debug=True)
