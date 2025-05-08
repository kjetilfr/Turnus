from flask import Flask, render_template, request, redirect
import mysql.connector

app = Flask(__name__)

# Koble til databasen
db = mysql.connector.connect(
    host="192.168.80.172",
    user="remote",
    password="Presteboen9!",
    database="turnus",
    ssl_disabled=True
)

cursor = db.cursor(dictionary=True)

@app.route('/')
def form():
    return render_template('createEmployee.html')

@app.route('/createPerson', methods=['POST'])
def createPerson():
    Name = request.form['Name']
    PositionPercent = request.form['PositionPercent']

    cursor.execute("INSERT INTO employees (Name, PositionPercent) VALUES (%s, %s)", (Name, PositionPercent))
    db.commit()
    return redirect('/')

# Route: View employees
@app.route('/viewEmployees')
def viewEmployees():
    cursor.execute("SELECT * FROM employees")
    employees = cursor.fetchall()
    return render_template('viewEmployees.html', employees=employees)

@app.route('/viewShifts')
def viewShifts():
    cursor.execute("SELECT * FROM shifts")
    shifts = cursor.fetchall()
    return render_template('viewShifts.html', shifts=shifts)

@app.route('/editEmployees/<int:id>')
def edit(id):
    cursor.execute("SELECT * FROM employees WHERE id = %s", (id,))
    employee = cursor.fetchone()
    return render_template('editEmployees.html', employee=employee)

@app.route('/updateEmployee/<int:Id>', methods=['POST'])
def update(Id):
    Name = request.form['Name']
    PositionPercent = request.form['PositionPercent']

    cursor.execute("""
        UPDATE employees 
        SET Name = %s, PositionPercent = %s 
        WHERE Id = %s
    """, (Name, PositionPercent, Id))
    db.commit()
    return redirect('/viewEmployees')




if __name__ == '__main__':
    app.run(debug=True)