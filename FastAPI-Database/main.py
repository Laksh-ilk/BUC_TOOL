from fastapi import FastAPI, HTTPException, Query, File, UploadFile, Form, Path
import jwt.exceptions
import jwt.utils
import pymysql
from pydantic import BaseModel, validator, field_validator
from typing import List
import logging
import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, HTTPException, Security
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
import jwt
from fastapi.security import OAuth2PasswordBearer
import pandas as pd
from passlib.context import CryptContext
from io import BytesIO  # Needed for Bulk Upload
import numpy as np
import pymysql.cursors
from decimal import Decimal
import time
from functools import wraps
import os

def retry_on_db_error(max_retries=3, delay=1.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except pymysql.err.OperationalError as e:
                    msg = str(e)
                    # MySQL lock wait timeout, deadlock, or connection error
                    if any(
                        err in msg.lower() for err in [
                            'lock wait timeout',
                            'deadlock found',
                            'connection',
                            'server has gone away',
                            'lost connection',
                        ]
                    ):
                        last_exception = e
                        if attempt < max_retries - 1:
                            time.sleep(delay)
                            continue
                    raise HTTPException(status_code=500, detail=f"Database error: {msg}")
                except Exception as e:
                    last_exception = e
                    break
            if last_exception:
                raise HTTPException(status_code=500, detail=f"Database error after retries: {str(last_exception)}")
        return wrapper
    return decorator

app = FastAPI()

logging.basicConfig(filename="update_requests.log", level=logging.INFO, format="%(asctime)s - %(message)s")

# Database Configuration
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "root"),
    "database": os.getenv("DB_NAME", "buc"),
}

# Enable CORS for Frontend Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COUNTRY_CONSTANTS = {
    "India": {"annual_hours": 6240, "space_rental": 5.75, "electricity_rate": 0.18, "water_rate": 0.6},
    "China": {"annual_hours": 6000, "space_rental": 15.75, "electricity_rate": 0.09, "water_rate": 1.5},
    "America": {"annual_hours": 5664, "space_rental": 10.50, "electricity_rate": 1.6, "water_rate": 1.5},
}

# Field Mappings (Frontend -> Database Column)
COLUMN_MAPPING = {
    "machine_type": "Machine Type",
    "make": "Make",
    "model_size": "Model/Size",
    "purchase_dollar": "Purchase $",
    "res_value": "Res Value",
    "useful_life": "Useful Life",
    "utilization": "Utilization",
    "maintenance": "Maintenance",
    "power_kw_hr": "Power (kW/hr)",
    "power_spec": "Power Spec",
    "area_m2": "Area m2",
    "water_m3_hr": "Water m3/hr",
    "depreciation": "Depreciation",  # Dynamically Calculated
    "maintenance_1": "Maintenance_1",
    "space": "Space",
    "power": "Power",
    "water": "Water",
    "consumables": "Consumables",
    "total_dollar_hr": "Total $/hr",
}

# Pydantic Model for Updates
class UpdateMachineRate(BaseModel):
    field: str
    value: str

# User Authentication
class UserLogin(BaseModel):
    username: str
    password: str
    email: str
    role: str

class UserReg(BaseModel):
    username: str
    password: str


