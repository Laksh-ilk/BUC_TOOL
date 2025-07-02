# BUC Tool - Machine Rate Calculator

A comprehensive web application for calculating machine rates with currency conversion and cost aggregation features.

## 🚀 Features

- **Machine Rate Calculations** with country-specific rates
- **Currency Conversion** support for multiple countries
- **Cost Aggregation** for manufacturing processes
- **Process Flow Management** with cycle time calculations
- **Item Master Management** with comprehensive part tracking
- **Role-based Access Control** (Admin, Manager, User)
- **Bulk Upload** capabilities for data import
- **Real-time Calculations** with automatic updates

## 🏗️ Architecture

- **Frontend**: React Admin with Material-UI
- **Backend**: FastAPI with Python 3.12
- **Database**: MySQL 8.0
- **Containerization**: Docker & Docker Compose

## 📋 Prerequisites

- Docker and Docker Compose
- Git
- At least 4GB RAM available

## 🛠️ Installation & Setup

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd BUC_Tool_1
   ```

2. **Start the application**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Option 2: Manual Setup

1. **Backend Setup**
   ```bash
   cd FastAPI-Database
   python -m venv env
   source env/bin/activate  # On Windows: env\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Frontend Setup**
   ```bash
   cd react-admin
   npm install
   npm start
   ```

3. **Database Setup**
   - Install MySQL 8.0
   - Create database named 'buc'
   - Run the initialization script: `database/init.sql`

## 🔐 Default Login Credentials

- **Admin**: username: `admin`, password: `admin123`
- **Manager**: username: `manager`, password: `manager123`
- **User**: username: `user`, password: `user123`

## 📊 Database Schema

The application includes the following main tables:

- `users` - User authentication and roles
- `item_master` - Part and component information
- `machine_rate_calculation` - Machine rate data and calculations
- `process_flow_matrix` - Manufacturing process flows
- `cost_aggregate` - Cost aggregation data
- `countries` - Country-specific rates and exchange rates
- `machine_types` - Available machine types
- `makes` - Machine manufacturers
- `model_sizes` - Machine model sizes

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=buc

# API Configuration
API_BASE_URL=http://localhost:8000

# JWT Configuration
SECRET_KEY=your-secret-key
```

### Docker Environment Variables

The Docker Compose file includes default environment variables that can be overridden:

```yaml
environment:
  - DB_HOST=mysql
  - DB_USER=root
  - DB_PASSWORD=root
  - DB_NAME=buc
```

## 🧮 Machine Rate Calculations

The application calculates machine rates using the following formulas:

```
Depreciation = (Purchase Price - Residual Value) / (Useful Life × Annual Hours × Utilization)
Maintenance = (Purchase Price × Maintenance %) / (Useful Life × Annual Hours)
Space = (Space Rental Rate × Area) / (Annual Hours/12 × Utilization)
Power = Electricity Rate × Power (kW/hr) × Power Spec
Water = Water Rate × Water (m³/hr)
Total $/hr = Depreciation + Maintenance + Space + Power + Water + Consumables
```

## 🌍 Currency Conversion

The application supports multiple currencies with automatic conversion:

- **India**: ₹ (INR) - Exchange Rate: 0.012
- **America**: $ (USD) - Exchange Rate: 1.0
- **China**: ¥ (CNY) - Exchange Rate: 0.14
- **Germany**: € (EUR) - Exchange Rate: 1.08
- **Japan**: ¥ (JPY) - Exchange Rate: 0.0067

## 📈 API Endpoints

### Authentication
- `POST /login` - User login
- `POST /register` - User registration
- `POST /refresh-token` - Refresh JWT token

### Machine Rates
- `GET /machine-rate-data` - Get machine rate data
- `POST /create-machine-rate` - Create new machine rate
- `PUT /update-machine-rate/{id}` - Update machine rate
- `POST /delete-machine-rate` - Delete machine rates
- `POST /bulk-upload-machine-rates` - Bulk upload machine rates

### Item Master
- `GET /fetch-item-masters` - Get all item masters
- `POST /create-item-master` - Create new item master
- `DELETE /delete-item-master/{id}` - Delete item master
- `POST /bulk-upload-item-master` - Bulk upload item masters

### Countries
- `GET /fetch-countries` - Get all countries
- `POST /create-country` - Create new country
- `PUT /update-country/{id}` - Update country

### Process Flow
- `GET /fetch-process-flows` - Get process flows
- `POST /create-process-flow` - Create new process flow
- `POST /delete-process-flow` - Delete process flows

### Cost Aggregation
- `GET /fetch-cost-aggregates` - Get cost aggregates
- `POST /create-cost-aggregate` - Create new cost aggregate
- `GET /cost-aggregate/final-cost/{item_master_id}` - Calculate final cost

## 🐳 Docker Commands

### Build and Run
```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Individual Services
```bash
# Build specific service
docker-compose build backend

# Run specific service
docker-compose up backend

# View service logs
docker-compose logs backend
```

## 🧪 Testing

### Backend Testing
```bash
cd FastAPI-Database
python -m pytest tests/
```

### Frontend Testing
```bash
cd react-admin
npm test
```

### API Testing
Access the interactive API documentation at: http://localhost:8000/docs

## 📝 Development

### Code Structure
```
BUC_Tool_1/
├── FastAPI-Database/     # Backend API
│   ├── main.py          # Main FastAPI application
│   ├── models.py        # Pydantic models
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Backend Docker configuration
├── react-admin/         # Frontend React application
│   ├── src/            # React source code
│   ├── package.json    # Node.js dependencies
│   └── Dockerfile      # Frontend Docker configuration
├── database/           # Database scripts
│   └── init.sql       # Database initialization
├── docker-compose.yml  # Docker orchestration
└── README.md          # This file
```

### Adding New Features

1. **Backend Changes**
   - Add new endpoints in `main.py`
   - Update models in `models.py`
   - Add database migrations if needed

2. **Frontend Changes**
   - Add new components in `src/components/`
   - Add new pages in `src/scenes/`
   - Update routing in `App.js`

3. **Database Changes**
   - Update `database/init.sql`
   - Create migration scripts if needed

## 🔒 Security

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- SQL injection prevention
- CORS configuration
- Secure headers in nginx

## 📊 Monitoring

### Health Checks
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Database: MySQL connection monitoring

### Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mysql
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the API documentation at http://localhost:8000/docs

## 🔄 Updates

To update the application:

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📋 Changelog

### Version 1.0.0
- Initial release
- Machine rate calculations
- Currency conversion
- Cost aggregation
- Process flow management
- Docker containerization 