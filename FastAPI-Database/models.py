from sqlalchemy import Column,Integer,String
from database import Base

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key= True, index= True)
    username = Column(String(50), unique=True)

class Post(Base):
    __tablename__ = 'posts'


    id = Column(Integer, primary_key= True, index= True)
    title = Column(String(50))
    Content = Column(String(50))
    user_id = Column(Integer)
