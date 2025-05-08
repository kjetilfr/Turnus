from flask import Flask
from employee_routes import employee_bp
from shift_routes import shift_bp

app = Flask(__name__)

# Register Blueprints
app.register_blueprint(employee_bp)
app.register_blueprint(shift_bp)

if __name__ == '__main__':
    app.run(debug=True)