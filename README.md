# WT Invoices - Invoice Management System

A comprehensive React-based invoice management application for Walls & Trends with multi-currency support, PDF generation, and Firebase integration.

## Features

- **Multi-Company Support**: WT/WTPL and WTX/WTXPL operations
- **Client Management**: Advanced client registration with GST/PAN validation
- **Invoice Generation**: Automated PDF creation with tax calculations
- **Project Management**: Company-specific project workflows
- **Multi-Currency Support**: Support for INR, USD, EUR, and other currencies
- **PDF Management**: Chunked storage for large PDF files
- **Audit Management**: Automated monthly audit report generation
- **Real-time Dashboard**: Live data updates with Firebase

## Technology Stack

- **Frontend**: React 19.1.0 with Vite 6.3.5
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Styling**: Tailwind CSS
- **PDF Generation**: jsPDF, jsPDF-AutoTable
- **State Management**: React Hooks
- **Routing**: React Router DOM

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

```
wt-invoices/
├── src/
│   ├── components/     # React components
│   ├── utils/         # PDF generation utilities
│   ├── constants/     # Country/state data
│   └── assets/        # Images and logos
├── public/            # Static assets
└── functions/         # Firebase Cloud Functions
```

## Key Components

- **DashboardLayout**: Main application layout with navigation
- **CreateInvoice**: Invoice creation with GST calculations
- **PDFManager**: PDF file management and organization
- **AuditManager**: Monthly audit report automation
- **ClientSignup**: Client registration with validation

## Currency Support

The system supports multiple currencies with:
- Automatic currency selection based on client country
- Real-time exchange rate integration
- GST calculations for Indian clients (INR only)
- Multi-currency PDF generation

## PDF Generation

- **Tax Invoices**: Formal invoices with GST calculations
- **Proforma Invoices**: Quotations and estimates
- **Chunked Storage**: Large PDF files stored in 800KB chunks
- **Brand-specific Styling**: Different layouts for WT vs WTX

## Deployment

The application is configured for Firebase hosting with:
- SPA routing support
- PDF file storage
- Real-time data synchronization
=======
# Wallsandtrends-invoicesnew
>>>>>>> 798a82e18d77378d7e6d00d144faee7a4a7d2a8a
