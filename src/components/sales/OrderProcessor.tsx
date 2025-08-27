import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import ProposalGenerator from './ProposalGenerator';

interface OrderProcessorProps {
  orderData: {
    customerId: string;
    deliveryDate: Date;
    deliveryTime: Date;
    paymentType: string;
    orderType: string;
    items: OrderItem[];
  };
  customerId: string;
  salesAgentId: string;
  onClose: () => void;
}

interface OrderItem {
  product: any;
  quantity: number;
  unit_price: number;
  total_price: number;
  in_stock: boolean;
  stock_status: 'in_stock' | 'out_of_stock' | 'low_stock';
  custom_price?: boolean;
}

interface ProcessedItem {
  original_text: string;
  matched_product?: any;
  product_name: string;
  product_id?: string;
  sku?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  confidence: 'high' | 'medium' | 'low' | 'no_match';
  in_stock: boolean;
  current_stock?: number;
  stock_status?: string;
  customer_price?: number | null;
  using_customer_price?: boolean;
  price_valid?: boolean;
  price_expires?: string | null;
  discount_percentage?: number;
}

interface CustomerPriceHistory {
  product_id: string;
  last_price: number;
  last_quantity: number;
  last_unit: string;
  last_order_date: string;
  times_ordered: number;
  valid_until?: string | null;
  price_locked?: boolean;
  original_price?: number;
}

interface PriceHistoryDetail {
  price: number;
  date: string;
  quantity: number;
  order_id?: string;
}

