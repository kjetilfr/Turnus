from flask import Blueprint, render_template, request, redirect
from db import db, cursor

shift_bp = Blueprint('shift', __name__)

@shift_bp.route('/createShift')
def createShiftPage():
    return render_template('createShift.html')

@shift_bp.route('/createShift', methods=['POST'])
def createShift():
    Name = request.form['Name']
    StartTime = request.form['StartTime']
    EndTime = request.form['EndTime']
    Length = request.form['Length']
    cursor.execute("INSERT INTO shifts (Name, StartTime, EndTime, Length) VALUES (%s, %s, %s, %s)",
                   (Name, StartTime, EndTime, Length))
    db.commit()
    return redirect('/viewShifts')

@shift_bp.route('/viewShifts')
def viewShifts():
    cursor.execute("SELECT * FROM shifts")
    shifts = cursor.fetchall()
    return render_template('viewShifts.html', shifts=shifts)

@shift_bp.route('/editShifts/<int:id>')
def editShifts(id):
    cursor.execute("SELECT * FROM shifts WHERE id = %s", (id,))
    shift = cursor.fetchone()
    return render_template('editShifts.html', shift=shift)

@shift_bp.route('/updateShift/<int:Id>', methods=['POST'])
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
