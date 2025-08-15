// src/components/sales/ManualOrderEntry.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import InvoiceGenerator from './InvoiceGenerator';

interface ManualOrderEntryProps {
  customerId: string;
  selectedCustomer: any;
  deliveryDate: Date;
  deliveryTime: Date;
  paymentType: string;
  salesAgentId: string;
  onSelectCustomer: () => void;
  onSelectPaymentType: () => void;
  onSelectDate: () => void;
  onSelectTime: () => void;
}

interface OrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  in_stock?: boolean;
  current_stock?: number;
}

interface Product {
  id: string;
  product_id: string;
  product_name: string;
  sku?: string;
  barcode?: string;
  price: number;
  quantity: number;
  unit: string;
}

export default function ManualOrderEntry({
  customerId,
  selectedCustomer,
  deliveryDate,
  deliveryTime,
  paymentType,
  salesAgentId,
  onSelectCustomer,
  onSelectPaymentType,
  onSelectDate,
  onSelectTime,
}: ManualOrderEntryProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = products.filter(p => 
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('product_name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addProduct = (product: Product) => {
    const existingItem = orderItems.find(item => item.product_id === product.id);
    
    if (existingItem) {
      // Update quantity if product already exists
      updateQuantity(existingItem.id, existingItem.quantity + 1);
    } else {
      // Add new item
      const newItem: OrderItem = {
        id: Date.now().toString(),
        product_id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: 1,
        unit: product.unit,
        unit_price: product.price,
        total_price: product.price,
        in_stock: product.quantity > 0,
        current_stock: product.quantity,
      };
      setOrderItems([...orderItems, newItem]);
    }
    
    setSearchQuery('');
    setShowProductSearch(false);
    Keyboard.dismiss();
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: newQuantity,
          total_price: newQuantity * item.unit_price,
        };
      }
      return item;
    }));
  };

  const updatePrice = (itemId: string, newPrice: string) => {
    const price = parseFloat(newPrice) || 0;
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          unit_price: price,
          total_price: item.quantity * price,
        };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setOrderItems(orderItems.filter(item => item.id !== itemId));
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmitOrder = async () => {
    if (!customerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (orderItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item to the order');
      return;
    }

    setIsSubmitting(true);
    const totals = calculateTotals();

    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;
      
      // Save order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId,
          sales_agent_id: salesAgentId,
          natural_language_order: 'Manual Entry',
          delivery_date: deliveryDate.toISOString().split('T')[0],
          delivery_time: deliveryTime.toTimeString().split(' ')[0],
          payment_type: paymentType,
          status: 'confirmed',
          subtotal: totals.subtotal,
          tax_amount: totals.tax,
          total_amount: totals.total,
        })
        .select()
        .single();
      
      if (orderError) throw orderError;
      
      // Save order items
      const orderItemsData = orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        original_text: 'Manual Entry',
        confidence_level: 'high',
        match_status: 'matched',
        stock_available: item.current_stock,
        stock_status: item.in_stock ? 'in_stock' : 'out_of_stock',
      }));
      
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);
      
      if (itemsError) throw itemsError;
      
      // Update inventory
      for (const item of orderItems) {
        if (item.product_id && item.in_stock) {
          const newQuantity = (item.current_stock || 0) - item.quantity;
          await supabase
            .from('products')
            .update({ quantity: Math.max(0, newQuantity) })
            .eq('id', item.product_id);
        }
      }
      
      setSavedOrderId(order.id);
      setShowInvoice(true);
      
    } catch (error) {
      console.error('Error saving order:', error);
      Alert.alert('Error', 'Failed to save order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const totals = calculateTotals();

  if (showInvoice && savedOrderId) {
    return (
      <InvoiceGenerator
        orderId={savedOrderId}
        customer={selectedCustomer}
        items={orderItems}
        orderSummary={totals}
        orderData={{
          deliveryDate,
          deliveryTime,
          paymentType,
        }}
        onClose={() => {
          setShowInvoice(false);
          setOrderItems([]);
          setSavedOrderId(null);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      {/* Order Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Details</Text>
        
        {/* Customer Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Customer</Text>
            <TouchableOpacity style={styles.infoButton} onPress={onSelectCustomer}>
              <Text style={[styles.infoText, !selectedCustomer && styles.placeholderText]}>
                {selectedCustomer ? selectedCustomer.name : 'Select customer'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Info */}
        <View style={styles.infoRow}>
          <View style={[styles.infoItem, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.infoLabel}>Delivery Date</Text>
            <TouchableOpacity style={styles.infoButton} onPress={onSelectDate}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.infoText}>{formatDate(deliveryDate)}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.infoItem, { flex: 1 }]}>
            <Text style={styles.infoLabel}>Time</Text>
            <TouchableOpacity style={styles.infoButton} onPress={onSelectTime}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.infoText}>{formatTime(deliveryTime)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment Type */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Payment Type</Text>
            <TouchableOpacity style={styles.infoButton} onPress={onSelectPaymentType}>
              <Text style={styles.infoText}>{paymentType.toUpperCase()}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
 
      {/* Product Search */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Products</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products by name, SKU, or barcode..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setShowProductSearch(true)}
          />
        </View>
        
        {showProductSearch && filteredProducts.length > 0 && (
          <View style={styles.searchResults}>
            <ScrollView style={styles.searchResults} nestedScrollEnabled>
              {filteredProducts.slice(0, 5).map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productResult}
                  onPress={() => addProduct(product)}
                >
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.product_name}</Text>
                    <Text style={styles.productMeta}>
                      SKU: {product.sku} | Stock: {product.quantity} | ${product.price}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#E74C3C" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Order Items */}
      {orderItems.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Items</Text>
          <ScrollView style={styles.itemsList} nestedScrollEnabled>
            {orderItems.map((item) => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.itemControls}>
                  <View style={styles.quantityControl}>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Ionicons name="remove" size={20} color="#666" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantityInput}
                      value={item.quantity.toString()}
                      onChangeText={(text) => updateQuantity(item.id, parseInt(text) || 0)}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Ionicons name="add" size={20} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.unitText}>{item.unit}</Text>
                  </View>
                  
                  <View style={styles.priceControl}>
                    <Text style={styles.priceLabel}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={item.unit_price.toString()}
                      onChangeText={(text) => updatePrice(item.id, text)}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.totalText}>= ${item.total_price.toFixed(2)}</Text>
                  </View>
                </View>
                
                {item.current_stock && item.quantity > item.current_stock && (
                  <Text style={styles.stockWarning}>
                    ⚠️ Only {item.current_stock} in stock
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
          
          {/* Order Summary */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>${totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax (10%):</Text>
              <Text style={styles.summaryValue}>${totals.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>${totals.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Submit Button */}
      {orderItems.length > 0 && (
        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmitOrder}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Order</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchCardExpanded: {
    marginBottom: 200, // Extra space when search is active
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 5,
  },
  placeholderText: {
    color: '#999',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  searchResults: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  productResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  productMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemsList: {
    maxHeight: 300,
  },
  orderItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 15,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  itemControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 10,
  },
  unitText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  priceControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  priceInput: {
    width: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    paddingVertical: 2,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
    marginLeft: 10,
  },
  stockWarning: {
    fontSize: 12,
    color: '#F39C12',
    marginTop: 5,
  },
  summary: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 15,
    marginTop: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});