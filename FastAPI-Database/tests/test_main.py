import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_docs_endpoint():
    """Test that docs are available"""
    response = client.get("/docs")
    assert response.status_code == 200

def test_openapi_endpoint():
    """Test that OpenAPI schema is available"""
    response = client.get("/openapi.json")
    assert response.status_code == 200

def test_fetch_machine_types():
    """Test fetch machine types endpoint"""
    response = client.get("/fetch-machine-types")
    assert response.status_code in [200, 401]  # 401 if no auth, 200 if auth

def test_fetch_makes():
    """Test fetch makes endpoint"""
    response = client.get("/fetch-makes")
    assert response.status_code in [200, 401]  # 401 if no auth, 200 if auth

def test_fetch_countries():
    """Test fetch countries endpoint"""
    response = client.get("/fetch-countries")
    assert response.status_code in [200, 401]  # 401 if no auth, 200 if auth 