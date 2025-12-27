#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os

class InventoryHandler(SimpleHTTPRequestHandler):
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        print(f"POST request received: {self.path}")  # Debug line
        
        if self.path == '/api/save-inventory':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                inventory_data = json.loads(post_data)
                
                # Save to file
                inventory_path = os.path.join(os.getcwd(), 'data', 'inventory.json')
                
                with open(inventory_path, 'w', encoding='utf-8') as f:
                    json.dump(inventory_data, f, indent=2)
                
                # Success response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = json.dumps({'success': True, 'message': f'Saved {len(inventory_data)} items'})
                self.wfile.write(response.encode())
                
                print(f"✓ Saved {len(inventory_data)} items")
                
            except Exception as e:
                print(f"✗ Error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({'success': False, 'message': str(e)})
                self.wfile.write(response.encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_GET(self):
        # Add CORS headers to GET requests too
        super().do_GET()
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        SimpleHTTPRequestHandler.end_headers(self)

def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, InventoryHandler)
    print(f'Server running at http://localhost:{port}/')
    print(f'Admin: http://localhost:{port}/web/admin.html')
    httpd.serve_forever()

if __name__ == '__main__':
    run()