export default function OrderProcessor({ orderData, customerId, salesAgentId, onClose }: OrderProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(true);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [customerPriceHistory, setCustomerPriceHistory] = useState<Map<string, CustomerPriceHistory>>(new Map());
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    tax: 0,
    total: 0,
    allInStock: true,
    totalSavings: 0,
  });
  const [showProposal, setShowProposal] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<{ [key: number]: ProcessedItem }>({});
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] = useState<PriceHistoryDetail[]>([]);
  const [selectedProductName, setSelectedProductName] = useState('');

  useEffect(() => {
    let isMounted = true;
    
    const initializeData = async () => {
      if (!customerId) {
        Alert.alert('Error', 'Please select a customer before adding items to the order.');
        onClose();
        return;
      }
      
      if (isMounted) {
        await fetchInitialData();
      }
    };
    
    initializeData();
    
    return () => {
      isMounted = false;
    };
  }, [customerId]); 

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

  const fetchInitialData = async () => {
    setIsProcessing(true);
    try {
      const customerData = await fetchCustomer();
      if (!customerData) {
        Alert.alert('Error', 'Customer not found. Please select a valid customer.');
        onClose();
        return;
      }

      const [productsData, priceHistoryMap] = await Promise.all([
        fetchProducts(),
        fetchCustomerPriceHistory()
      ]);

      if (productsData && priceHistoryMap) {
        await processOrderItems(priceHistoryMap);
      }
      
    } catch (error) {
      console.error('Error fetching initial data:', error);
      Alert.alert('Error', 'Failed to load order data. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      setCustomer(data);
      return data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('product_name');

      if (error) throw error;
      setProducts(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  };

  const fetchCustomerPriceHistory = async (): Promise<Map<string, CustomerPriceHistory>> => {
    try {
      console.log('Fetching price history for customer:', customerId);
      
      const { data, error } = await supabase
        .from('customer_price_history')
        .select('*')
        .eq('customer_id', customerId);

      if (error) {
        console.error('Customer price history error:', error);
        return new Map();
      }

      const priceMap = new Map<string, CustomerPriceHistory>();
      const now = new Date();
      
      (data || []).forEach(item => {
        // Check if price is still valid
        const isValid = !item.valid_until || new Date(item.valid_until) > now;
        
        if (isValid || item.price_locked) {
          priceMap.set(item.product_id, {
            product_id: item.product_id,
            last_price: Number(item.last_price),
            last_quantity: item.last_quantity,
            last_unit: item.last_unit,
            last_order_date: item.last_order_date,
            times_ordered: item.times_ordered,
            valid_until: item.valid_until,
            price_locked: item.price_locked,
            original_price: item.original_price
          });
        }
      });
      
      console.log('Customer price history loaded:', priceMap.size, 'valid items');
      setCustomerPriceHistory(priceMap);
      return priceMap;
    } catch (error) {
      console.error('Error fetching customer price history:', error);
      return new Map();
    }
  };

  const fetchProductPriceHistory = async (productId: string, productName: string) => {
    try {
      const { data, error } = await supabase
        .from('price_change_log')
        .select('*')
        .eq('customer_id', customerId)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const history: PriceHistoryDetail[] = (data || []).map(item => ({
        price: item.new_price,
        date: new Date(item.created_at).toLocaleDateString(),
        quantity: 0,
        order_id: item.order_id
      }));

      setSelectedProductHistory(history);
      setSelectedProductName(productName);
      setShowPriceHistory(true);
    } catch (error) {
      console.error('Error fetching price history:', error);
      Alert.alert('Error', 'Failed to load price history');
    }
  };

  const processOrderItems = async (priceHistoryMap?: Map<string, CustomerPriceHistory>) => {
    try {
      if (!orderData || !orderData.items || orderData.items.length === 0) {
        console.log('No items to process');
        setProcessedItems([]);
        updateOrderSummary([]);
        return;
      }
      
      const priceHistory = priceHistoryMap || customerPriceHistory;
      const appliedPrices: Array<{name: string, saved: number, discount: number}> = [];
      
      const items: ProcessedItem[] = orderData.items.flatMap(item => {
        if (!item || !item.product) {
          console.error('Invalid item or product:', item);
          return [];
        }
        
        const customerPrice = priceHistory.get(item.product.id);
        const regularPrice = item.product.price || 0;
        const hasCustomerPrice = !!customerPrice;
        const usingCustomerPrice = hasCustomerPrice && !item.custom_price;
        
        // Check for significant price differences
        let finalPrice = item.unit_price || 0;
        let priceAlert = false;
        
        if (usingCustomerPrice && customerPrice) {
          finalPrice = Number(customerPrice.last_price);
          const priceDifference = Math.abs((customerPrice.last_price - regularPrice) / regularPrice);
          
          if (priceDifference > 0.5) { // 50% difference
            priceAlert = true;
          }
          
          const savings = (regularPrice - finalPrice) * (item.quantity || 1);
          const discountPercent = ((regularPrice - finalPrice) / regularPrice * 100);
          
          if (savings > 0) {
            appliedPrices.push({
              name: item.product.product_name,
              saved: savings,
              discount: discountPercent
            });
          }
          
          console.log(`Applied customer price for ${item.product.product_name}: $${finalPrice} (was $${regularPrice})`);
        }
        
        // Ensure price is not negative or zero
        finalPrice = Math.max(0.01, finalPrice);
        
        return [{
          original_text: 'Manual Entry',
          matched_product: item.product,
          product_name: item.product.product_name || 'Unknown Product',
          product_id: item.product.id,
          sku: item.product.sku || '',
          quantity: item.quantity || 1,
          unit: item.product.unit || 'unit',
          unit_price: finalPrice,
          total_price: (item.quantity || 1) * finalPrice,
          confidence: 'high' as const,
          in_stock: item.in_stock ?? true,
          current_stock: item.product.quantity || 0,
          stock_status: item.stock_status || 'unknown',
          customer_price: customerPrice?.last_price ?? null,
          using_customer_price: usingCustomerPrice,
          price_valid: customerPrice ? (!customerPrice.valid_until || new Date(customerPrice.valid_until) > new Date()) : true,
          price_expires: customerPrice?.valid_until,
          discount_percentage: usingCustomerPrice ? ((regularPrice - finalPrice) / regularPrice * 100) : 0,
        }];
      });

      setProcessedItems(items);
      updateOrderSummary(items);
      
      // Show detailed notification if customer prices were applied
      if (appliedPrices.length > 0) {
        const totalSavings = appliedPrices.reduce((sum, item) => sum + item.saved, 0);
        const itemsList = appliedPrices.map(item => 
          `• ${item.name}: ${item.discount.toFixed(1)}% off ($${item.saved.toFixed(2)} saved)`
        ).join('\n');
        
        Alert.alert(
          'Customer Prices Applied',
          `${appliedPrices.length} item(s) updated with customer pricing:\n\n${itemsList}\n\nTotal savings: $${totalSavings.toFixed(2)}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error processing order items:', error);
      Alert.alert('Error', 'Failed to process order items.');
      setProcessedItems([]);
      updateOrderSummary([]);
    }
  };

  const addProductManually = (product: any) => {
    if (!customerId || !customer) {
      Alert.alert(
        'Customer Required',
        'Please select a customer before adding products to the order.',
        [{ text: 'OK' }]
      );
      setShowAddItemModal(false);
      return;
    }

    const customerPrice = customerPriceHistory.get(product.id);
    const useCustomerPrice = !!customerPrice && (!customerPrice.valid_until || new Date(customerPrice.valid_until) > new Date());
    const finalPrice = useCustomerPrice ? Number(customerPrice.last_price) : product.price;

    const newItem: ProcessedItem = {
      original_text: 'Manual Entry',
      matched_product: product,
      product_name: product.product_name,
      product_id: product.id,
      sku: product.sku,
      quantity: 1,
      unit: product.unit,
      unit_price: Math.max(0.01, finalPrice),
      total_price: Math.max(0.01, finalPrice),
      confidence: 'high',
      in_stock: product.quantity > 0,
      current_stock: product.quantity,
      stock_status: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
      customer_price: customerPrice?.last_price ?? null,
      using_customer_price: useCustomerPrice,
      price_valid: useCustomerPrice,
      price_expires: customerPrice?.valid_until,
      discount_percentage: useCustomerPrice ? ((product.price - finalPrice) / product.price * 100) : 0,
    };

    setProcessedItems([...processedItems, newItem]);
    updateOrderSummary([...processedItems, newItem]);
    setSearchQuery('');
    setShowAddItemModal(false);

    if (useCustomerPrice) {
      const savings = product.price - finalPrice;
      const validUntil = customerPrice.valid_until ? 
        `\nPrice valid until: ${new Date(customerPrice.valid_until).toLocaleDateString()}` : '';
      
      Alert.alert(
        'Customer Price Applied',
        `Using customer's negotiated price of $${finalPrice.toFixed(2)}\n` +
        `Regular price: $${product.price.toFixed(2)}\n` +
        `Savings: $${savings.toFixed(2)} (${((savings/product.price)*100).toFixed(1)}%)\n` +
        `Previously ordered ${customerPrice.times_ordered} time${customerPrice.times_ordered > 1 ? 's' : ''}${validUntil}`,
        [{ text: 'OK' }]
      );
    }
  };

  const updateOrderSummary = useCallback((items: ProcessedItem[]) => {
    const validItems = items.filter(item => item && typeof item.total_price === 'number');
    const subtotal = validItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    const allInStock = validItems.length > 0 && validItems.every(item => item.in_stock);
    
    // Calculate total savings
    const totalSavings = validItems.reduce((sum, item) => {
      if (item.using_customer_price && item.matched_product) {
        const regularPrice = item.matched_product.price || item.unit_price;
        return sum + ((regularPrice - item.unit_price) * item.quantity);
      }
      return sum;
    }, 0);

    setOrderSummary({ subtotal, tax, total, allInStock, totalSavings });
  }, []);

  const handleItemEdit = (index: number, field: string, value: any) => {
    const updatedItem = { ...processedItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      updatedItem.total_price = updatedItem.quantity * updatedItem.unit_price;
      updatedItem.using_customer_price = false;
    }

    if (field === 'quantity' && updatedItem.current_stock !== undefined) {
      const requestedQty = parseInt(value) || 0;
      const availableStock = updatedItem.current_stock;

      updatedItem.in_stock = availableStock >= requestedQty;

      if (availableStock === 0) {
        updatedItem.stock_status = 'out_of_stock';
      } else if (availableStock < requestedQty) {
        updatedItem.stock_status = 'low_stock';
      } else {
        updatedItem.stock_status = 'in_stock';
      }
    }

    setEditingItems({ ...editingItems, [index]: updatedItem });
  };

  const saveItemEdit = (index: number) => {
    const updatedItems = [...processedItems];
    updatedItems[index] = editingItems[index] || processedItems[index];
    setProcessedItems(updatedItems);
    updateOrderSummary(updatedItems);
    delete editingItems[index];
    setEditingItems({ ...editingItems });
  };

  const removeItem = (index: number) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedItems = processedItems.filter((_, i) => i !== index);
            setProcessedItems(updatedItems);
            updateOrderSummary(updatedItems);
          }
        }
      ]
    );
  };

  const handleAddItemClick = () => {
    if (!customerId || !customer) {
      Alert.alert(
        'Customer Required',
        'Please select a customer before adding products to the order.',
        [{ text: 'OK' }]
      );
      return;
    }
    setShowAddItemModal(true);
  };

  const handleSubmitOrder = async () => {
    if (!customerId || !customer) {
      Alert.alert('Error', 'Please select a customer before submitting the order.');
      return;
    }

    if (processedItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item to the order.');
      return;
    }

    if (!orderSummary.allInStock) {
      Alert.alert(
        'Stock Warning',
        'Some items are out of stock. Do you want to proceed with available items?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: () => saveOrder() }
        ]
      );
    } else {
      saveOrder();
    }
  };

  const saveOrder = async () => {
    try {
      const orderNumber = `ORD-${Date.now()}`;
      const proposalNumber = `PROP-${Date.now()}`;
      
      const deliveryDate = new Date(orderData.deliveryDate);
      const daysDiff = Math.ceil((deliveryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const priorityLevel = daysDiff <= 1 ? 9 : daysDiff <= 3 ? 7 : orderSummary.total > 1000 ? 6 : 5;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          proposal_number: proposalNumber,
          customer_id: customerId,
          sales_agent_id: salesAgentId,
          delivery_date: orderData.deliveryDate.toISOString().split('T')[0],
          delivery_time: orderData.deliveryTime.toTimeString().split(' ')[0],
          payment_type: orderData.paymentType,
          order_type: orderData.orderType,
          status: 'draft',
          subtotal: orderSummary.subtotal,
          tax_amount: orderSummary.tax,
          total_amount: orderSummary.total,
          priority_level: priorityLevel,
          warehouse_status: 'pending_assignment'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = processedItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        original_text: item.original_text,
        confidence_level: item.confidence,
        match_status: item.confidence === 'no_match' ? 'not_found' : 'matched',
        stock_available: item.current_stock,
        stock_status: item.stock_status,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Update customer price history with better tracking
      await updateCustomerPriceHistory(processedItems, order.id);

      setSavedOrderId(order.id);
      setShowProposal(true);

    } catch (error) {
      console.error('Error saving order:', error);
      Alert.alert('Error', 'Failed to save order. Please try again.');
    }
  };

  const updateCustomerPriceHistory = async (items: ProcessedItem[], orderId: string) => {
    try {
      // Batch process all updates in a transaction
      const updates = [];
      const priceChangeLogs = [];
      
      for (const item of items) {
        if (!item.product_id) continue;

        const existingHistory = customerPriceHistory.get(item.product_id);
        const originalPrice = item.matched_product?.price || item.unit_price;
        
        // Prepare price change log entry
        priceChangeLogs.push({
          customer_id: customerId,
          product_id: item.product_id,
          old_price: existingHistory?.last_price || null,
          new_price: item.unit_price,
          original_price: originalPrice,
          price_difference_percentage: ((originalPrice - item.unit_price) / originalPrice * 100),
          changed_by: salesAgentId,
          order_id: orderId,
          change_type: item.using_customer_price ? 'customer_price' : 'manual',
          reason: item.using_customer_price ? 'Applied customer negotiated price' : 'Manual price adjustment'
        });
        
        // Calculate validity period (90 days by default, can be configured)
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 90);
        
        if (existingHistory) {
          // Update existing record
          updates.push({
            customer_id: customerId,
            product_id: item.product_id,
            last_price: item.unit_price,
            last_quantity: item.quantity,
            last_unit: item.unit,
            last_order_date: new Date().toISOString(),
            times_ordered: existingHistory.times_ordered + 1,
            total_quantity_ordered: (existingHistory.last_quantity * existingHistory.times_ordered) + item.quantity,
            valid_until: validUntil.toISOString(),
            original_price: originalPrice,
            updated_at: new Date().toISOString()
          });
        } else {
          // Insert new record
          updates.push({
            customer_id: customerId,
            product_id: item.product_id,
            last_price: item.unit_price,
            last_quantity: item.quantity,
            last_unit: item.unit,
            last_order_date: new Date().toISOString(),
            times_ordered: 1,
            total_quantity_ordered: item.quantity,
            valid_until: validUntil.toISOString(),
            original_price: originalPrice
          });
        }
      }

      // Batch upsert price history
      if (updates.length > 0) {
        const { error: historyError } = await supabase
          .from('customer_price_history')
          .upsert(updates, { 
            onConflict: 'customer_id,product_id',
            ignoreDuplicates: false 
          });
        
        if (historyError) {
          console.error('Error updating price history:', historyError);
        }
      }
      
      // Insert price change logs
      if (priceChangeLogs.length > 0) {
        const { error: logError } = await supabase
          .from('price_change_log')
          .insert(priceChangeLogs);
        
        if (logError) {
          console.error('Error logging price changes:', logError);
        }
      }
    } catch (error) {
      console.error('Error updating customer price history:', error);
    }
  };

  const getStockIcon = (status: string) => {
    switch (status) {
      case 'in_stock': return 'checkmark-circle';
      case 'out_of_stock': return 'close-circle';
      case 'low_stock': return 'warning';
      case 'not_found': return 'help-circle-outline';
      default: return 'remove-circle-outline';
    }
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'in_stock': return '#27AE60';
      case 'out_of_stock': return '#E74C3C';
      case 'low_stock': return '#F39C12';
      case 'not_found': return '#999';
      default: return '#666';
    }
  };

  if (isProcessing) {
    return (
      <Modal visible animationType="fade" transparent>
        <View style={styles.processingContainer}>
          <View style={styles.processingCard}>
            <View style={styles.processingAnimation}>
              <ActivityIndicator size="large" color="#E74C3C" />
            </View>
            <Text style={styles.processingTitle}>Processing Order</Text>
            <Text style={styles.processingSubtext}>
              {customer ? `Loading prices for ${customer.name}...` : 'Applying customer prices and checking inventory...'}
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (showProposal && savedOrderId) {
    return (
      <ProposalGenerator
        orderId={savedOrderId}
        customer={customer}
        items={processedItems}
        orderSummary={orderSummary}
        orderData={orderData}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Review Order</Text>
            <Text style={styles.headerSubtitle}>With Customer Pricing</Text>
          </View>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="help-circle-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Customer Info Card */}
          {customer ? (
            <View style={styles.customerCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="person-circle" size={24} color="#333" />
                  <Text style={styles.cardTitle}>Customer Information</Text>
                </View>
              </View>
              <View style={styles.customerContent}>
                <View style={styles.customerInfoRow}>
                  <View style={styles.customerInfoLeft}>
                    <Text style={styles.customerInfoLabel}>Name:</Text>
                    <Text style={styles.customerInfoValue}>{customer.name}</Text>
                    <Text style={styles.customerInfoLabel}>Email:</Text>
                    <Text style={styles.customerInfoValue}>{customer.email}</Text>
                    <Text style={styles.customerInfoLabel}>Phone:</Text>
                    <Text style={styles.customerInfoValue}>{customer.phone}</Text>
                  </View>
                  <View style={styles.customerInfoRight}>
                    <Text style={styles.customerInfoLabel}>Address:</Text>
                    <Text style={styles.customerInfoValue}>{customer.address}</Text>
                    <Text style={styles.customerInfoValue}>{customer.city}, {customer.state} {customer.zip_code}</Text>
                  </View>
                </View>
                <View style={styles.outstandingBalance}>
                  <Text style={styles.balanceLabel}>Outstanding Balance:</Text>
                  <Text style={styles.balanceValue}>${customer.outstanding_balance?.toFixed(2) || '0.00'}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color="#F39C12" />
              <Text style={styles.warningText}>
                No customer selected. Please select a customer to continue.
              </Text>
            </View>
          )}

          {/* Delivery Info Card */}
          <View style={styles.deliveryCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="calendar" size={24} color="#E74C3C" />
                <Text style={styles.cardTitle}>Delivery Information</Text>
              </View>
            </View>
            <View style={styles.deliveryContent}>
              <View style={styles.deliveryRow}>
                <View style={styles.deliveryItem}>
                  <Text style={styles.deliveryLabel}>Date</Text>
                  <Text style={styles.deliveryValue}>
                    {orderData.deliveryDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                <View style={styles.deliveryItem}>
                  <Text style={styles.deliveryLabel}>Time</Text>
                  <Text style={styles.deliveryValue}>
                    {orderData.deliveryTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.deliveryRow}>
                <View style={styles.deliveryItem}>
                  <Text style={styles.deliveryLabel}>Payment Method</Text>
                  <Text style={styles.deliveryValue}>
                    {orderData.paymentType.charAt(0).toUpperCase() + orderData.paymentType.slice(1)}
                  </Text>
                </View>
                <View style={styles.deliveryItem}>
                  <Text style={styles.deliveryLabel}>Order Type</Text>
                  <Text style={styles.deliveryValue}>
                    {orderData.orderType === 'pickup' ? 'Pick Up' : 
                     orderData.orderType === 'phone' ? 'By Phone' : 'Card/Zelle'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={styles.itemsTitle}>Order Items</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddItemClick}
              >
                <Ionicons name="add-circle-outline" size={20} color="#E74C3C" />
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {/* Items Summary */}
            {processedItems.length > 0 && (
              <View style={styles.matchingSummary}>
                <Text style={styles.matchingSummaryTitle}>Order Summary</Text>
                <View style={styles.summaryStats}>
                  <View style={styles.summaryStatItem}>
                    <Text style={styles.summaryStatLabel}>Total Items:</Text>
                    <Text style={styles.summaryStatValue}>{processedItems.length}</Text>
                  </View>
                  <View style={styles.summaryStatItem}>
                    <Text style={[styles.summaryStatLabel, { color: '#3498DB' }]}>Customer Prices:</Text>
                    <Text style={[styles.summaryStatValue, { color: '#3498DB' }]}>
                      {processedItems.filter(i => i.using_customer_price).length}
                    </Text>
                  </View>
                  <View style={styles.summaryStatItem}>
                    <Text style={[styles.summaryStatLabel, { color: '#27AE60' }]}>In Stock:</Text>
                    <Text style={[styles.summaryStatValue, { color: '#27AE60' }]}>
                      {processedItems.filter(i => i.in_stock).length}
                    </Text>
                  </View>
                  {orderSummary.totalSavings > 0 && (
                    <View style={styles.summaryStatItem}>
                      <Text style={[styles.summaryStatLabel, { color: '#E74C3C' }]}>Total Saved:</Text>
                      <Text style={[styles.summaryStatValue, { color: '#E74C3C' }]}>
                        ${orderSummary.totalSavings.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {processedItems.map((item, index) => {
              const isEditing = editingItems[index];
              const currentItem = isEditing || item;

              return (
                <View key={index} style={styles.itemCard}>
                  {/* Item Header */}
                  <TouchableOpacity
                    style={styles.itemHeader}
                    onPress={() => setExpandedItem(expandedItem === index ? null : index)}
                  >
                    <View style={styles.itemHeaderLeft}>
                      {item.using_customer_price && (
                        <View style={styles.customerPriceBadge}>
                          <Ionicons name="person" size={14} color="#3498DB" />
                          <Text style={styles.customerPriceText}>
                            {item.discount_percentage ? `${item.discount_percentage.toFixed(0)}% Off` : 'Customer Price'}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.stockBadge, { backgroundColor: `${getStockColor(item.stock_status || '')}15` }]}>
                        <Ionicons
                          name={getStockIcon(item.stock_status || '')}
                          size={16}
                          color={getStockColor(item.stock_status || '')}
                        />
                        <Text style={[styles.stockText, { color: getStockColor(item.stock_status || '') }]}>
                          {item.stock_status === 'in_stock' ? 'In Stock' :
                            item.stock_status === 'out_of_stock' ? 'Out of Stock' : 
                            item.stock_status === 'low_stock' ? 'Low Stock' : 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={expandedItem === index ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>

                  {/* Main Item Content */}
                  <View style={styles.itemContent}>
                    <View style={styles.itemMainInfo}>
                      <Text style={styles.itemProductName}>{currentItem.product_name}</Text>
                      {item.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
                    </View>

                    <View style={styles.itemQuantityPrice}>
                      {isEditing ? (
                        <>
                          <View style={styles.editingFields}>
                            <TextInput
                              style={styles.editInput}
                              value={String(currentItem.quantity)}
                              onChangeText={(text) => handleItemEdit(index, 'quantity', parseInt(text) || 0)}
                              keyboardType="numeric"
                              placeholder="Qty"
                            />
                            <Text style={styles.unitText}>{currentItem.unit}</Text>
                            <Text style={styles.atText}>@</Text>
                            <TextInput
                              style={styles.editInput}
                              value={String(currentItem.unit_price)}
                              onChangeText={(text) => handleItemEdit(index, 'unit_price', parseFloat(text) || 0)}
                              keyboardType="decimal-pad"
                              placeholder="Price"
                            />
                          </View>

                          {currentItem.current_stock !== undefined && (
                            <View style={styles.stockWarning}>
                              {currentItem.current_stock === 0 ? (
                                <Text style={styles.stockWarningTextDanger}>
                                  ⚠️ This item is out of stock
                                </Text>
                              ) : currentItem.quantity > currentItem.current_stock ? (
                                <Text style={styles.stockWarningTextWarning}>
                                  ⚠️ Only {currentItem.current_stock} available in stock
                                </Text>
                              ) : (
                                <Text style={styles.stockWarningTextSuccess}>
                                  ✅ {currentItem.current_stock} available in stock
                                </Text>
                              )}
                            </View>
                          )}
                        </>
                      ) : (
                        <View style={styles.quantityPriceRow}>
                          <Text style={styles.quantityText}>
                            {currentItem.quantity} {currentItem.unit}
                          </Text>
                          <Text style={styles.priceText}>
                            @ ${currentItem.unit_price.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.itemTotal}>${currentItem.total_price.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Expanded Details */}
                  {expandedItem === index && (
                    <View style={styles.itemExpanded}>
                      {item.current_stock !== undefined && (
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Current Stock:</Text>
                          <Text style={styles.expandedValue}>{item.current_stock} units</Text>
                        </View>
                      )}
                      {item.customer_price && (
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Customer's Last Price:</Text>
                          <Text style={styles.expandedValue}>${item.customer_price.toFixed(2)}</Text>
                        </View>
                      )}
                      {item.price_expires && (
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Price Valid Until:</Text>
                          <Text style={styles.expandedValue}>
                            {new Date(item.price_expires).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {item.matched_product && (
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Regular Price:</Text>
                          <Text style={styles.expandedValue}>${item.matched_product.price.toFixed(2)}</Text>
                        </View>
                      )}
                      <View style={styles.itemActions}>
                        {isEditing ? (
                          <>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.saveButton]}
                              onPress={() => saveItemEdit(index)}
                            >
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                              <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.cancelButton]}
                              onPress={() => {
                                delete editingItems[index];
                                setEditingItems({ ...editingItems });
                              }}
                            >
                              <Ionicons name="close" size={16} color="#666" />
                              <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.editButton]}
                              onPress={() => setEditingItems({ ...editingItems, [index]: item })}
                            >
                              <Ionicons name="create-outline" size={16} color="#E74C3C" />
                              <Text style={styles.editButtonText}>Edit</Text>
                            </TouchableOpacity>
                            {item.product_id && (
                              <TouchableOpacity
                                style={[styles.actionButton, styles.historyButton]}
                                onPress={() => fetchProductPriceHistory(item.product_id!, item.product_name)}
                              >
                                <Ionicons name="time-outline" size={16} color="#3498DB" />
                                <Text style={styles.historyButtonText}>History</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={[styles.actionButton, styles.deleteButton]}
                              onPress={() => removeItem(index)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                              <Text style={styles.deleteButtonText}>Remove</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {processedItems.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="cart-outline" size={48} color="#DDD" />
                <Text style={styles.emptyStateText}>No items in order</Text>
                <Text style={styles.emptyStateSubtext}>Add products to get started</Text>
              </View>
            )}
          </View>

          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${orderSummary.subtotal.toFixed(2)}</Text>
              </View>
              {orderSummary.totalSavings > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#27AE60' }]}>Customer Savings</Text>
                  <Text style={[styles.summaryValue, { color: '#27AE60' }]}>
                    -${orderSummary.totalSavings.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax (10%)</Text>
                <Text style={styles.summaryValue}>${orderSummary.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>${orderSummary.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Stock Warning */}
          {!orderSummary.allInStock && processedItems.length > 0 && (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color="#F39C12" />
              <Text style={styles.warningText}>
                Some items are out of stock. You can proceed with available items only.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!customerId || processedItems.length === 0) && styles.primaryButtonDisabled
            ]}
            onPress={handleSubmitOrder}
            disabled={!customerId || processedItems.length === 0}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Create Proposal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItemModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.addItemModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product to Order</Text>
              <TouchableOpacity onPress={() => {
                setShowAddItemModal(false);
                setSearchQuery('');
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by product name, SKU, or barcode..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.searchResults}>
              {searchQuery.length > 0 ? (
                filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => {
                    const customerPrice = customerPriceHistory.get(product.id);
                    const isValidPrice = customerPrice && (!customerPrice.valid_until || new Date(customerPrice.valid_until) > new Date());
                    
                    return (
                      <TouchableOpacity
                        key={product.id}
                        style={styles.productItem}
                        onPress={() => addProductManually(product)}
                      >
                        <View style={styles.productItemInfo}>
                          <Text style={styles.productItemName}>{product.product_name}</Text>
                          <View style={styles.productItemMeta}>
                            <Text style={styles.productItemSku}>SKU: {product.sku || 'N/A'}</Text>
                            <Text style={styles.productItemStock}>
                              Stock: {product.quantity} {product.unit}
                            </Text>
                            {isValidPrice ? (
                              <View style={styles.priceComparison}>
                                <Text style={styles.customerPriceLabel}>
                                  Customer: ${customerPrice.last_price.toFixed(2)}
                                </Text>
                                <Text style={styles.regularPriceLabel}>
                                  Regular: ${product.price.toFixed(2)}
                                </Text>
                                {customerPrice.valid_until && (
                                  <Text style={styles.priceExpiryLabel}>
                                    Valid until: {new Date(customerPrice.valid_until).toLocaleDateString()}
                                  </Text>
                                )}
                              </View>
                            ) : (
                              <Text style={styles.productItemPrice}>${product.price.toFixed(2)}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.productItemAction}>
                          <Ionicons name="add-circle" size={28} color="#E74C3C" />
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.noResults}>
                    <Ionicons name="search-outline" size={48} color="#DDD" />
                    <Text style={styles.noResultsText}>No products found</Text>
                    <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                  </View>
                )
              ) : (
                <View style={styles.searchPrompt}>
                  <Ionicons name="cube-outline" size={48} color="#DDD" />
                  <Text style={styles.searchPromptText}>Start typing to search products</Text>
                  <Text style={styles.searchPromptSubtext}>Customer prices will be applied automatically</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Price History Modal */}
      <Modal
        visible={showPriceHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPriceHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.historyModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Price History: {selectedProductName}</Text>
              <TouchableOpacity onPress={() => setShowPriceHistory(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.historyList}>
              {selectedProductHistory.length > 0 ? (
                selectedProductHistory.map((history, index) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyItemLeft}>
                      <Text style={styles.historyPrice}>${history.price.toFixed(2)}</Text>
                      <Text style={styles.historyDate}>{history.date}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noHistory}>
                  <Text style={styles.noHistoryText}>No price history available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // All existing styles plus new ones
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 4,
  },
  customerPriceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#3498DB15',
  },
  customerPriceText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    color: '#3498DB',
  },
  priceComparison: {
    flexDirection: 'column',
    gap: 2,
  },
  customerPriceLabel: {
    fontSize: 13,
    color: '#3498DB',
    fontWeight: '600',
  },
  regularPriceLabel: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  priceExpiryLabel: {
    fontSize: 11,
    color: '#F39C12',
    fontStyle: 'italic',
  },
  historyButton: {
    backgroundColor: '#E8F4FD',
    borderColor: '#3498DB',
  },
  historyButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  historyModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  historyList: {
    padding: 20,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyItemLeft: {
    flex: 1,
  },
  historyPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  historyDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  noHistory: {
    alignItems: 'center',
    padding: 40,
  },
  noHistoryText: {
    fontSize: 14,
    color: '#999',
  },
  processingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  processingAnimation: {
    marginBottom: 20,
    alignItems: 'center',
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  headerButton: {
    padding: 5,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  customerContent: {
    padding: 15,
  },
  customerInfoRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  customerInfoLeft: {
    flex: 1,
    marginRight: 20,
  },
  customerInfoRight: {
    flex: 1,
  },
  customerInfoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 2,
  },
  customerInfoValue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  outstandingBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 16,
    color: '#27AE60',
    fontWeight: '600',
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveryContent: {
    paddingLeft: 32,
  },
  deliveryRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  deliveryItem: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  deliveryValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  itemsSection: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  matchingSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  matchingSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  summaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  summaryStatLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  summaryStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  itemContent: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 15,
  },
  itemProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  itemQuantityPrice: {
    alignItems: 'flex-end',
  },
  quantityPriceRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  quantityText: {
    fontSize: 14,
    color: '#666',
  },
  priceText: {
    fontSize: 14,
    color: '#666',
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  editingFields: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    minWidth: 50,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  atText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  itemExpanded: {
    padding: 15,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  expandedLabel: {
    fontSize: 14,
    color: '#666',
  },
  expandedValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: '#FFF0F0',
    borderColor: '#E74C3C',
  },
  editButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#E74C3C',
  },
  deleteButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  summaryContent: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 15,
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
  summaryDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 15,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F39C12',
    marginLeft: 10,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 5,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  stockWarning: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  stockWarningTextDanger: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '500',
  },
  stockWarningTextWarning: {
    fontSize: 12,
    color: '#F39C12',
    fontWeight: '500',
  },
  stockWarningTextSuccess: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  addItemModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    margin: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#333',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  productItemInfo: {
    flex: 1,
  },
  productItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  productItemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  productItemSku: {
    fontSize: 13,
    color: '#666',
  },
  productItemStock: {
    fontSize: 13,
    color: '#666',
  },
  productItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
  },
  productItemAction: {
    justifyContent: 'center',
    marginLeft: 10,
  },
  noResults: {
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 20,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
  },
  searchPrompt: {
    alignItems: 'center',
    paddingTop: 60,
  },
  searchPromptText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 20,
  },
  searchPromptSubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
  },
})