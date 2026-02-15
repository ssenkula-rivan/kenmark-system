# Print Shop Daily Production & Revenue System (PSDPRS)

**© 2026 CRANCITECH - Proprietary Software**

A comprehensive full-stack system for tracking daily production and revenue in print shops with support for large format printers and digital presses.

## 📋 License & Usage Rights

This software is **proprietary and owned by CRANCITECH**.

✅ **Permitted Use:**
- Deploy and use for your business operations
- Create accounts and use all features
- Modify for your internal use only

❌ **Restrictions:**
- Cannot claim ownership
- Cannot sell or redistribute
- Cannot remove CRANCITECH attribution
- Cannot create competing products

**See [LICENSE](LICENSE) file for complete terms.**

## Features

### Worker Features
- Create jobs with automatic amount calculation
- View daily totals and job history
- Support for both large format (sqm) and digital press (piece) jobs
- Real-time job tracking

### Admin Features
- Comprehensive daily reports (PDF/Excel)
- Machine-wise performance analysis
- Worker productivity tracking
- Job type revenue breakdown
- Pricing management
- User and machine management
- Audit log viewing

### Technical Features
- JWT-based authentication
- Role-based access control
- Automatic amount calculation
- Audit logging for all actions
- Rate limiting and security middleware
- Responsive design
- Real-time data updates

## Network Access

### Access from Any Computer on Your Network

The system is configured to work on your local network. To access from other computers:

1. **Get your network URL:**
   ```bash
   ./get-network-url.sh
   ```

2. **Share the URL** (example: `http://192.168.118.24:3000`) with other computers on the same network

3. **Requirements:**
   - All computers must be on the same WiFi/LAN
   - Server computer must be running both backend and frontend
   - No internet connection required

See [NETWORK_ACCESS_GUIDE.md](NETWORK_ACCESS_GUIDE.md) for detailed instructions.

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd psdprs
```

2. Install backend dependencies
```bash
npm install
```

3. Configure environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Setup database
```bash
# Create database
mysql -u root -p
CREATE DATABASE psdprs_db;
exit

# Run migrations and seed data
npm run migrate -- --seed
```

5. Start backend
```bash
npm run dev
```

6. Install and start frontend
```bash
cd frontend
npm install
npm run dev
```

7. Access the application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Default Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

**Workers:**
- Username: `worker1` / Password: `worker123`
- Username: `worker2` / Password: `worker123`

⚠️ Change these passwords immediately!

## Documentation

- [Setup Guide](SETUP_GUIDE.md) - Detailed setup instructions
- [API Documentation](API_DOCUMENTATION.md) - Complete API reference
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Project Structure](PROJECT_STRUCTURE.md) - Code organization
- [Security Guidelines](SECURITY.md) - Security best practices

## Tech Stack

### Backend
- Node.js & Express
- MySQL with connection pooling
- JWT authentication
- Winston logging
- PDFKit & ExcelJS for reports
- Bcrypt for password hashing

### Frontend
- React 18
- React Router v6
- Axios for API calls
- Vite for build tooling
- date-fns for date formatting

## Project Structure

```
├── src/                    # Backend source
│   ├── config/            # Configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Express middleware
│   ├── migrations/        # Database migrations
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── utils/             # Utilities
├── frontend/              # Frontend application
│   └── src/
│       ├── components/    # React components
│       ├── context/       # React context
│       ├── pages/         # Page components
│       └── services/      # API services
└── logs/                  # Application logs
```

## Scripts

### Backend
```bash
npm start          # Start production server
npm run dev        # Start development server
npm run migrate    # Run database migrations
npm run seed       # Seed database
npm test           # Run tests
```

### Frontend
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
```

## Database Schema

- **users** - User accounts (admin/worker)
- **machines** - Print machines
- **job_types** - Types of print jobs
- **pricing** - Pricing rates
- **jobs** - Production jobs
- **audit_logs** - System audit trail

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/change-password` - Change password

### Jobs (Worker)
- `POST /api/jobs` - Create job
- `GET /api/jobs/my-jobs` - Get worker's jobs
- `GET /api/jobs/my-daily-total` - Get daily total
- `GET /api/jobs/job-types` - Get available job types

### Admin
- `GET /api/admin/daily-summary` - Daily statistics
- `GET /api/admin/machine-summary` - Machine breakdown
- `GET /api/admin/worker-summary` - Worker performance
- `GET /api/admin/reports/pdf` - Download PDF report
- `GET /api/admin/reports/excel` - Download Excel report
- `GET /api/admin/pricing` - Manage pricing
- `GET /api/admin/users` - Manage users
- `GET /api/admin/machines` - Manage machines
- `GET /api/admin/audit-logs` - View audit logs

## Security

- JWT token authentication
- Bcrypt password hashing
- Role-based access control
- Rate limiting
- SQL injection prevention
- XSS protection
- CORS configuration
- Audit logging

## License

Proprietary - All rights reserved

## Support

For issues and questions, please contact the development team.
