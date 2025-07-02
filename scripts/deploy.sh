#!/bin/bash

# BUC Tool Deployment Script
# This script deploys the BUC Tool application using Docker Compose

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if ports are available
check_ports() {
    local ports=("3000" "8000" "3306")
    
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "Port $port is already in use. Please stop the service using this port."
            read -p "Do you want to continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    done
}

# Backup existing data
backup_data() {
    if [ -d "data" ]; then
        print_status "Creating backup of existing data..."
        tar -czf "backup_$(date +%Y%m%d_%H%M%S).tar.gz" data/
        print_success "Backup created successfully"
    fi
}

# Deploy the application
deploy() {
    print_status "Starting deployment..."
    
    # Stop existing containers
    print_status "Stopping existing containers..."
    docker-compose down --remove-orphans
    
    # Build and start services
    print_status "Building and starting services..."
    docker-compose build --no-cache
    
    print_status "Starting services..."
    docker-compose up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_health
}

# Check service health
check_health() {
    print_status "Checking service health..."
    
    # Check backend
    if curl -f http://localhost:8000/docs > /dev/null 2>&1; then
        print_success "Backend is running at http://localhost:8000"
    else
        print_error "Backend is not responding"
        return 1
    fi
    
    # Check frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend is running at http://localhost:3000"
    else
        print_error "Frontend is not responding"
        return 1
    fi
    
    # Check database
    if docker-compose exec mysql mysqladmin ping -h localhost > /dev/null 2>&1; then
        print_success "Database is running"
    else
        print_error "Database is not responding"
        return 1
    fi
}

# Show application status
show_status() {
    print_status "Application Status:"
    echo
    docker-compose ps
    echo
    print_status "Service URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Documentation: http://localhost:8000/docs"
    echo
    print_status "Default Login Credentials:"
    echo "  Admin: admin / admin123"
    echo "  Manager: manager / manager123"
    echo "  User: user / user123"
}

# Show logs
show_logs() {
    print_status "Showing application logs..."
    docker-compose logs -f
}

# Stop the application
stop_app() {
    print_status "Stopping application..."
    docker-compose down
    print_success "Application stopped"
}

# Restart the application
restart_app() {
    print_status "Restarting application..."
    docker-compose restart
    print_success "Application restarted"
}

# Update the application
update_app() {
    print_status "Updating application..."
    
    # Pull latest changes
    git pull origin main
    
    # Rebuild and restart
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    
    print_success "Application updated"
}

# Main script logic
main() {
    case "${1:-deploy}" in
        "deploy")
            check_docker
            check_ports
            backup_data
            deploy
            show_status
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "stop")
            stop_app
            ;;
        "restart")
            restart_app
            ;;
        "update")
            update_app
            ;;
        "help"|"-h"|"--help")
            echo "BUC Tool Deployment Script"
            echo
            echo "Usage: $0 [COMMAND]"
            echo
            echo "Commands:"
            echo "  deploy   - Deploy the application (default)"
            echo "  status   - Show application status"
            echo "  logs     - Show application logs"
            echo "  stop     - Stop the application"
            echo "  restart  - Restart the application"
            echo "  update   - Update the application"
            echo "  help     - Show this help message"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 