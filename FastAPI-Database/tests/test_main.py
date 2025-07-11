import pytest
from fastapi.testclient import TestClient
from main import app, startup_event

client = TestClient(app)

# Use manually created user
TEST_USER = {
    "username": "Lakshk",
    "password": "Lakshk@257"
}

@pytest.fixture(autouse=True)
def setup_database():
    """Ensure database tables are created before each test"""
    import asyncio
    asyncio.run(startup_event())

def test_login():
    login_data = {"username": TEST_USER["username"], "password": TEST_USER["password"]}
    response = client.post("/login", json=login_data)
    print("Status:", response.status_code)
    print("Response:", response.text)
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token is not None 