SECRET_KEY = "LAKSH"
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def decode_jwt(token: str = Security(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def role_required(*required_role):
    def wrapper(token: str = Security(oauth2_scheme)):
        payload = decode_jwt(token)
        user_role = payload.get("role")
        print(user_role)
        if user_role not in required_role:
            raise HTTPException(status_code=403, detail="Unauthorized access")
        return True
    return wrapper

@app.post("/register")
def register(user: UserLogin):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    # ✅ Hash the password before storing
    hashed_password = pwd_context.hash(user.password)

    cursor.execute("INSERT INTO users (username, password_hash, email, role) VALUES (%s, %s, %s, %s)", 
                   (user.username, user.password, user.email,user.role))
    connection.commit()
    cursor.close()
    connection.close()

    return {"message": "User registered successfully"}


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

ACCESS_TOKEN_EXPIRE_SECONDS = 3600  # 1 hour
REFRESH_TOKEN_EXPIRE_SECONDS = 7 * 24 * 3600  # 7 days

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(seconds=ACCESS_TOKEN_EXPIRE_SECONDS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(seconds=REFRESH_TOKEN_EXPIRE_SECONDS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@app.post("/login")
def login(user: UserReg):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username = %s", (user.username,))
    result = cursor.fetchone()
    
    # if not result or not verify_password(user.password, result[2]):
    #     raise HTTPException(status_code=401, detail="Invalid credentials")
    
    print(result)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Handle both plain text and hashed passwords for backward compatibility
    stored_password = result[2]
    password_valid = False
    
    # Try to verify as hashed password first
    try:
        password_valid = verify_password(user.password, stored_password)
    except:
        # If verification fails, try direct comparison (for existing plain text passwords)
        password_valid = (user.password == stored_password)
    
    if not password_valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    

    payload = {"sub": result[1], "role": result[3]}

    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)

    cursor.close()
    connection.close()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": result[3]
    }

@app.post("/refresh-token")
def refresh_token(refresh_token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        new_access_token = create_access_token({"sub": payload["sub"], "role": payload["role"]})
        return {"access_token": new_access_token}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


class MachineType(BaseModel):
    machine_type: str


# Machine Type Management
@app.post("/add-machine-type")
def add_machine_type(name: MachineType):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("INSERT INTO machine_types (machine_type) VALUES (%s)", (name.machine_type,))
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": "Machine Type added successfully"}

@app.get("/fetch-machine-types")
def fetch_machine_types():
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM machine_types")
    types = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
    cursor.close()
    connection.close()
    return types

class Make(BaseModel):
    make: str

@app.post("/add-make")
def add_make(make: Make):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("INSERT INTO makes (make) VALUES (%s)", (make.make,))
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": "Make added successfully"}


@app.get("/fetch-makes")
def fetch_makes():
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM makes")
    makes = [{"id": row[0], "make": row[1]} for row in cursor.fetchall()]
    
    cursor.close()
    connection.close()
    
    return makes

@app.delete("/delete-make/{id}")
def delete_make(id: int):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        cursor.execute("DELETE FROM makes WHERE id = %s", (id,))
        connection.commit()
        return {"message": "Make deleted successfully"}
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()





# Approval System
@app.post("/approve-edit", dependencies=[Depends(role_required("Admin"))])
def approve_edit(approval_id: int, status: str):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("UPDATE user_approvals SET status = %s WHERE id = %s", (status, approval_id))
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": f"Edit request {status}"}


@app.post("/request-edit-machine-rate", dependencies=[Depends(role_required("Manager"))])
def request_edit_machine_rate(id: int, update: UpdateMachineRate):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    # Get current value before update
    cursor.execute(f"SELECT `{COLUMN_MAPPING[update.field]}` FROM machine_rate_calculation WHERE id = %s", (id,))
    current_value = cursor.fetchone()

    # Store in approvals table for admin review
    cursor.execute("""
        INSERT INTO user_approvals (user_id, change_type, status, timestamp, old_value, new_value)
        VALUES (%s, 'Machine Rate Update', 'Pending', NOW(), %s, %s)
    """, (id, current_value, update.value))
    
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": "Update request submitted for approval"}



# Function to Convert Strings to Floats Safely
def safe_float(value):
    try:
        return float(value) if value else 0.0
    except ValueError:
        return 0.0

def calculate_values(row, country: str):
    """ Calculates all dynamic fields based on the selected country. """
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    # Fetch country-specific rates including exchange rate
    rates = get_country_rates(country)
    if not rates:
        raise HTTPException(status_code=400, detail="Invalid country name")
    
    labor_rate, electricity_rate, water_rate, space_rental_rate, exchange_rate, currency_symbol = rates
    
    # Convert rates to float
    space_rental_rate = float(space_rental_rate)
    electricity_rate = float(electricity_rate)
    water_rate = float(water_rate)
    exchange_rate = float(exchange_rate)

    # Get annual hours based on country
    annual_hours = COUNTRY_CONSTANTS.get(country, {}).get("annual_hours", 6240)

    # Convert purchase price from USD to local currency
    purchase_price = float(row[6]) * exchange_rate
    res_value = safe_float(row[7]) / 100  # Convert percentage to decimal     
    useful_life = safe_float(row[8])     
    utilization = safe_float(row[9]) / 100  # Convert percentage to decimal     
    maintenance = safe_float(row[10]) / 100  # Convert percentage to decimal     
    power_kw_hr = safe_float(row[11])     
    power_spec = safe_float(row[12]) / 100  # Convert percentage to decimal     
    area_m2 = safe_float(row[13])        
    water_m3_hr = safe_float(row[14])    
    consumables = safe_float(row[15])    

    # Calculate values in local currency
    # Depreciation: (Purchase Price - Residual Value) / (Useful Life * Annual Hours * Utilization)
    depreciation = (
        (purchase_price - (purchase_price * res_value)) / (useful_life * annual_hours * utilization)
    ) if useful_life > 0 and utilization > 0 else 0

    # Maintenance: (Purchase Price * Maintenance %) / (Useful Life * Annual Hours)
    maintenance_1 = (purchase_price * maintenance) / (useful_life * annual_hours) if useful_life > 0 else 0

    # Space: (Space Rental Rate * Area) / (Annual Hours / 12 * Utilization)
    space = (space_rental_rate * area_m2) / (annual_hours / 12 * utilization) if utilization > 0 else 0

    # Power: Electricity Rate * Power KW/hr * Power Spec %
    power = electricity_rate * power_kw_hr * power_spec

    # Water: Water Rate * Water m³/hr
    water = water_rate * water_m3_hr

    # Total cost per hour
    total_dollar_hr = depreciation + maintenance_1 + space + power + water + consumables

    cursor.close()
    connection.close()

    return {
        "depreciation": round(depreciation, 3),
        "maintenance_1": round(maintenance_1, 3),
        "space": round(space, 3),
        "power": round(power, 3),
        "water": round(water, 3),
        "total_dollar_hr": round(total_dollar_hr, 3),
        "currency_symbol": currency_symbol
    }



# ✅ Fetch Machine Rate Data with Dynamic Calculations
@app.get("/machine-rate-data")
def get_machine_rate_data(item_master_id: int, country: str):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    # Verify item master exists
    cursor.execute("SELECT id FROM item_master WHERE id = %s", (item_master_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=400, detail="Invalid Item Master ID")

    # Fetching data from the database with machine type and make names
    query = """
        SELECT 
            mrc.id, 
            mrc.machine_type_id,
            mt.machine_type as machine_type_name,
            mrc.make_id,
            m.make as make_name,
            mrc.model_size, 
            mrc.purchase_price, 
            mrc.res_value, 
            mrc.useful_life, 
            mrc.utilization,
            mrc.maintenance, 
            mrc.power_kw_hr, 
            mrc.power_spec, 
            mrc.area_m2, 
            mrc.water_m3_hr, 
            mrc.consumables
        FROM machine_rate_calculation mrc
        LEFT JOIN machine_types mt ON mrc.machine_type_id = mt.id
        LEFT JOIN makes m ON mrc.make_id = m.id
        WHERE mrc.item_master_id = %s;
    """
    cursor.execute(query, (item_master_id,))
    rows = cursor.fetchall()

    results = []
    for row in rows:
        # Calculate values with currency conversion
        calculated_values = calculate_values(row, country)
        
        # Get exchange rate for purchase price conversion
        rates = get_country_rates(country)
        if rates:
            _, _, _, _, exchange_rate, _ = rates
            local_purchase_price = float(row[6]) * float(exchange_rate)  # Convert USD to local currency
        else:
            local_purchase_price = float(row[6])

        item = {
            "id": row[0],
            "machine_type": row[2],  # Use machine_type_name instead of ID
            "make": row[4],          # Use make_name instead of ID
            "model_size": row[5],
            "purchase_dollar": round(local_purchase_price, 2),  # Rounded local currency value
            "res_value": row[7],
            "useful_life": row[8],
            "utilization": row[9],
            "maintenance": row[10],
            "power_kw_hr": row[11],
            "power_spec": row[12],
            "area_m2": row[13],
            "water_m3_hr": row[14],
            "consumables": row[15],
            **calculated_values
        }
        results.append(item)

    cursor.close()
    connection.close()

    return results



# ✅ Update a Single Field (Prevents Depreciation Edits)
@app.put("/update-machine-rate/{id}")
def update_machine_rate(id: int, update: UpdateMachineRate):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    try:
        db_column = COLUMN_MAPPING.get(update.field)
        if not db_column:
            logging.warning(f"Invalid update attempt - ID: {id}, Field: {update.field}")
            raise HTTPException(status_code=400, detail="Invalid field name")

        # Prevent edits to dynamically calculated fields
        if update.field == "depreciation":
            raise HTTPException(status_code=400, detail="Depreciation is auto-calculated and cannot be edited")

        logging.info(f"Update Request - ID: {id}, Field: {update.field}, Value: {update.value}, Time: {datetime.datetime.now()}")

        query = f"UPDATE `machine_rate_calculation` SET `{db_column}` = %s WHERE id = %s"
        cursor.execute(query, (update.value, id))
        connection.commit()

        return {"message": f"Record with ID {id} updated successfully"}

    except Exception as e:
        connection.rollback()
        logging.error(f"Update Failed - ID: {id}, Field: {update.field}, Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating record: {str(e)}")

    finally:
        cursor.close()
        connection.close()

# ✅ Delete Records
class DeleteMachineRate(BaseModel):
    ids: List[int]

@retry_on_db_error()
@app.post("/delete-machine-rate")
def delete_machine_rate(delete_request: DeleteMachineRate):
    if not delete_request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided for deletion")

    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    try:
        # First verify the records exist
        id_list = ','.join(['%s'] * len(delete_request.ids))
        cursor.execute(f"SELECT COUNT(*) FROM machine_rate_calculation WHERE id IN ({id_list})", tuple(delete_request.ids))
        count = cursor.fetchone()[0]
        
        if count != len(delete_request.ids):
            raise HTTPException(status_code=404, detail="Some records not found")

        # Perform the deletion
        query = f"DELETE FROM machine_rate_calculation WHERE id IN ({id_list})"
        cursor.execute(query, tuple(delete_request.ids))
        connection.commit()

        return {
            "message": f"{count} record(s) deleted successfully",
            "deleted_count": count
        }

    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting records: {str(e)}")
    finally:
        cursor.close()
        connection.close()

# ✅ Create New Machine Rate Entry
class MachineRateCreate(BaseModel):
    machine_type: int
    make: int
    model_size: str  # This is a string field, not numeric
    purchase_dollar: float
    res_value: float
    useful_life: float
    utilization: float
    maintenance: float
    power_kw_hr: float
    power_spec: float
    area_m2: float
    water_m3_hr: float
    consumables: float

    @field_validator('model_size')
    @classmethod
    def validate_model_size(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError("Model/Size must be a non-empty string")
        return v

    @field_validator('purchase_dollar', 'res_value', 'useful_life', 'utilization', 'maintenance', 
                    'power_kw_hr', 'power_spec', 'area_m2', 'water_m3_hr', 'consumables')
    @classmethod
    def validate_positive_float(cls, v):
        try:
            float_val = float(v)
            if float_val < 0:
                raise ValueError("Value must be a positive number")
            return float_val
        except (ValueError, TypeError):
            raise ValueError("Value must be a valid number")

@retry_on_db_error()
@app.post("/create-machine-rate", dependencies=[Depends(role_required("Admin", "Manager"))])
def create_machine_rate(item_master_id: int, country: str, rate: MachineRateCreate):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    try:
        # Verify item master exists
        cursor.execute("SELECT id FROM item_master WHERE id = %s", (item_master_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Invalid Item Master ID")

        # Get country rates and exchange rate
        labor_rate, electricity_rate, water_rate, space_rental_rate, exchange_rate, currency_symbol = get_country_rates(country)

        # Convert purchase price to USD for storage
        purchase_price_usd = float(rate.purchase_dollar) / float(exchange_rate)  # Convert to USD

        # Insert the machine rate with USD values
        cursor.execute("""
            INSERT INTO machine_rate_calculation (
                item_master_id, machine_type_id, make_id, model_size, 
                purchase_price, res_value, useful_life, utilization,
                maintenance, power_kw_hr, power_spec, area_m2, 
                water_m3_hr, consumables
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            item_master_id, rate.machine_type, rate.make, rate.model_size,
            purchase_price_usd, rate.res_value, rate.useful_life, rate.utilization,
            rate.maintenance, rate.power_kw_hr, rate.power_spec, rate.area_m2,
            rate.water_m3_hr, rate.consumables
        ))

        connection.commit()
        
        # Get the inserted record
        machine_rate_id = cursor.lastrowid
        cursor.execute("""
            SELECT * FROM machine_rate_calculation WHERE id = %s
        """, (machine_rate_id,))
        row = cursor.fetchone()

        # Calculate values with currency conversion
        calculated_values = calculate_values(row, country)

        return {
            "message": "Machine rate created successfully",
            "machine_rate": {
                "id": machine_rate_id,
                "item_master_id": item_master_id,
                "machine_type": rate.machine_type,
                "make": rate.make,
                "model_size": rate.model_size,
                "purchase_price": rate.purchase_dollar,
                "res_value": rate.res_value,
                "useful_life": rate.useful_life,
                "utilization": rate.utilization,
                "maintenance": rate.maintenance,
                "power_kw_hr": rate.power_kw_hr,
                "power_spec": rate.power_spec,
                "area_m2": rate.area_m2,
                "water_m3_hr": rate.water_m3_hr,
                "consumables": rate.consumables,
                **calculated_values
            }
        }

    except ValueError as e:
        connection.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()


def get_country_rates(country_name):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    cursor.execute("""
        SELECT labor_rate, electricity_rate, water_rate, space_rental_rate, exchange_rate, currency_symbol
        FROM countries WHERE name = %s
    """, (country_name,))
    
    rates = cursor.fetchone()
    cursor.close()
    connection.close()
    
    if not rates:
        raise HTTPException(status_code=400, detail="Invalid country name")

    return rates


    

# CRUD for Item Master
class ItemMaster(BaseModel):
    part_number: str
    description: str
    category: str
    model: str
    uom: str
    material: str
    weight: float
    dimensions: str
    color: str
    supplier: str
    cost_per_unit: float
    min_order_qty: int
    annual_volume: int
    lifetime_volume: int
    compliance_standards: str
    lifecycle_stage: str
    drawing_number: str
    revision_number: int

@app.post("/create-item-master", dependencies=[Depends(role_required("Admin","Manager"))])
def create_item_master(item: ItemMaster):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO item_master (part_number, description, category, model, uom, material, weight, dimensions, 
                                 color, supplier, cost_per_unit, min_order_qty, annual_volume, lifetime_volume, 
                                 compliance_standards, lifecycle_stage, drawing_number, revision_number, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
    """, (item.part_number, item.description, item.category, item.model, item.uom, item.material, item.weight, 
          item.dimensions, item.color, item.supplier, item.cost_per_unit, item.min_order_qty, item.annual_volume, 
          item.lifetime_volume, item.compliance_standards, item.lifecycle_stage, item.drawing_number, item.revision_number))
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": "Item Master created successfully"}

@app.get("/fetch-item-masters")
def fetch_item_master():
    """
    Fetch all Item Master records from the database.
    """
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    query = """
        SELECT 
            id, part_number, description, category, model, uom, material, weight, dimensions,
            color, supplier, cost_per_unit, min_order_qty, annual_volume, lifetime_volume,
            compliance_standards, lifecycle_stage, drawing_number, revision_number, created_at
        FROM item_master WHERE is_deleted = 0;  -- Fetch only active records
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    results = []
    for row in rows:
        item = {
            "id": row[0],
            "part_number": row[1],
            "description": row[2],
            "category": row[3],
            "model": row[4],
            "uom": row[5],
            "material": row[6],
            "weight": row[7],
            "dimensions": row[8],
            "color": row[9],
            "supplier": row[10],
            "cost_per_unit": row[11],
            "min_order_qty": row[12],
            "annual_volume": row[13],
            "lifetime_volume": row[14],
            "compliance_standards": row[15],
            "lifecycle_stage": row[16],
            "drawing_number": row[17],
            "revision_number": row[18],
            "created_at": row[19]
        }
        results.append(item)

    cursor.close()
    connection.close()
    
    return results


@app.get("/fetch-item-masters-dropdown")
def fetch_item_masters_dropdown():
    """
    Retrieve a list of item masters to be used in the dropdown.
    """
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT id, part_number, revision_number FROM item_master WHERE is_deleted = 0
    """)
    item_masters = [
        {"id": row[0], "label": f"{row[1]} - Rev {row[2]}"} for row in cursor.fetchall()
    ]
    
    cursor.close()
    connection.close()
    
    return item_masters

@app.get("/fetch-item-master-relations/{item_master_id}", dependencies=[Depends(role_required("Admin"))])
def fetch_item_master_relations(item_master_id: int):
    conn = pymysql.connect(**db_config)
    try:
        with conn.cursor() as cursor:
            # Fetch related Machine Rate records
            cursor.execute("SELECT * FROM machine_rate_calculation WHERE item_master_id = %s", (item_master_id,))
            machine_rate = cursor.fetchall()

            # Fetch related Cost Aggregate records
            cursor.execute("SELECT * FROM cost_aggregate WHERE item_master_id = %s", (item_master_id,))
            cost_aggregate = cursor.fetchall()

            # Fetch related Process Flow Matrix records
            cursor.execute("SELECT * FROM process_flow_matrix WHERE item_master_id = %s", (item_master_id,))
            process_flow_matrix = cursor.fetchall()

        return {
            "machine_rate": machine_rate,
            "cost_aggregate": cost_aggregate,
            "process_flow_matrix": process_flow_matrix
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching related data: {str(e)}")
    finally:
        conn.close()


@app.delete("/delete-item-master/{item_master_id}", dependencies=[Depends(role_required("Admin"))])
def delete_item_master(item_master_id: int):
    conn = pymysql.connect(**db_config)
    try:
        with conn.cursor() as cursor:
            # Delete related records first
            cursor.execute("DELETE FROM machine_rate_calculation WHERE item_master_id = %s", (item_master_id,))
            cursor.execute("DELETE FROM cost_aggregate WHERE item_master_id = %s", (item_master_id,))
            cursor.execute("DELETE FROM process_flow_matrix WHERE item_master_id = %s", (item_master_id,))

            # Delete the item master itself
            cursor.execute("DELETE FROM item_master WHERE id = %s", (item_master_id,))

            conn.commit()
        return {"message": "Item Master and related data deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting item master: {str(e)}")
    finally:
        conn.close()

#This is temporary not using this api
@app.post("/soft-delete-item-master/{id}", dependencies=[Depends(role_required("Admin"))])
def soft_delete_item_master(id: int):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    cursor.execute("UPDATE item_master SET is_deleted = 1 WHERE id = %s", (id,))
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": "Item Master record soft-deleted"}


@app.post("/bulk-upload-item-master", dependencies=[Depends(role_required("Admin","Manager"))])
def bulk_upload_item_master(file: UploadFile = File(...)):
    contents = file.file.read()
    df = pd.read_excel(BytesIO(contents))
    df = df.where(pd.notnull(df), None)
    column_mapping = {
        "Part Number": "part_number",
        "Description": "description",
        "Category": "category",
        "Model": "model",
        "UOM (Unit of Measure)": "uom",
        "Material": "material",
        "Weight": "weight",
        "Dimensions": "dimensions",
        "Color": "color",
        "Supplier": "supplier",
        "Cost Per Unit": "cost_per_unit",
        "Minimum Order Quantity": "min_order_qty",
        "Annual Volume": "annual_volume",
        "Life Time Volumes": "lifetime_volume",
        "Compliance Standards": "compliance_standards",
        "Lifecycle Stage": "lifecycle_stage",
        "Drawing Number": "drawing_number",
        "Revision Number": "revision_number",
    }
    
    df = df.rename(columns=column_mapping)
    
    def extract_numeric(value):
        if isinstance(value, str):
            return float("".join(filter(str.isdigit, value))) if any(char.isdigit() for char in value) else None
        return value
    
    df["weight"] = df["weight"].astype(str).str.replace(" kg", "").astype(float)
    df["cost_per_unit"] = df["cost_per_unit"].astype(float)
    df["min_order_qty"] = df["min_order_qty"].apply(extract_numeric).astype("Int64")
    df["annual_volume"] = df["annual_volume"].apply(extract_numeric).astype("Int64")
    df["lifetime_volume"] = df["lifetime_volume"].apply(extract_numeric).astype("Int64")
    df["revision_number"] = df["revision_number"].astype("Int64")
    
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    for _, row in df.iterrows():
        cursor.execute(
            """
            INSERT INTO item_master (part_number, description, category, model, uom, material, weight, dimensions, 
                                     color, supplier, cost_per_unit, min_order_qty, annual_volume, lifetime_volume, 
                                     compliance_standards, lifecycle_stage, drawing_number, revision_number, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                row["part_number"], row["description"], row["category"], row["model"], row["uom"], row["material"],
                row["weight"], row["dimensions"], row["color"], row["supplier"], row["cost_per_unit"],
                row["min_order_qty"], row["annual_volume"], row["lifetime_volume"], row["compliance_standards"],
                row["lifecycle_stage"], row["drawing_number"], row["revision_number"]
            )
        )
    
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": "Bulk Item Master upload successful"}


# Process Flow Matrix Model
class ProcessFlowMatrix(BaseModel):
    item_master_id: int
    operation: str
    description: str
    machine_type: int  # Now expects the machine type ID
    cycle_time_sec: int
    yield_percentage: float
    operator_count: float

# Create Process Flow Record
@app.post("/create-process-flow", dependencies=[Depends(role_required("Admin", "Manager"))])
def create_process_flow(flow: ProcessFlowMatrix):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        # Verify item master exists
        cursor.execute("SELECT id FROM item_master WHERE id = %s", (flow.item_master_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Invalid Item Master ID")
    
        # Insert the process flow record (do not include op_no)
        cursor.execute("""
            INSERT INTO process_flow_matrix (
                item_master_id, operation, description, 
                machine_type, cycle_time_sec, yield_percentage, operator_count
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            flow.item_master_id, flow.operation, flow.description,
            flow.machine_type, flow.cycle_time_sec, flow.yield_percentage, flow.operator_count
        ))

        connection.commit()
        return {"message": "Process flow created successfully"}
    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

# Fetch Process Flow Records
@app.get("/fetch-process-flows")
def fetch_process_flows(item_master_id: int):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        # Verify item master exists
        cursor.execute("SELECT id FROM item_master WHERE id = %s", (item_master_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Invalid Item Master ID")

        # Fetch process flow records with machine type name
        cursor.execute("""
            SELECT pf.id, pf.op_no, pf.operation, pf.description, pf.machine_type, mt.machine_type, pf.cycle_time_sec, pf.yield_percentage, pf.operator_count
            FROM process_flow_matrix pf
            LEFT JOIN machine_types mt ON pf.machine_type = mt.id
            WHERE pf.item_master_id = %s
            ORDER BY pf.op_no
        """, (item_master_id,))
        records = cursor.fetchall()
        process_flows = []
        for row in records:
            process_flows.append({
                "id": row[0],
                "op_no": row[1],
                "operation": row[2],
                "description": row[3],
                "machine_type": row[4],  # ID
                "machine_type_name": row[5],  # Name for display
                "cycle_time_sec": row[6],
                "yield_percentage": row[7],
                "operator_count": row[8]
            })
        return process_flows
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

# Delete Process Flow Records
class DeleteProcessFlow(BaseModel):
    ids: List[int]

@retry_on_db_error()
@app.post("/delete-process-flow", dependencies=[Depends(role_required("Admin"))])
def delete_process_flow(delete_request: DeleteProcessFlow):
    if not delete_request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided for deletion")

    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    try:
        # First verify the records exist
        id_list = ','.join(['%s'] * len(delete_request.ids))
        cursor.execute(f"SELECT COUNT(*) FROM process_flow_matrix WHERE id IN ({id_list})", tuple(delete_request.ids))
        count = cursor.fetchone()[0]
        
        if count != len(delete_request.ids):
            raise HTTPException(status_code=404, detail="Some records not found")

        # Perform the deletion
        query = f"DELETE FROM process_flow_matrix WHERE id IN ({id_list})"
        cursor.execute(query, tuple(delete_request.ids))
        connection.commit()

        return {
            "message": f"{count} record(s) deleted successfully",
            "deleted_count": count
        }

    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

# Cost Aggregation Model
class CostAggregate(BaseModel):
    item_master_id: int
    operation: str
    machine_type: int
    machine_rate: float
    labor_rate: float
    input_material_cost: float
    consumables_cost: float

def get_process_flow_data_by_id(process_flow_id):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        cursor.execute("""
            SELECT cycle_time_sec, yield_percentage, operator_count
            FROM process_flow_matrix
            WHERE id = %s
        """, (process_flow_id,))
        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Process flow data not found")
        return {
            "cycle_time_sec": result[0],
            "yield_percentage": result[1],
            "operator_count": result[2]
        }
    finally:
        cursor.close()
        connection.close()

def calculate_costs(data, cycle_time_sec, yield_percentage, operator_count):
    # Calculate costs based on process flow data
    machine_cost = (data.machine_rate * cycle_time_sec) / 3600  # Convert seconds to hours
    labor_cost = (data.labor_rate * operator_count * cycle_time_sec) / 3600
    material_cost = data.input_material_cost
    consumables_cost = data.consumables_cost
    
    # Adjust for yield percentage
    total_cost = (machine_cost + labor_cost + material_cost + consumables_cost) / (yield_percentage / 100)
    
    return {
        "machine_cost": machine_cost,
        "labor_cost": labor_cost,
        "material_cost": material_cost,
        "consumables_cost": consumables_cost,
        "total_cost": total_cost
    }

def to_float(val):
    if isinstance(val, Decimal):
        return float(val)
    return float(val) if val is not None else 0.0

@retry_on_db_error()
@app.post("/create-cost-aggregate", dependencies=[Depends(role_required("Admin", "Manager"))])
def create_cost_aggregate(cost: CostAggregate):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    try:
        # Get process flow details based on item_master_id, operation, and machine_type
        cursor.execute("SELECT * FROM process_flow_matrix WHERE item_master_id = %s AND operation = %s AND machine_type = %s", (cost.item_master_id, cost.operation, cost.machine_type))
        process_flow = cursor.fetchone()
        if not process_flow:
            raise HTTPException(status_code=404, detail="Process flow not found for the given operation, machine type, and item master.")
        op_no = process_flow[2]  # Adjust index if needed
        cycle_time_sec = to_float(process_flow[5])
        yield_percentage = to_float(process_flow[6])
        operator_count = to_float(process_flow[7])

        # Check for duplicate
        cursor.execute(
            "SELECT id FROM cost_aggregate WHERE item_master_id = %s AND operation = %s AND machine_type = %s",
            (cost.item_master_id, cost.operation, cost.machine_type)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Cost aggregate already exists for this process flow.")

        # Convert all numeric fields to float
        cost.machine_rate = to_float(cost.machine_rate)
        cost.labor_rate = to_float(cost.labor_rate)
        cost.input_material_cost = to_float(cost.input_material_cost)
        cost.consumables_cost = to_float(cost.consumables_cost)

        # Calculate costs
        costs = calculate_costs(
            cost, 
            cycle_time_sec,
            yield_percentage,
            operator_count
        )

        # Insert cost aggregation record
        cursor.execute("""
            INSERT INTO cost_aggregate (
                item_master_id, operation, machine_type, machine_rate, labor_rate,
                input_material_cost, consumables_cost, total_cost
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            cost.item_master_id, cost.operation, cost.machine_type, cost.machine_rate, cost.labor_rate,
            cost.input_material_cost, cost.consumables_cost, costs["total_cost"]
        ))

        connection.commit()
        return {"message": "Cost aggregation record created successfully"}

    except pymysql.err.IntegrityError as e:
        connection.rollback()
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=400, detail="Record already present for this operation and machine type.")
        else:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

@app.put("/update-cost-aggregate/{id}", dependencies=[Depends(role_required("Admin", "Manager"))])
def update_cost_aggregate(id: int, cost: CostAggregate):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        # Get process flow details based on item_master_id, operation, and machine_type
        cursor.execute("SELECT * FROM process_flow_matrix WHERE item_master_id = %s AND operation = %s AND machine_type = %s", (cost.item_master_id, cost.operation, cost.machine_type))
        process_flow = cursor.fetchone()
        if not process_flow:
            raise HTTPException(status_code=404, detail="Process flow not found for the given operation, machine type, and item master.")
        op_no = process_flow[2]  # Adjust index if needed
        cycle_time_sec = to_float(process_flow[5])
        yield_percentage = to_float(process_flow[6])
        operator_count = to_float(process_flow[7])

        # Calculate costs
        costs = calculate_costs(
            cost, 
            cycle_time_sec,
            yield_percentage,
            operator_count
        )
        # Update cost aggregation record
        cursor.execute("""
            UPDATE cost_aggregate 
                    SET operation = %s, machine_type = %s, machine_rate = %s, labor_rate = %s,
                        input_material_cost = %s, consumables_cost = %s, total_cost = %s
                    WHERE id = %s
                """, (
                    cost.operation, cost.machine_type, cost.machine_rate, cost.labor_rate,
                    cost.input_material_cost, cost.consumables_cost, costs["total_cost"],
                    id
                ))
        connection.commit()
        return {"message": "Cost aggregation record updated successfully"}
        
    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

class DeleteCostAggregateRequest(BaseModel):
    ids: List[int]

@retry_on_db_error()
@app.post("/delete-cost-aggregate", dependencies=[Depends(role_required("Admin"))])
def delete_cost_aggregate_bulk(request: DeleteCostAggregateRequest):
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided for deletion")
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        id_list = ','.join(['%s'] * len(request.ids))
        cursor.execute(f"DELETE FROM cost_aggregate WHERE id IN ({id_list})", tuple(request.ids))
        connection.commit()
        return {"message": f"{len(request.ids)} cost aggregate(s) deleted successfully"}
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()


class Country(BaseModel):
    name: str
    currency_symbol: str
    labor_rate: float
    electricity_rate: float
    water_rate: float
    space_rental_rate: float
    exchange_rate: float  # Exchange rate to USD


@app.post("/create-country", dependencies=[Depends(role_required("Admin"))])
def create_country(country: Country):
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        connection = pymysql.connect(**db_config)
        cursor = connection.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO countries (name, currency_symbol, labor_rate, electricity_rate, water_rate, space_rental_rate, exchange_rate)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (country.name, country.currency_symbol, country.labor_rate, country.electricity_rate, 
                  country.water_rate, country.space_rental_rate, country.exchange_rate))
            
            connection.commit()
            cursor.close()
            connection.close()
            return {"message": "Country created successfully"}

        except pymysql.err.IntegrityError as e:
            connection.rollback()
            cursor.close()
            connection.close()
            raise HTTPException(status_code=400, detail=str(e))
            
        except pymysql.err.OperationalError as e:
            if "Lock wait timeout" in str(e) and retry_count < max_retries - 1:
                retry_count += 1
                connection.rollback()
                cursor.close()
                connection.close()
                continue
            else:
                connection.rollback()
                cursor.close()
                connection.close()
                raise HTTPException(status_code=500, detail="Database operation failed. Please try again.")
                
        except Exception as e:
            connection.rollback()
            cursor.close()
            connection.close()
            raise HTTPException(status_code=500, detail=str(e))
            
    raise HTTPException(status_code=500, detail="Maximum retry attempts reached. Please try again later.")


@app.get("/fetch-countries")
def fetch_countries():
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT id, name, currency_symbol, labor_rate, electricity_rate, 
               water_rate, space_rental_rate, exchange_rate 
        FROM countries
    """)
    countries = [{
        "id": row[0], 
        "name": row[1],
        "currency_symbol": row[2],
        "labor_rate": row[3],
        "electricity_rate": row[4],
        "water_rate": row[5],
        "space_rental_rate": row[6],
        "exchange_rate": row[7]
    } for row in cursor.fetchall()]
    
    cursor.close()
    connection.close()
    return countries


def get_country_rates(country_name):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()

    cursor.execute("""
        SELECT labor_rate, electricity_rate, water_rate, space_rental_rate, exchange_rate, currency_symbol
        FROM countries WHERE name = %s
    """, (country_name,))
    
    rates = cursor.fetchone()
    cursor.close()
    connection.close()
    
    if not rates:
        raise HTTPException(status_code=400, detail="Invalid country name")

    return rates

@app.put("/update-exchange-rate", dependencies=[Depends(role_required("Admin"))])
def update_exchange_rate(country_id: int, labor_rate: float, electricity_rate: float, 
                        water_rate: float, space_rental_rate: float, exchange_rate: float):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    cursor.execute("""
        UPDATE countries 
        SET labor_rate=%s, electricity_rate=%s, water_rate=%s, space_rental_rate=%s, exchange_rate=%s
        WHERE id=%s
    """, (labor_rate, electricity_rate, water_rate, space_rental_rate, exchange_rate, country_id))
    
    connection.commit()
    cursor.close()
    connection.close()
    return {"message": "Exchange rate updated successfully"}

@app.post("/bulk-upload-machine-rates", dependencies=[Depends(role_required("Admin","Manager"))])
def bulk_upload_machine_rates(file: UploadFile = File(...), item_master_id: int = Form(...)):
    try:
        contents = file.file.read()
        df = pd.read_excel(BytesIO(contents))

        # Define the expected columns and their mappings
        expected_columns = {
            "Machine Type": "machine_type_id",
            "Make": "make_id",
            "Model/Size": "model_size",
            "Purchase $": "purchase_price",
            "Res Value": "res_value",
            "Useful Life": "useful_life",
            "Utilization": "utilization",
            "Maintenance": "maintenance",
            "Power (kW/hr)": "power_kw_hr",
            "Power Spec": "power_spec",
            "Area m2": "area_m2",
            "Water m3/hr": "water_m3_hr",
            "Consumables": "consumables"
        }

        # Verify all required columns are present
        missing_columns = [col for col in expected_columns.keys() if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )

        connection = pymysql.connect(**db_config)
        cursor = connection.cursor()

        # Verify item master exists
        cursor.execute("SELECT id FROM item_master WHERE id = %s", (item_master_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Invalid Item Master ID")

        # Get machine types and makes mappings
        cursor.execute("SELECT id, machine_type FROM machine_types")
        machine_types = {row[1]: row[0] for row in cursor.fetchall()}
        
        cursor.execute("SELECT id, make FROM makes")
        makes = {row[1]: row[0] for row in cursor.fetchall()}

        # Process each row
        success_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Convert machine type and make names to IDs
                machine_type_name = str(row["Machine Type"]).strip()
                make_name = str(row["Make"]).strip()
                
                if machine_type_name not in machine_types:
                    raise ValueError(f"Invalid Machine Type: {machine_type_name}")
                if make_name not in makes:
                    raise ValueError(f"Invalid Make: {make_name}")

                # Prepare data for insertion
                insert_data = {
                    "item_master_id": item_master_id,
                    "machine_type_id": machine_types[machine_type_name],
                    "make_id": makes[make_name],
                    "model_size": str(row["Model/Size"]),
                    "purchase_price": float(row["Purchase $"]),
                    "res_value": float(row["Res Value"]),
                    "useful_life": float(row["Useful Life"]),
                    "utilization": float(row["Utilization"]),
                    "maintenance": float(row["Maintenance"]),
                    "power_kw_hr": float(row["Power (kW/hr)"]),
                    "power_spec": float(row["Power Spec"]),
                    "area_m2": float(row["Area m2"]),
                    "water_m3_hr": float(row["Water m3/hr"]),
                    "consumables": float(row["Consumables"])
                }

                # Insert the record
                cursor.execute("""
                    INSERT INTO machine_rate_calculation (
                        item_master_id, machine_type_id, make_id, model_size,
                        purchase_price, res_value, useful_life, utilization,
                        maintenance, power_kw_hr, power_spec, area_m2,
                        water_m3_hr, consumables
                    ) VALUES (
                        %(item_master_id)s, %(machine_type_id)s, %(make_id)s, %(model_size)s,
                        %(purchase_price)s, %(res_value)s, %(useful_life)s, %(utilization)s,
                        %(maintenance)s, %(power_kw_hr)s, %(power_spec)s, %(area_m2)s,
                        %(water_m3_hr)s, %(consumables)s
                    )
                """, insert_data)
                
                success_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")

        connection.commit()

        # Prepare response
        response = {
            "message": f"Successfully uploaded {success_count} records",
            "total_rows": len(df),
            "successful_uploads": success_count,
            "failed_uploads": len(df) - success_count
        }
        
        if errors:
            response["errors"] = errors

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'connection' in locals():
            cursor.close()
            connection.close()

# ModelSize Pydantic model
class ModelSize(BaseModel):
    model_name: str

# Create ModelSize
@app.post("/create-model-size", dependencies=[Depends(role_required("Admin"))])
def create_model_size(model: ModelSize):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        cursor.execute("INSERT INTO model_size (model_name) VALUES (%s)", (model.model_name,))
        connection.commit()
        return {"message": "Model/Size created successfully"}
    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        connection.close()

# Fetch all ModelSizes
@app.get("/fetch-model-sizes")
def fetch_model_sizes():
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT id, model_name FROM model_size")
        models = [{"id": row[0], "model_name": row[1]} for row in cursor.fetchall()]
        return models
    finally:
        cursor.close()
        connection.close()

# Update ModelSize
@app.put("/update-model-size/{id}", dependencies=[Depends(role_required("Admin"))])
def update_model_size(id: int, model: ModelSize):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        cursor.execute("UPDATE model_size SET model_name = %s WHERE id = %s", (model.model_name, id))
        connection.commit()
        return {"message": "Model/Size updated successfully"}
    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        connection.close()

# Delete ModelSize
@app.delete("/delete-model-size/{id}", dependencies=[Depends(role_required("Admin"))])
def delete_model_size(id: int):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        cursor.execute("DELETE FROM model_size WHERE id = %s", (id,))
        connection.commit()
        return {"message": "Model/Size deleted successfully"}
    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        connection.close()

@app.put("/update-country/{country_id}", dependencies=[Depends(role_required("Admin"))])
def update_country(country_id: int, country: Country):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    try:
        cursor.execute("""
            UPDATE countries 
            SET name=%s, currency_symbol=%s, labor_rate=%s, electricity_rate=%s, 
                water_rate=%s, space_rental_rate=%s, exchange_rate=%s
            WHERE id=%s
        """, (
            country.name, country.currency_symbol, country.labor_rate, 
            country.electricity_rate, country.water_rate, country.space_rental_rate, 
            country.exchange_rate, country_id
        ))
        
        connection.commit()
        return {"message": "Country updated successfully"}
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

class DeleteCountriesRequest(BaseModel):
    ids: List[int]

@retry_on_db_error()
@app.delete("/delete-countries", dependencies=[Depends(role_required("Admin"))])
def delete_countries(request: DeleteCountriesRequest):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    try:
        # Convert list of IDs to a tuple for the IN clause
        ids_tuple = tuple(request.ids)
        if len(ids_tuple) == 1:
            ids_tuple = f"({ids_tuple[0]})"  # Handle single ID case
        
        cursor.execute(f"""
            DELETE FROM countries 
            WHERE id IN {ids_tuple}
        """)
        
        connection.commit()
        return {"message": "Countries deleted successfully"}
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

@app.get("/fetch-cost-aggregates")
def fetch_cost_aggregates(item_master_id: int):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        # Verify item master exists
        cursor.execute("SELECT id FROM item_master WHERE id = %s", (item_master_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Invalid Item Master ID")

        # Fetch cost aggregates with process flow data using item_master_id, operation, and machine_type
        cursor.execute("""
            SELECT 
                ca.id, ca.operation, ca.machine_type, ca.machine_rate, ca.labor_rate,
                ca.input_material_cost, ca.consumables_cost, ca.total_cost,
                pf.id as process_flow_id, pf.op_no, pf.description, pf.machine_type as pf_machine_type, pf.cycle_time_sec,
                pf.yield_percentage, pf.operator_count
            FROM cost_aggregate ca
            LEFT JOIN process_flow_matrix pf ON ca.item_master_id = pf.item_master_id AND ca.operation = pf.operation AND ca.machine_type = pf.machine_type
            WHERE ca.item_master_id = %s
            ORDER BY pf.op_no
        """, (item_master_id,))
        
        records = cursor.fetchall()
        cost_aggregates = []
        cumulative_operating_cost = 0

        for row in records:
            # Convert all numeric fields to float
            operation = row[1]
            machine_type = row[2]
            machine_rate = to_float(row[3])
            labor_rate = to_float(row[4])
            input_material_cost = to_float(row[5])
            consumables_cost = to_float(row[6])
            total_cost_db = to_float(row[7]) if len(row) > 7 else 0
            process_flow_id = row[8]
            op_no = row[9]
            description = row[10]
            pf_machine_type = row[11]
            cycle_time_sec = to_float(row[12])
            yield_percentage = to_float(row[13])
            operator_count = to_float(row[14])

            # Calculate costs
            total_labor_cost = (cycle_time_sec / 3600) * operator_count * labor_rate
            total_machine_cost = (cycle_time_sec / 3600) * machine_rate
            total_operating_cost = input_material_cost + consumables_cost + total_labor_cost + total_machine_cost
            cumulative_operating_cost += total_operating_cost
            yield_loss_cost = (cumulative_operating_cost / (yield_percentage / 100)) - cumulative_operating_cost if yield_percentage else 0
            total_cost = cumulative_operating_cost + yield_loss_cost

            cost_aggregates.append({
                "id": row[0],
                "operation": operation,
                "machine_type": machine_type,
                "process_flow_id": process_flow_id,
                "op_no": op_no,
                "description": description,
                "pf_machine_type": pf_machine_type,
                "cycle_time_sec": cycle_time_sec,
                "yield_percentage": yield_percentage,
                "operator_count": operator_count,
                "machine_rate": machine_rate,
                "labor_rate": labor_rate,
                "input_material_cost": input_material_cost,
                "consumables_cost": consumables_cost,
                "total_labor_cost": round(total_labor_cost, 3),
                "total_machine_cost": round(total_machine_cost, 3),
                "total_operating_cost": round(total_operating_cost, 3),
                "cumulative_operating_cost": round(cumulative_operating_cost, 3),
                "yield_loss_cost": round(yield_loss_cost, 3),
                "total_cost": round(total_cost, 3),
                "total_cost_db": round(total_cost_db, 3)
            })
        
        return cost_aggregates
    finally:
        cursor.close()
        connection.close()

# Fetch Machine Types
@app.get("/machine-types")
def get_machine_types():
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT id, name FROM machine_types")
        machine_types = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
        return machine_types
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        connection.close()

@app.delete("/delete-machine-type/{id}", dependencies=[Depends(role_required("Admin"))])
def delete_machine_type(id: int):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        # First check if the machine type exists
        cursor.execute("SELECT id FROM machine_types WHERE id = %s", (id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Machine type not found")

        # Check if the machine type is being used in any process flows
        cursor.execute("SELECT COUNT(*) FROM process_flow_matrix WHERE machine_type = %s", (id,))
        if cursor.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="Cannot delete machine type as it is being used in process flows")

        # Check if the machine type is being used in any machine rate calculations
        cursor.execute("SELECT COUNT(*) FROM machine_rate_calculation WHERE machine_type_id = %s", (id,))
        if cursor.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="Cannot delete machine type as it is being used in machine rate calculations")

        # If not in use, proceed with deletion
        cursor.execute("DELETE FROM machine_types WHERE id = %s", (id,))
        connection.commit()
        return {"message": "Machine type deleted successfully"}
    except pymysql.Error as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except HTTPException as e:
        connection.rollback()
        raise e
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        connection.close()

@app.get("/cost-aggregate/final-cost/{item_master_id}")
def calculate_final_cost(item_master_id: int = Path(..., description="ID of the item master")):
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    try:
        # Verify item master exists
        cursor.execute("SELECT id FROM item_master WHERE id = %s", (item_master_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Invalid Item Master ID")

        # Fetch all cost aggregates for the item_master_id
        cursor.execute("SELECT total_cost FROM cost_aggregate WHERE item_master_id = %s", (item_master_id,))
        rows = cursor.fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail="No cost aggregates found for this Item Master ID")

        base_total_cost = sum([float(row[0]) for row in rows])
        material_handling = round(0.02 * base_total_cost, 2)
        overheads = round(0.075 * base_total_cost, 2)
        profit = round(0.075 * base_total_cost, 2)
        final_total_cost = round(base_total_cost + material_handling + overheads + profit, 2)

        return {
            "base_total_cost": round(base_total_cost, 2),
            "material_handling": material_handling,
            "overheads": overheads,
            "profit": profit,
            "final_total_cost": final_total_cost,
            "material_handling_percentage": 2.0,
            "overheads_percentage": 7.5,
            "profit_percentage": 7.5
        }
    finally:
        cursor.close()
        connection.close()

@app.on_event("startup")
async def startup_event():
    """Create database tables on startup if they don't exist"""
    connection = pymysql.connect(**db_config)
    cursor = connection.cursor()
    
    try:
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(100),
                role VARCHAR(20) DEFAULT 'User'
            )
        """)
        
        # Create machine_types table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS machine_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                machine_type VARCHAR(100) NOT NULL
            )
        """)
        
        # Create makes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS makes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                make VARCHAR(100) NOT NULL
            )
        """)
        
        # Create model_sizes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS model_size (
                id INT AUTO_INCREMENT PRIMARY KEY,
                model_name VARCHAR(100) NOT NULL
            )
        """)
        
        # Create countries table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS countries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                currency_symbol VARCHAR(10),
                labor_rate DECIMAL(10,2),
                electricity_rate DECIMAL(10,2),
                water_rate DECIMAL(10,2),
                space_rental_rate DECIMAL(10,2),
                exchange_rate DECIMAL(10,4)
            )
        """)
        
        # Create item_master table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS item_master (
                id INT AUTO_INCREMENT PRIMARY KEY,
                part_number VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                category VARCHAR(100),
                model VARCHAR(100),
                uom VARCHAR(20),
                material VARCHAR(100),
                weight DECIMAL(10,2),
                dimensions VARCHAR(100),
                color VARCHAR(50),
                supplier VARCHAR(100),
                cost_per_unit DECIMAL(10,2),
                min_order_qty INT,
                annual_volume INT,
                lifetime_volume INT,
                compliance_standards TEXT,
                lifecycle_stage VARCHAR(50),
                drawing_number VARCHAR(100),
                revision_number INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT FALSE
            )
        """)
        
        # Create machine_rate_calculations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS machine_rate_calculation (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_master_id INT,
                machine_type_id INT,
                make_id INT,
                model_size VARCHAR(100),
                purchase_price DECIMAL(15,2),
                res_value DECIMAL(15,2),
                useful_life DECIMAL(10,2),
                utilization DECIMAL(5,2),
                maintenance DECIMAL(5,2),
                power_kw_hr DECIMAL(10,2),
                power_spec DECIMAL(10,2),
                area_m2 DECIMAL(10,2),
                water_m3_hr DECIMAL(10,2),
                consumables DECIMAL(10,2),
                country VARCHAR(50),
                depreciation DECIMAL(15,2),
                maintenance_1 DECIMAL(15,2),
                space DECIMAL(15,2),
                power DECIMAL(15,2),
                water DECIMAL(15,2),
                total_dollar_hr DECIMAL(15,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_master_id) REFERENCES item_master(id),
                FOREIGN KEY (machine_type_id) REFERENCES machine_types(id),
                FOREIGN KEY (make_id) REFERENCES makes(id)
            )
        """)
        
        # Create process_flow_matrix table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS process_flow_matrix (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_master_id INT,
                op_no INT,
                operation VARCHAR(100),
                description TEXT,
                machine_type INT,
                cycle_time_sec INT,
                yield_percentage DECIMAL(5,2),
                operator_count DECIMAL(5,2),
                FOREIGN KEY (item_master_id) REFERENCES item_master(id),
                FOREIGN KEY (machine_type) REFERENCES machine_types(id)
            )
        """)
        
        # Create cost_aggregate table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cost_aggregate (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_master_id INT,
                operation VARCHAR(100),
                machine_type INT,
                machine_rate DECIMAL(15,2),
                labor_rate DECIMAL(15,2),
                input_material_cost DECIMAL(15,2),
                consumables_cost DECIMAL(15,2),
                total_cost DECIMAL(15,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_master_id) REFERENCES item_master(id),
                FOREIGN KEY (machine_type) REFERENCES machine_types(id)
            )
        """)
        
        # Create edit_requests table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS edit_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                table_name VARCHAR(50),
                record_id INT,
                field_name VARCHAR(50),
                old_value TEXT,
                new_value TEXT,
                requested_by VARCHAR(50),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create test user for CI/CD
        cursor.execute("SELECT id FROM users WHERE username = %s", ("Lakshk",))
        if not cursor.fetchone():
            # Create test user with hashed password
            hashed_password = pwd_context.hash("Lakshk@257")
            cursor.execute("INSERT INTO users (username, password_hash, email, role) VALUES (%s, %s, %s, %s)", 
                         ("Lakshk", hashed_password, "test@example.com", "Admin"))
            print("Test user 'Lakshk' created successfully!")
        
        connection.commit()
        print("Database tables created successfully!")
        
    except Exception as e:
        print(f"Error creating tables: {e}")
        connection.rollback()
    finally:
        cursor.close()
        connection.close()
