"""
Database models for tire inventory and order management.
Uses SQLAlchemy ORM - compatible with SQLite (local) and PostgreSQL (production).
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()

class Tire(Base):
    """Tire inventory model"""
    __tablename__ = 'tires'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    brand = Column(String(100), nullable=False)
    size = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    price = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert tire object to dictionary"""
        return {
            'id': self.id,
            'brand': self.brand,
            'size': self.size,
            'quantity': self.quantity,
            'price': self.price,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Order(Base):
    """Order model"""
    __tablename__ = 'orders'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    customer_name = Column(String(200), nullable=False)
    customer_email = Column(String(200), nullable=False)
    customer_phone = Column(String(50), nullable=False)
    order_type = Column(String(50), nullable=False)  # 'pickup' or 'delivery'
    items = Column(JSON, nullable=False)  # List of order items
    total = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default='pending')  # pending, confirmed, ready, completed, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert order object to dictionary"""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'customer': {
                'name': self.customer_name,
                'email': self.customer_email,
                'phone': self.customer_phone
            },
            'orderType': self.order_type,
            'items': self.items,
            'total': self.total,
            'notes': self.notes,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Database connection setup
def get_database_url():
    """Get database URL from environment or use SQLite for local development"""
    # Check for PostgreSQL URL (used in production on Render.com)
    db_url = os.getenv('DATABASE_URL')
    
    if db_url:
        # Render uses postgres:// but SQLAlchemy needs postgresql://
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        return db_url
    
    # Local development with SQLite
    return 'sqlite:///data/tires.db'

def init_db():
    """Initialize database connection and create tables"""
    db_url = get_database_url()
    engine = create_engine(db_url, echo=False)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    return engine, SessionLocal

# Create global session maker
engine, SessionLocal = init_db()

def get_session():
    """Get a new database session"""
    return SessionLocal()
