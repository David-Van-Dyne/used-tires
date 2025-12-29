#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import hashlib
import secrets
from dotenv import load_dotenv
from base64 import b64encode
from http.cookies import SimpleCookie
from urllib.parse import parse_qs

load_dotenv()

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
PASSWORD = os.getenv("ADMIN_PASSWORD", "password")

# Store active sessions
active_sessions = {}

class InventoryHandler(SimpleHTTPRequestHandler):
    
    def is_authenticated(self):
        """Check if request has valid session cookie"""
        cookie_header = self.headers.get('Cookie')
        if not cookie_header:
            return False
        
        cookies = SimpleCookie()
        cookies.load(cookie_header)
        
        if 'session_id' in cookies:
            session_id = cookies['session_id'].value
            return session_id in active_sessions
        
        return False
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        print(f"POST request received: {self.path}")  # Debug line
        
        # Handle login
        if self.path == '/api/login':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                credentials = json.loads(post_data)
                
                username = credentials.get('username')
                password = credentials.get('password')
                
                if username == ADMIN_USERNAME and password == PASSWORD:
                    # Create new session
                    session_id = secrets.token_urlsafe(32)
                    active_sessions[session_id] = username
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Set-Cookie', f'session_id={session_id}; Path=/; HttpOnly; SameSite=Lax')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    response = json.dumps({'success': True, 'message': 'Login successful'})
                    self.wfile.write(response.encode())
                    print(f"✓ User {username} logged in")
                else:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    response = json.dumps({'success': False, 'message': 'Invalid credentials'})
                    self.wfile.write(response.encode())
                    print(f"✗ Failed login attempt")
                    
            except Exception as e:
                print(f"✗ Login error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = json.dumps({'success': False, 'message': str(e)})
                self.wfile.write(response.encode())
            return
        
        # Handle logout
        if self.path == '/api/logout':
            cookie_header = self.headers.get('Cookie')
            if cookie_header:
                cookies = SimpleCookie()
                cookies.load(cookie_header)
                if 'session_id' in cookies:
                    session_id = cookies['session_id'].value
                    active_sessions.pop(session_id, None)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Set-Cookie', 'session_id=; Path=/; Max-Age=0')
            self.end_headers()
            response = json.dumps({'success': True})
            self.wfile.write(response.encode())
            print(f"✓ User logged out")
            return
        
        # Handle order submission (public endpoint)
        if self.path == '/api/submit-order':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                order_data = json.loads(post_data)
                
                # Load existing orders
                orders_path = os.path.join(os.getcwd(), 'data', 'orders.json')
                orders = []
                if os.path.exists(orders_path):
                    with open(orders_path, 'r', encoding='utf-8') as f:
                        orders = json.load(f)
                
                # Add new order
                orders.append(order_data)
                
                # Save orders
                with open(orders_path, 'w', encoding='utf-8') as f:
                    json.dump(orders, f, indent=2)
                
                # Update inventory (reduce quantities)
                inventory_path = os.path.join(os.getcwd(), 'data', 'inventory.json')
                with open(inventory_path, 'r', encoding='utf-8') as f:
                    inventory = json.load(f)
                
                # Reduce quantities for ordered items
                for order_item in order_data['items']:
                    for inv_item in inventory:
                        if inv_item['id'] == order_item['id']:
                            inv_item['quantity'] = max(0, inv_item['quantity'] - order_item['selected_qty'])
                            break
                
                # Save updated inventory
                with open(inventory_path, 'w', encoding='utf-8') as f:
                    json.dump(inventory, f, indent=2)
                
                # Success response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = json.dumps({
                    'success': True, 
                    'message': 'Order placed successfully',
                    'orderId': order_data['id']
                })
                self.wfile.write(response.encode())
                
                print(f"✓ Order #{order_data['id']} placed - ${order_data['total']:.2f}")
                
            except Exception as e:
                print(f"✗ Order error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({'success': False, 'message': str(e)})
                self.wfile.write(response.encode())
            return
        
        # Handle order cancellation (protected endpoint)
        if self.path == '/api/cancel-order':
            if not self.is_authenticated():
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({'success': False, 'message': 'Unauthorized'})
                self.wfile.write(response.encode())
                return
            
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                cancel_data = json.loads(post_data)
                order_id = cancel_data.get('orderId')
                
                # Load existing orders
                orders_path = os.path.join(os.getcwd(), 'data', 'orders.json')
                orders = []
                if os.path.exists(orders_path):
                    with open(orders_path, 'r', encoding='utf-8') as f:
                        orders = json.load(f)
                
                # Find the order
                order = None
                for o in orders:
                    if o['id'] == order_id:
                        order = o
                        break
                
                if not order:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    response = json.dumps({'success': False, 'message': 'Order not found'})
                    self.wfile.write(response.encode())
                    return
                
                # Check if order can be cancelled
                if order['status'] == 'cancelled':
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    response = json.dumps({'success': False, 'message': 'Order already cancelled'})
                    self.wfile.write(response.encode())
                    return
                
                # Restore inventory quantities
                inventory_path = os.path.join(os.getcwd(), 'data', 'inventory.json')
                with open(inventory_path, 'r', encoding='utf-8') as f:
                    inventory = json.load(f)
                
                for order_item in order['items']:
                    for inv_item in inventory:
                        if inv_item['id'] == order_item['id']:
                            inv_item['quantity'] += order_item['selected_qty']
                            break
                
                # Save updated inventory
                with open(inventory_path, 'w', encoding='utf-8') as f:
                    json.dump(inventory, f, indent=2)
                
                # Update order status to cancelled
                order['status'] = 'cancelled'
                
                # Save orders
                with open(orders_path, 'w', encoding='utf-8') as f:
                    json.dump(orders, f, indent=2)
                
                # Success response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = json.dumps({
                    'success': True, 
                    'message': 'Order cancelled successfully',
                    'orderId': order_id
                })
                self.wfile.write(response.encode())
                
                print(f"✓ Order #{order_id} cancelled - inventory restored")
                
            except Exception as e:
                print(f"✗ Cancel order error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({'success': False, 'message': str(e)})
                self.wfile.write(response.encode())
            return
        
        if self.path == '/api/save-inventory':
            # Check authentication for save operations
            if not self.is_authenticated():
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({'success': False, 'message': 'Unauthorized'})
                self.wfile.write(response.encode())
                return
            
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
            return
        
        # If no endpoint matched, return 404
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = json.dumps({'success': False, 'message': 'Endpoint not found'})
        self.wfile.write(response.encode())
    
    def do_GET(self):
        # Handle orders API (protected)
        if self.path == '/api/orders':
            if not self.is_authenticated():
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = json.dumps({'success': False, 'message': 'Unauthorized'})
                self.wfile.write(response.encode())
                return
            
            try:
                orders_path = os.path.join(os.getcwd(), 'data', 'orders.json')
                orders = []
                if os.path.exists(orders_path):
                    with open(orders_path, 'r', encoding='utf-8') as f:
                        orders = json.load(f)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(orders).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = json.dumps({'success': False, 'message': str(e)})
                self.wfile.write(response.encode())
            return
        
        # Protect admin pages
        if self.path.endswith('admin.html') or self.path == '/web/admin.html' or \
           self.path.endswith('orders.html') or self.path == '/web/orders.html':
            if not self.is_authenticated():
                # Redirect to login page
                self.send_response(302)
                self.send_header('Location', '/web/login.html')
                self.end_headers()
                return
        
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