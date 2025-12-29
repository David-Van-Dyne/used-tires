#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from base64 import b64encode
from http.cookies import SimpleCookie
from urllib.parse import parse_qs
from models import get_session, Tire, Order
from datetime import datetime

load_dotenv()

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
PASSWORD = os.getenv("ADMIN_PASSWORD", "password")

# Email configuration (optional)
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587")) if os.getenv("SMTP_PORT") else 587
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
ENABLE_EMAIL = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)

# Store active sessions
active_sessions = {}

def send_order_confirmation_email(order_data):
    """Send order confirmation email to customer"""
    if not ENABLE_EMAIL:
        print("⚠ Email not configured - skipping email notification")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'Order Confirmation #{order_data["id"]}'
        msg['From'] = FROM_EMAIL
        msg['To'] = order_data['customer']['email']
        
        # Create HTML email body
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Order Confirmation</h2>
            <p>Dear {order_data['customer']['firstName']} {order_data['customer']['lastName']},</p>
            <p>Thank you for your order! We've received your order and will contact you shortly.</p>
            
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> #{order_data['id']}</p>
            <p><strong>Order Type:</strong> {order_data.get('orderType', 'N/A').title()}</p>
            
            <h3>Items Ordered</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Qty</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Size</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Price</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Total</th>
                </tr>
              </thead>
              <tbody>
        """
        
        for item in order_data['items']:
            line_total = item['selected_qty'] * item['price']
            model_info = f" {item.get('model', '')}" if item.get('model') else ""
            html += f"""
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">{item['selected_qty']}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">{item['size']}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">{item['brand']}{model_info}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item['price']:.2f}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${line_total:.2f}</td>
                </tr>
            """
        
        html += f"""
              </tbody>
            </table>
            
            <h3 style="margin-top: 20px;">Order Total: ${order_data['total']:.2f}</h3>
            
            <p style="margin-top: 30px; color: #666;">
              We'll contact you at {order_data['customer']['phone']} or reply to this email 
              when your order is ready.
            </p>
            
            <p style="color: #666; font-size: 12px; margin-top: 40px;">
              Thank you for your business!<br>
              Vandyne Used Tires
            </p>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(html, 'html'))
        
        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"✓ Confirmation email sent to {order_data['customer']['email']}")
        return True
        
    except Exception as e:
        print(f"✗ Failed to send email: {e}")
        return False

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
                
                # Send confirmation email (non-blocking)
                send_order_confirmation_email(order_data)
                
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
                
                # Create database session
                session = get_session()
                
                try:
                    # Find the order
                    order = session.query(Order).filter_by(id=order_id).first()
                    
                    if not order:
                        self.send_response(404)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        response = json.dumps({'success': False, 'message': 'Order not found'})
                        self.wfile.write(response.encode())
                        return
                    
                    # Check if order can be cancelled
                    if order.status == 'cancelled':
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        response = json.dumps({'success': False, 'message': 'Order already cancelled'})
                        self.wfile.write(response.encode())
                        return
                    
                    # Restore inventory quantities
                    for order_item in order.items:
                        tire = session.query(Tire).filter_by(id=order_item['id']).first()
                        if tire:
                            tire.quantity += order_item['selected_qty']
                    
                    # Update order status to cancelled
                    order.status = 'cancelled'
                    
                    session.commit()
                    
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
                    session.rollback()
                    raise e
                finally:
                    session.close()
                
            except Exception as e:
                print(f"✗ Cancel order error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = json.dumps({'success': False, 'message': str(e)})
                self.wfile.write(response.encode())
            return
        
        # Handle order status update (protected endpoint)
        if self.path == '/api/update-order-status':
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
                update_data = json.loads(post_data)
                order_id = update_data.get('orderId')
                new_status = update_data.get('status')
                
                # Create database session
                session = get_session()
                
                try:
                    # Find and update the order
                    order = session.query(Order).filter_by(id=order_id).first()
                    
                    if not order:
                        self.send_response(404)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        response = json.dumps({'success': False, 'message': 'Order not found'})
                        self.wfile.write(response.encode())
                        return
                    
                    order.status = new_status
                    session.commit()
                    
                    # Success response
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    response = json.dumps({
                        'success': True, 
                        'message': f'Order status updated to {new_status}',
                        'orderId': order_id
                    })
                    self.wfile.write(response.encode())
                    
                    print(f"✓ Order #{order_id} status updated to: {new_status}")
                    
                except Exception as e:
                    session.rollback()
                    raise e
                finally:
                    session.close()
                
            except Exception as e:
                print(f"✗ Update order status error: {e}")
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
                
                # Create database session
                session = get_session()
                
                try:
                    # Update all tires
                    for item in inventory_data:
                        tire = session.query(Tire).filter_by(id=item['id']).first()
                        if tire:
                            tire.brand = item.get('brand', '')
                            tire.size = item.get('size', '')
                            tire.quantity = item.get('quantity', 0)
                            tire.price = item.get('price', 0.0)
                            tire.notes = item.get('notes', '')
                    
                    session.commit()
                    
                    # Success response
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    response = json.dumps({'success': True, 'message': f'Saved {len(inventory_data)} items'})
                    self.wfile.write(response.encode())
                    
                    print(f"✓ Saved {len(inventory_data)} items")
                    
                except Exception as e:
                    session.rollback()
                    raise e
                finally:
                    session.close()
                
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
        # Handle inventory API
        if self.path == '/data/inventory.json' or self.path == '/api/inventory':
            try:
                # Create database session
                session = get_session()
                
                try:
                    tires = session.query(Tire).all()
                    inventory_data = [tire.to_dict() for tire in tires]
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(inventory_data).encode())
                finally:
                    session.close()
                    
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = json.dumps({'success': False, 'message': str(e)})
                self.wfile.write(response.encode())
            return
        
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
                # Create database session
                session = get_session()
                
                try:
                    orders = session.query(Order).order_by(Order.timestamp.desc()).all()
                    orders_data = [order.to_dict() for order in orders]
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(orders_data).encode())
                finally:
                    session.close()
                    
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
    # Use PORT environment variable for production (Render.com sets this)
    port = int(os.getenv('PORT', 8000))
    run(port)