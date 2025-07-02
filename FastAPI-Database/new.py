from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hashed_password = pwd_context.hash("Lakshk@257")
print(hashed_password)