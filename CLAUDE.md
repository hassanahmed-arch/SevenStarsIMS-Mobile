# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Seven Stars IMS is an inventory management system for New Jersey's largest hookah supplier, built with React Native, Expo, and Supabase. The app focuses on sales workflow management with features like customer management, order processing, inventory tracking, and commission calculations.

## Development Commands

```bash
# Development
expo start              # Start development server
expo start --android    # Run on Android
expo start --ios        # Run on iOS  
expo start --web        # Run in browser
expo start -c           # Clear cache

# Code Quality
expo lint               # Run ESLint

# Build & Deploy
eas build --platform ios      # Build for iOS
eas build --platform android  # Build for Android
```

## Architecture

### App Structure (Expo Router)
- `app/(auth)/` - Authentication screens (login)
- `app/(sales)/` - Main sales application screens
- `app/(sales)/new-order/` - Multi-step order creation flow
- `app/(sales)/new-proposal/` - Proposal creation flow
- `src/` - Shared components, contexts, and services

### Key Contexts
- **CartContext**: Persistent shopping cart with AsyncStorage, handles item management
- **OrderFlowContext**: Multi-step order workflow state management (customer → details → products → review)

### Data Layer
- **Supabase**: PostgreSQL database with Row Level Security (RLS)
- **AsyncStorage**: Local persistence for cart and order flow state
- **OpenAI Integration**: AI-powered features for warehouse operations

## Core Business Logic

### Order Flow (4 Steps)
1. **Customer Selection**: Search customers, view credit status and warnings
2. **Order Details**: Type (delivery/pickup/phone), payment terms, dates
3. **Product Selection**: Add products with custom pricing, quantity selectors
4. **Review & Submit**: Final review with inventory/credit warnings

### Customer Tiers & Credit Management
- **Standard**: Basic credit limit enforcement
- **Gold**: Higher credit limits  
- **Platinum**: Bypasses all credit limit checks
- **Credit warnings are non-blocking** - orders can proceed with warnings

### Inventory Management
- **Reserved Inventory**: `actual_qty - reserved_qty` for available stock
- **Orders reserve inventory**, **Proposals do not**
- **Price Memory**: Customer-specific pricing history auto-fills previous prices

### Key Database Tables
- `customers` - Customer management with tiers and credit limits
- `products` - Product catalog with inventory tracking  
- `orders` & `order_items` - Order records and line items
- `customer_price_history` - Per-customer pricing memory
- `reserved_inventory` - Soft inventory allocations
- `commission_plans` - Sales commission tracking

## Important Files

### Core Configuration
- `src/lib/supabase.ts` - Supabase client setup with AsyncStorage auth
- `app/_layout.tsx` - Root layout with auth routing and context providers

### Business Components  
- `src/components/sales/OrderProcessor.tsx` - Order submission and processing
- `src/components/sales/InvoiceGenerator.tsx` - PDF invoice generation
- `src/components/sales/ProposalGenerator.tsx` - PDF proposal generation
- `src/services/warehouseOrderService.ts` - Warehouse operation services

## Development Guidelines

### State Management
- Use Context API for global state (Cart, OrderFlow)  
- AsyncStorage for persistence across app restarts
- Supabase real-time subscriptions for live data updates

### Authentication & Authorization
- Supabase Auth handles user sessions
- Route guards in `app/_layout.tsx` redirect based on auth state
- Role-based permissions through database RLS policies

### Error Handling
- Non-blocking warnings for credit limits and stock issues
- Graceful degradation when services are unavailable
- User-friendly error messages with actionable guidance

### Testing Approach
- Test with different customer tiers (Standard/Gold/Platinum)  
- Verify credit limit and stock warning behaviors
- Test order vs proposal inventory impact differences
- Validate price memory functionality across customers

## Environment Setup

Required environment variables:
```bash
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Common Development Patterns

### Adding New Order Flow Steps
1. Update `OrderFlowContext` with new step validation
2. Create new screen in `app/(sales)/new-order/`
3. Update navigation and step indicators
4. Add persistence logic if needed

### Extending Customer Management
1. Update customer interfaces in contexts
2. Modify database schema through Supabase dashboard
3. Update RLS policies for new fields
4. Test with different customer tiers

### Inventory Operations
- Always check `reserved_inventory` for available stock
- Orders must update reserved quantities
- Proposals should not affect inventory
- Use atomic transactions for inventory updates