from flask import Blueprint, render_template, request, redirect
from db import db, cursor

employee_bp = Blueprint('employee', __name__)

@employee_bp.route('/')
@employee_bp.route('/createEmployee')
def form():
    return render_template('createEmployee.html')

@employee_bp.route('/createEmployee', methods=['POST'])
def createEmployee():
    Name = request.form['Name']
    PositionPercent = request.form['PositionPercent']
    cursor.execute("INSERT INTO employees (Name, PositionPercent) VALUES (%s, %s)", (Name, PositionPercent))
    db.commit()
    return redirect('/')

@employee_bp.route('/viewEmployees')
def viewEmployees():
    cursor.execute("SELECT * FROM employees")
    employees = cursor.fetchall()
    return render_template('viewEmployees.html', employees=employees)

@employee_bp.route('/editEmployee/<int:id>')
def editEmployee(id):
    cursor.execute("SELECT * FROM employees WHERE id = %s", (id,))
    employee = cursor.fetchone()
    return render_template('editEmployee.html', employee=employee)

@employee_bp.route('/updateEmployee/<int:Id>', methods=['POST'])
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
