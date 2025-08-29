# SevenStars IMS - Sales Manager Module

## Overview
Complete inventory management system for New Jersey's largest hookah supplier with advanced sales workflow, customer management, and inventory tracking.

## Features

### Core Functionality
- **4-Step Order Flow**: Customer → Details → Products → Review
- **Smart Inventory**: Reserved vs Actual inventory tracking
- **Customer Tiers**: Standard, Gold, Platinum with credit management
- **Price Memory**: Per-customer product pricing history
- **Non-blocking Warnings**: Credit limits and stock warnings don't block orders
- **Order vs Proposal**: Different flows for orders (reserves inventory) vs proposals (no inventory impact)

### Business Rules
- ✅ Platinum customers bypass credit limit checks
- ✅ Reserved inventory updated on order submission
- ✅ Actual inventory only decremented on shipping (future feature)
- ✅ Customer-specific pricing with history tracking
- ✅ Quick quantity selectors (Case: 30, Pallet: 100)
- ✅ Out-of-stock items can still be ordered with warning

## Setup Instructions

### Prerequisites
- Node.js 16+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account
- iOS Simulator (Mac) or Android Studio

### 1. Clone and Install
```bash
git clone [your-repo]
cd sevenstars-ims
npm install
```

### 2. Supabase Setup

#### Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy your project URL and anon key

#### Run Database Migrations
1. Go to SQL Editor in Supabase dashboard
2. Run the SQL from `supabase-migrations.sql`
3. This creates all tables, views, indexes, and RLS policies

#### Configure Environment
Create `.env` file:
```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. File Structure Setup
```
app/
  (auth)/
    login.tsx ✅
  (sales)/
    manager/
      index.tsx ✅
    new-order/
      select-customer.tsx ✅
      order-details.tsx ✅
      overview.tsx ✅
    products.tsx ✅
    cart.tsx ✅
    new-customer.tsx ✅
    past-orders.tsx ✅
    analytics.tsx ✅
    profile.tsx ✅
  _layout.tsx ✅

src/
  lib/
    supabase.ts ✅
  contexts/
    CartContext.tsx ✅
    OrderFlowContext.tsx ✅
  components/
    sales/
      InvoiceGenerator.tsx ✅
      ProposalGenerator.tsx ✅
      SalesAnalytics.tsx ✅
      PastOrders.tsx ✅

assets/
  images/
    logo.png (add your logo)
```

### 4. Create Supabase Client
Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 5. Run the App
```bash
# Start Expo
expo start

# Run on iOS
expo start --ios

# Run on Android
expo start --android
```

## User Flows

### Creating an Order
1. **Select Customer**: Search, view credit status, see warnings
2. **Order Details**: Type (delivery/pickup), payment, date
3. **Add Products**: Search, filter, quick add with price override
4. **Cart Review**: Edit quantities and prices
5. **Overview**: Final review with warnings
6. **Submit**: Creates order, reserves inventory, saves price history

### Creating a Proposal
- Same flow as order but:
  - No inventory reservation
  - Generates proposal PDF instead of invoice
  - Can be converted to order later

### Customer Management
- **Tiers**: Standard (credit limit), Gold (higher limit), Platinum (no limit)
- **Addresses**: Primary, billing, shipping
- **Credit Tracking**: Outstanding balance vs credit limit
- **Price History**: Automatically tracked per product

## Key Components

### Contexts
- **CartContext**: Persistent cart management with AsyncStorage
- **OrderFlowContext**: Multi-step order flow state management

### Business Logic
- **Reserved Inventory**: `actual_qty - reserved_qty`
- **Price Memory**: Last price paid by customer auto-fills
- **Credit Warnings**: Non-blocking for all tiers
- **Stock Warnings**: Show but allow override

## API Endpoints (Supabase)

### Tables
- `customers`: Customer management
- `products`: Product catalog
- `orders`: Order records
- `order_items`: Line items
- `customer_price_history`: Price tracking
- `reserved_inventory`: Soft allocations
- `commission_plans`: Sales commissions

### Views
- `orders_with_admin_profile`: Orders with manager details

## Testing

### Test Accounts
Create test users with different roles:
```sql
-- Create test sales agent
INSERT INTO auth.users (email) VALUES ('sales@test.com');
INSERT INTO profiles (id, email, role, full_name) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'sales@test.com'),
  'sales@test.com',
  'sales_agent',
  'Test Sales Agent'
);
```

### Test Scenarios
1. **Credit Limit Warning**: Create customer with low credit limit
2. **Out of Stock**: Set product quantity to 0
3. **Price Memory**: Place order, change price, place another order
4. **Platinum Customer**: No credit warnings should appear

## Deployment

### Expo EAS Build
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Environment Variables
Set in `eas.json`:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your-url",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-key"
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Cart not persisting**: Check AsyncStorage permissions
2. **Auth not working**: Verify Supabase URL and keys
3. **Orders not saving**: Check RLS policies in Supabase
4. **Images not loading**: Add to assets folder

### Debug Commands
```bash
# Clear cache
expo start -c

# Reset Metro bundler
npx react-native start --reset-cache

# Check TypeScript
npm run type-check
```

## Future Enhancements

### Phase 2
- [ ] Shipping workflow (decrement actual inventory)
- [ ] Barcode scanning
- [ ] Push notifications
- [ ] Offline mode with sync
- [ ] Advanced analytics dashboard

### Phase 3
- [ ] Multi-warehouse support
- [ ] Route optimization
- [ ] Customer portal
- [ ] Automated reordering
- [ ] Commission calculations

## Support

For issues or questions:
- Technical: [your-email]
- Business: sales@sevenstars.com

## License
Proprietary - Seven Stars Wholesale

---

Built with React Native, Expo, and Supabase