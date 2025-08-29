// src/screens/sales/Cart.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCart } from '../../src/contexts/CartContext';
import { useOrderFlow } from '../../src/contexts/OrderFlowContext';
import { supabase } from '../../src/lib/supabase';

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  original_price: number;
  is_tobacco?: boolean;
  available_quantity: number;
  image_url?: string;
  custom_price_used?: boolean;
}

interface OrderSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

const CartScreen = () => {
  const { cartItems, updateQuantity, removeItem, clearCart } = useCart();
  const { orderData, customer, resetFlow } = useOrderFlow();
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderSummary, setOrderSummary] = useState<OrderSummary>({
    subtotal: 0,
    shipping: 0,
    tax: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  // Constants for calculations
  const TAX_RATE = 0.10; // 10% tax rate
  const SHIPPING_FEE = orderData?.orderType === 'pickup' ? 0 : 25.00;

  useEffect(() => {
    loadCartItems();
  }, [cartItems]);

  useEffect(() => {
    calculateTotals();
  }, [items, SHIPPING_FEE]);

  const loadCartItems = async () => {
    if (!cartItems || cartItems.length === 0) {
      setItems([]);
      setItemsLoaded(true);
      return;
      
    }

    try {
      // Fetch product details and check available inventory
      const productIds = cartItems.map(item => item.product_id);
      
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (error) throw error;

      // Fetch customer price history if customer is selected
      let priceHistory: any[] = [];
      if (customer?.id) {
        const { data: history } = await supabase
          .from('customer_price_history')
          .select('*')
          .eq('customer_id', customer.id)
          .in('product_id', productIds);
        
        priceHistory = history || [];
      }

      // Map cart items with full product details
      const enrichedItems: CartItem[] = cartItems.map(cartItem => {
        const product = products?.find(p => p.id === cartItem.product_id);
        const customerPrice = priceHistory.find(h => h.product_id === cartItem.product_id);
        
        // Calculate available quantity (actual - reserved)
        const availableQty = Math.max(0, (product?.quantity || 0) - (product?.reserved_qty || 0));
        
        // Use customer's last price if available, otherwise use product default
        const unitPrice = cartItem.custom_price || customerPrice?.last_price || product?.price || 0;
        
        return {
          id: cartItem.id,
          product_id: cartItem.product_id,
          product_name: product?.product_name || 'Unknown Product',
          sku: product?.sku || '',
          quantity: cartItem.quantity,
          unit: cartItem.unit || product?.unit || 'pcs',
          unit_price: unitPrice,
          total_price: cartItem.quantity * unitPrice,
          original_price: product?.price || 0,
          is_tobacco: product?.is_tobacco || false,
          available_quantity: availableQty,
          image_url: product?.image_url,
          custom_price_used: cartItem.custom_price !== undefined || customerPrice !== undefined,
        };
      });

       setItems(enrichedItems);
    setItemsLoaded(true);
    } catch (error) {
      setItemsLoaded(true);
      console.error('Error loading cart items:', error);
      Alert.alert('Error', 'Failed to load cart items');
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const shipping = SHIPPING_FEE;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + shipping + tax;

    setOrderSummary({
      subtotal,
      shipping,
      tax,
      total,
    });
  };

  const handleQuantityChange = async (itemId: string, delta: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + delta);
    
    if (newQuantity === 0) {
      handleRemoveItem(itemId);
      return;
    }

    // Check if new quantity exceeds available stock
    if (newQuantity > item.available_quantity && item.available_quantity > 0) {
      Alert.alert(
        'Low Stock Warning',
        `Only ${item.available_quantity} units available. Do you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue',
            onPress: () => updateItemQuantity(itemId, newQuantity),
          },
        ]
      );
    } else if (item.available_quantity === 0) {
      Alert.alert(
        'Out of Stock',
        'This item is currently out of stock. Do you want to add it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Anyway',
            onPress: () => updateItemQuantity(itemId, newQuantity),
            style: 'destructive',
          },
        ]
      );
    } else {
      updateItemQuantity(itemId, newQuantity);
    }
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    updateQuantity(itemId, newQuantity);
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, total_price: newQuantity * item.unit_price }
        : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeItem(itemId);
            setItems(prev => prev.filter(item => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handlePriceEdit = (itemId: string, currentPrice: number) => {
    setEditingPrice(itemId);
    setTempPrice(currentPrice.toFixed(2));
  };

  const savePriceEdit = async (itemId: string) => {
    const newPrice = parseFloat(tempPrice);
    
    if (isNaN(newPrice) || newPrice < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }

    // Update item price
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            unit_price: newPrice,
            total_price: item.quantity * newPrice,
            custom_price_used: true
          }
        : item
    ));

    // Update cart context with custom price
    const item = items.find(i => i.id === itemId);
    if (item) {
      updateQuantity(itemId, item.quantity, newPrice);
    }

    setEditingPrice(null);
    setTempPrice('');
  };

const handlePlaceOrder = async () => {
  // Wait a moment for items to be fully loaded if needed
   if (!itemsLoaded || items.length === 0) {
    return;
  }
  if (items.length === 0 && cartItems.length > 0) {
    // Items haven't loaded yet, wait and retry
    setTimeout(() => handlePlaceOrder(), 100);
    return;
  }

  if (!customer) {
    Alert.alert('Customer Required', 'Please select a customer first');
    router.push('/(sales)/new-order/select-customer' as any);
    return;
  }

  if (!orderData) {
    Alert.alert('Order Details Required', 'Please complete order details');
    router.push('/(sales)/new-order/order-details' as any);
    return;
  }

  // Check for out of stock items
  const outOfStockItems = items.filter(item => item.available_quantity === 0);
  if (outOfStockItems.length > 0) {
    Alert.alert(
      'Out of Stock Items',
      `${outOfStockItems.length} items in your cart are out of stock. Do you want to proceed anyway?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: () => proceedToOverview() },
      ]
    );
  } else {
    proceedToOverview();
  }
};

 const proceedToOverview = () => {
  // Ensure items are loaded
  if (!items || items.length === 0) {
    Alert.alert('Error', 'No items to review');
    return;
  }
  
  // Navigate to order overview with all data
  router.push({
    pathname: '/(sales)/new-order/overview' as any,
    params: {
      customer: JSON.stringify(customer),
      orderData: JSON.stringify(orderData),
      items: JSON.stringify(items),
      summary: JSON.stringify(orderSummary),
    },
  });
};

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearCart();
            resetFlow();
          },
        },
      ]
    );
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemHeader}>
        <View style={styles.itemImageContainer}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.itemImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="cube-outline" size={24} color="#999" />
            </View>
          )}
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
          {item.is_tobacco && (
            <View style={styles.tobaccoBadge}>
              <Text style={styles.tobaccoText}>Tobacco</Text>
            </View>
          )}
          <Text style={styles.itemSku}>SKU: {item.sku}</Text>
          
          {/* Price display/edit */}
          <View style={styles.priceContainer}>
            {editingPrice === item.id ? (
              <View style={styles.priceEditContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={tempPrice}
                  onChangeText={setTempPrice}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={() => savePriceEdit(item.id)}
                  onSubmitEditing={() => savePriceEdit(item.id)}
                />
                <TouchableOpacity onPress={() => savePriceEdit(item.id)}>
                  <Ionicons name="checkmark" size={20} color="#27AE60" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.priceDisplay}
                onPress={() => handlePriceEdit(item.id, item.unit_price)}
              >
                <Text style={[
                  styles.itemPrice,
                  item.custom_price_used && styles.customPrice
                ]}>
                  ${item.unit_price.toFixed(2)}
                </Text>
                <Ionicons name="pencil" size={14} color="#666" style={styles.editIcon} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Quantity controls */}
      <View style={styles.quantitySection}>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item.id, -1)}
          >
            <Ionicons name="remove" size={20} color="#666" />
          </TouchableOpacity>
          
          <Text style={styles.quantityText}>{item.quantity}</Text>
          
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item.id, 1)}
          >
            <Ionicons name="add" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Stock warning */}
        {item.available_quantity === 0 && (
          <View style={styles.stockWarning}>
            <Ionicons name="warning" size={14} color="#E74C3C" />
            <Text style={styles.stockWarningText}>Out of stock</Text>
          </View>
        )}
        {item.available_quantity > 0 && item.quantity > item.available_quantity && (
          <View style={styles.stockWarning}>
            <Ionicons name="warning" size={14} color="#F39C12" />
            <Text style={styles.stockWarningText}>
              Only {item.available_quantity} available
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sales Order Cart</Text>
          <View style={{ width: 32 }} />
        </View>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color="#DDD" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add products to get started</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(sales)/products' as any)}
          >
            <Text style={styles.browseButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sales Order Cart</Text>
          <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Cart Items */}
        <FlatList
          data={items}
          renderItem={renderCartItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Selected Items</Text>
          }
          ListFooterComponent={
            <View style={styles.summaryContainer}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${orderSummary.subtotal.toFixed(2)}</Text>
              </View>
              
              {SHIPPING_FEE > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Shipping</Text>
                  <Text style={styles.summaryValue}>${orderSummary.shipping.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>${orderSummary.tax.toFixed(2)}</Text>
              </View>
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${orderSummary.total.toFixed(2)}</Text>
              </View>
            </View>
          }
        />

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[styles.placeOrderButton, isLoading && styles.buttonDisabled]}
            onPress={handlePlaceOrder}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.placeOrderText}>Review Order</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 32,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  clearButton: {
    padding: 4,
  },
  clearText: {
    color: '#FFF',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  cartItem: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  itemImageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  tobaccoBadge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  tobaccoText: {
    fontSize: 11,
    color: '#E74C3C',
    fontWeight: '500',
  },
  itemSku: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E74C3C',
  },
  customPrice: {
    color: '#3498DB',
  },
  editIcon: {
    marginLeft: 6,
  },
  priceEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3498DB',
  },
  dollarSign: {
    fontSize: 16,
    color: '#666',
    marginRight: 2,
  },
  priceInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498DB',
    minWidth: 60,
    paddingVertical: 2,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  quantityButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    minWidth: 40,
    textAlign: 'center',
  },
  stockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockWarningText: {
    fontSize: 12,
    color: '#E74C3C',
    marginLeft: 4,
  },
  summaryContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#666',
  },
  summaryValue: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  bottomAction: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  placeOrderButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  placeOrderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#E74C3C',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
  },
  browseButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CartScreen;