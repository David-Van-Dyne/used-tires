"""
Migration script to convert JSON data to database.
Run this once to migrate existing inventory.json and orders.json to the database.
"""

import json
import os
from datetime import datetime
from models import get_session, Tire, Order

def migrate_inventory():
    """Migrate inventory.json to database"""
    json_path = 'data/inventory.json'
    
    if not os.path.exists(json_path):
        print(f"⚠️  {json_path} not found, skipping inventory migration")
        return
    
    with open(json_path, 'r', encoding='utf-8') as f:
        inventory_data = json.load(f)
    
    session = get_session()
    
    try:
        # Clear existing tires (for clean migration)
        session.query(Tire).delete()
        
        for item in inventory_data:
            tire = Tire(
                id=item.get('id'),
                brand=item.get('brand', ''),
                size=item.get('size', ''),
                quantity=item.get('quantity', 0),
                price=item.get('price', 0.0),
                notes=item.get('notes', '')
            )
            session.add(tire)
        
        session.commit()
        print(f"✓ Migrated {len(inventory_data)} tires from {json_path}")
        
    except Exception as e:
        session.rollback()
        print(f"✗ Error migrating inventory: {e}")
    finally:
        session.close()

def migrate_orders():
    """Migrate orders.json to database"""
    json_path = 'data/orders.json'
    
    if not os.path.exists(json_path):
        print(f"⚠️  {json_path} not found, skipping orders migration")
        return
    
    with open(json_path, 'r', encoding='utf-8') as f:
        orders_data = json.load(f)
    
    session = get_session()
    
    try:
        # Clear existing orders (for clean migration)
        session.query(Order).delete()
        
        for item in orders_data:
            # Parse timestamp (handle both ISO formats with and without Z suffix)
            timestamp_str = item.get('timestamp')
            if timestamp_str:
                # Remove 'Z' suffix if present and replace with +00:00
                timestamp_str = timestamp_str.replace('Z', '+00:00')
                timestamp = datetime.fromisoformat(timestamp_str)
            else:
                timestamp = datetime.utcnow()
            
            customer = item.get('customer', {})
            
            order = Order(
                id=item.get('id'),
                timestamp=timestamp,
                customer_name=customer.get('name', ''),
                customer_email=customer.get('email', ''),
                customer_phone=customer.get('phone', ''),
                order_type=item.get('orderType', 'pickup'),
                items=item.get('items', []),
                total=item.get('total', 0.0),
                notes=item.get('notes', ''),
                status=item.get('status', 'pending')
            )
            session.add(order)
        
        session.commit()
        print(f"✓ Migrated {len(orders_data)} orders from {json_path}")
        
    except Exception as e:
        session.rollback()
        print(f"✗ Error migrating orders: {e}")
    finally:
        session.close()

def backup_json_files():
    """Create backups of JSON files before migration"""
    for filename in ['inventory.json', 'orders.json']:
        json_path = f'data/{filename}'
        if os.path.exists(json_path):
            backup_path = f'data/{filename}.backup'
            with open(json_path, 'r', encoding='utf-8') as f:
                data = f.read()
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(data)
            print(f"✓ Backed up {json_path} to {backup_path}")

if __name__ == '__main__':
    print("Starting database migration...\n")
    
    # Create backups
    backup_json_files()
    print()
    
    # Run migrations
    migrate_inventory()
    migrate_orders()
    
    print("\n✓ Migration complete!")
    print("Your JSON files have been backed up with .backup extension")
    print("You can now use the database-powered server.")
