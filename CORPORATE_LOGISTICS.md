# Corporate Logistics Dashboard

A comprehensive corporate logistics management system with multi-role access, approval workflows, and reporting capabilities.

## Features Implemented

### 1. Role-Based Access Control
- **Corporate Admin**: Full access to company management, approvals, and settings
- **Corporate Staff**: Can create delivery requests and view company deliveries
- **Corporate Finance**: Read-only access to reports and delivery history

### 2. Corporate Admin Dashboard
- Real-time statistics and metrics
- Pending approvals counter
- Active deliveries tracking
- Monthly spend overview
- Quick actions for common tasks

### 3. Approval Workflow
- Configurable approval requirement (per company setting)
- Admin can approve or reject delivery requests
- Add notes during approval/rejection
- Real-time updates when orders are reviewed
- Staff sees approval status on their requests

### 4. Delivery Management
- Create individual delivery requests
- Assign deliveries to departments/cost centers
- Add PO numbers and internal references
- Filter by status (all, pending, active, completed)
- Real-time tracking updates

### 5. Bulk Deliveries
- Create multiple deliveries in a single request
- Group related deliveries together
- Track completion progress
- All deliveries inherit company and department settings

### 6. Scheduled Deliveries
- Set up recurring delivery schedules
- Support for daily, weekly, and monthly recurrence
- Specify exact time for delivery execution
- Toggle schedules active/inactive
- Automatic order creation based on schedule

### 7. Reports & Analytics
- Current month summary with key metrics
- Monthly historical data
- Export functionality (CSV/PDF ready)
- Delivery trends and spending analysis
- Department-wise breakdown

### 8. Company Settings
- Manage departments and cost centers
- Add/remove staff members
- Assign roles (Admin, Staff, Finance)
- Control approval requirements
- View company information

### 9. Department Management
- Create departments with codes and cost centers
- Assign deliveries to specific departments
- Track department-wise spending
- Enable/disable departments

### 10. Staff Management
- Invite users to join company
- Assign roles and permissions
- Set employee IDs
- Enable/disable staff access
- View staff activity

## Database Schema

### Core Tables
- **companies**: Corporate client information
- **company_staff**: Links users to companies with roles
- **departments**: Organizational units for cost tracking
- **corporate_orders**: Extended order info for corporate clients
- **bulk_deliveries**: Groups of related deliveries
- **bulk_delivery_items**: Individual items in bulk orders
- **scheduled_deliveries**: Recurring delivery schedules
- **company_invoices**: Monthly billing information
- **invoice_line_items**: Itemized charges

## Security Features

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only access their company's data
- Role-based access within companies
- Admin users have elevated permissions
- Finance users have read-only access

### Helper Functions
- `is_company_admin()`: Check if user is company admin
- `is_company_member()`: Verify company membership
- `get_user_company_staff()`: Retrieve user's company role

## User Workflows

### Corporate Admin Workflow
1. View dashboard with company metrics
2. Review pending delivery requests
3. Approve or reject with notes
4. Manage departments and staff
5. View reports and export data
6. Configure scheduled deliveries

### Corporate Staff Workflow
1. Create delivery requests
2. Assign to departments
3. Add PO numbers and references
4. Track delivery status
5. Create bulk deliveries
6. Set up recurring schedules

### Corporate Finance Workflow
1. View delivery history (read-only)
2. Access reports and analytics
3. Export data for accounting
4. Monitor spending trends
5. Review invoices

## Technical Implementation

### Context Management
- **CorporateContext**: Manages corporate user state
- Provides company information and role checks
- Handles company data refresh
- Accessible throughout the app

### Tab Navigation
- Dynamic tabs based on user role
- Admin sees all management tabs
- Staff sees delivery creation tabs
- Finance sees reports and history only

### Real-time Updates
- Supabase subscriptions for live data
- Automatic refresh on changes
- Real-time approval notifications
- Live delivery status updates

## Next Steps for Enhancement

1. **Email Notifications**: Send alerts for approvals and status changes
2. **Invoice Generation**: Automated monthly invoice creation
3. **PDF Reports**: Generate downloadable PDF reports
4. **CSV Export**: Export detailed delivery data
5. **Analytics Dashboard**: Advanced charts and visualizations
6. **Budget Alerts**: Notify when department budgets are exceeded
7. **Scheduled Execution**: Background job to process scheduled deliveries
8. **Bulk Actions**: Approve/reject multiple requests at once
9. **Audit Trail**: Track all changes and actions
10. **API Integration**: External system integration capabilities

## Usage Notes

- Corporate users are separate from regular customers
- System admins can create companies and assign admin users
- Company admins manage their own staff
- All deliveries go through the standard rider assignment system
- Rider management is handled by system administrators
