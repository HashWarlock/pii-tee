from flask import Flask, jsonify
import psutil
import os

app = Flask(__name__)

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'memory_usage': psutil.virtual_memory().percent,
        'cpu_usage': psutil.cpu_percent(),
        'process_id': os.getpid()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
