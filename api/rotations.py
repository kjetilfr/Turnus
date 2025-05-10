from flask import Blueprint, render_template, request, redirect
from db import db, cursor

rotation_bp = Blueprint('rotationAPI', __name__)

@rotation_bp.route('/api/rotations')
def get_rotations():
    cursor.execute("""
        SELECT r.date, e.name AS employee_name, s.name AS shift_name
        FROM rotations r
        JOIN employees e ON r.Employee_FK_Id = e.id
        JOIN shifts s ON r.Shift_FK_Id = s.id
    """)
    data = cursor.fetchall()

    events = [{
        'title': f"{row['employee_name']} ({row['shift_name']})",
        'start': row['date'].isoformat()
    } for row in data]

    return events