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
@app.route('/createEmployee')
def form():
    return render_template('createEmployee.html')

@app.route('/createShift')
def createShiftPage():
    return render_template('createShift.html')

@app.route('/createEmployee', methods=['POST'])
def createEmployee():
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

@app.route('/editEmployee/<int:id>')
def editEmployee(id):
    cursor.execute("SELECT * FROM employees WHERE id = %s", (id,))
    employee = cursor.fetchone()
    return render_template('editEmployee.html', employee=employee)

@app.route('/updateEmployee/<int:Id>', methods=['POST'])
def updateEmployee(Id):
    Name = request.form['Name']
    PositionPercent = request.form['PositionPercent']

    cursor.execute("""
        UPDATE employees 
        SET Name = %s, PositionPercent = %s 
        WHERE Id = %s
    """, (Name, PositionPercent, Id))
    db.commit()
    return redirect('/viewEmployees')

@app.route('/createShift', methods=['POST'])
def createShift():
    Name = request.form['Name']
    StartTime = request.form['StartTime']
    EndTime = request.form['EndTime']
    Length = request.form['Length']

    cursor.execute("INSERT INTO employees (Name, StartTime, EndTime, Length) VALUES (%s, %s, %s, %s)", (Name, StartTime, EndTime, Length))
    db.commit()
    return redirect('/viewShifts.html')

@app.route('/viewShifts')
def viewShifts():
    cursor.execute("SELECT * FROM shifts")
    shifts = cursor.fetchall()
    return render_template('viewShifts.html', shifts=shifts)

@app.route('/editShifts/<int:id>')
def editShifts(id):
    cursor.execute("SELECT * FROM shifts WHERE id = %s", (id,))
    shift = cursor.fetchone()
    return render_template('editShifts.html', shift=shift)

@app.route('/updateShift/<int:Id>', methods=['POST'])
def updateShift(Id):
    Name = request.form['Name']
    StartTime = request.form['StartTime']
    EndTime = request.form['EndTime']
    Length = request.form['Length']

    cursor.execute("""
        UPDATE shifts 
        SET Name = %s, StartTime = %s, EndTime = %s, Length = %s 
        WHERE Id = %s
    """, (Name, StartTime, EndTime, Length, Id))
    db.commit()
    return redirect('/viewShifts')


if __name__ == '__main__':
    app.run(debug=True)