from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import sys

app = Flask(__name__)
CORS(app)  # Ye HTML ko Python se connect karne ki permission deta hai

@app.route('/run', methods=['POST'])
def run_code():
    # HTML se aaya hua code lo
    data = request.get_json()
    python_code = data.get('code', '')

    try:
        # Code ko temporary file mein save karo
        with open('temp_code.py', 'w', encoding='utf-8') as f:
            f.write(python_code)
        
        # File ko command line mein run karo aur output capture karo
        result = subprocess.run([sys.executable, 'temp_code.py'], capture_output=True, text=True)
        
        # Agar code sahi chala toh output do
        if result.returncode == 0:
            return jsonify({'output': result.stdout})
        else:
            # Agar code mein error hai toh error do
            return jsonify({'error': result.stderr})
            
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    # Server ko port 5000 par chalu karo
    app.run(port=5000, debug=True)
