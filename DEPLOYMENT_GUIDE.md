# BUC Tool - Deployment Guide

## 🚀 Quick Start

### For Windows Users:
```cmd
# Navigate to project directory
cd BUC_Tool_1

# Run deployment script
scripts\deploy.bat

# Or manually with Docker Compose
docker-compose up -d
```

### For Linux/Mac Users:
```bash
# Navigate to project directory
cd BUC_Tool_1

# Make script executable (Linux/Mac only)
chmod +x scripts/deploy.sh

# Run deployment script
./scripts/deploy.sh

# Or manually with Docker Compose
docker-compose up -d
```

## 📋 Prerequisites

1. **Docker Desktop** installed and running
2. **Git** for version control
3. **At least 4GB RAM** available
4. **Ports 3000, 8000, 3306** available

## 🔧 Installation Steps

### Step 1: Clone the Repository
```bash
git clone <your-private-repo-url>
cd BUC_Tool_1
```

### Step 2: Deploy with Docker Compose
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

### Step 3: Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🔐 Default Login Credentials

- **Admin**: `admin` / `admin123`
- **Manager**: `manager` / `manager123`
- **User**: `user` / `user123`

## 🛠️ Management Commands

### Using Deployment Scripts

**Windows:**
```cmd
scripts\deploy.bat deploy    # Deploy application
scripts\deploy.bat status    # Check status
scripts\deploy.bat logs      # View logs
scripts\deploy.bat stop      # Stop application
scripts\deploy.bat restart   # Restart application
scripts\deploy.bat update    # Update application
```

**Linux/Mac:**
```bash
./scripts/deploy.sh deploy    # Deploy application
./scripts/deploy.sh status    # Check status
./scripts/deploy.sh logs      # View logs
./scripts/deploy.sh stop      # Stop application
./scripts/deploy.sh restart   # Restart application
./scripts/deploy.sh update    # Update application
```

### Using Docker Compose Directly

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check service status
docker-compose ps

# Access specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mysql
```

## 🔄 Updates and Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Backup
```bash
# Create backup
docker-compose exec mysql mysqldump -u root -proot buc > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose exec -T mysql mysql -u root -proot buc < backup_file.sql
```

### Troubleshooting

#### Common Issues:

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   netstat -ano | findstr :3000  # Windows
   lsof -i :3000                 # Linux/Mac
   
   # Stop the conflicting service or change ports in docker-compose.yml
   ```

2. **Docker Not Running**
   ```bash
   # Start Docker Desktop
   # On Windows: Start Docker Desktop application
   # On Linux: sudo systemctl start docker
   ```

3. **Database Connection Issues**
   ```bash
   # Check database container
   docker-compose logs mysql
   
   # Restart database
   docker-compose restart mysql
   ```

4. **Memory Issues**
   ```bash
   # Check Docker memory allocation
   # Increase memory in Docker Desktop settings
   ```

#### Reset Everything
```bash
# Stop and remove everything
docker-compose down -v
docker system prune -a --volumes

# Rebuild from scratch
docker-compose up -d --build
```

## 📊 Monitoring

### Health Checks
- **Backend**: http://localhost:8000/docs
- **Frontend**: http://localhost:3000
- **Database**: `docker-compose exec mysql mysqladmin ping`

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
```

### Resource Usage
```bash
# Check container resource usage
docker stats

# Check disk usage
docker system df
```

## 🔒 Security Considerations

1. **Change Default Passwords**
   - Update default user passwords in the database
   - Use strong passwords for production

2. **Environment Variables**
   - Create `.env` file for sensitive data
   - Never commit `.env` files to version control

3. **Network Security**
   - Use HTTPS in production
   - Configure firewall rules
   - Limit access to necessary ports only

## 🌐 Production Deployment

### Environment Variables
Create a `.env` file:
```env
# Database
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=buc

# API
API_BASE_URL=https://your-api-domain.com

# JWT
SECRET_KEY=your-secret-key
```

### Production Docker Compose
```yaml
version: '3.8'
services:
  backend:
    environment:
      - DB_HOST=${DB_HOST}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
    restart: unless-stopped
    
  frontend:
    environment:
      - REACT_APP_API_BASE_URL=${API_BASE_URL}
    restart: unless-stopped
```

## 📞 Support

For issues and questions:
1. Check the logs: `docker-compose logs`
2. Review the README.md file
3. Check API documentation: http://localhost:8000/docs
4. Create an issue in the GitHub repository
5. Contact the development team

## 📝 Development Workflow

### Adding New Features
1. Create a feature branch: `git checkout -b feature/new-feature`
2. Make changes and test locally
3. Commit changes: `git commit -m "Add new feature"`
4. Push to branch: `git push origin feature/new-feature`
5. Create pull request

### Testing Changes
```bash
# Test backend changes
cd FastAPI-Database
python -m pytest tests/

# Test frontend changes
cd react-admin
npm test

# Test with Docker
docker-compose build
docker-compose up -d
```

## 🎯 Best Practices

1. **Always backup before updates**
2. **Test changes in development first**
3. **Use meaningful commit messages**
4. **Keep dependencies updated**
5. **Monitor application health**
6. **Document configuration changes**
7. **Use environment variables for secrets**
8. **Regular database backups**

## 📋 Checklist for New Team Members

- [ ] Install Docker Desktop
- [ ] Clone the repository
- [ ] Run `docker-compose up -d`
- [ ] Access http://localhost:3000
- [ ] Login with default credentials
- [ ] Test basic functionality
- [ ] Read the README.md
- [ ] Review API documentation
- [ ] Set up development environment
- [ ] Join team communication channels 