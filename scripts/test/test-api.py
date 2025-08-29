from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class TestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        print(f"Received POST request to: {self.path}")
        print(f"Headers: {dict(self.headers)}")
        
        if self.path == '/anonymize':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', '*')
            self.end_headers()
            
            response = {
                "text": "Hello [NAME_1]!",
                "session": "test-session",
                "signature": "test-signature",
                "public_key": "test-key",
                "signing_method": "ecdsa"
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8080), TestHandler)
    print("Test API server running on http://localhost:8080")
    server.serve_forever()