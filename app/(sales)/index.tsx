// app/(sales)/index.tsx - Updated Sales Dashboard with Improvements
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import InvoiceGenerator from '../../src/components/sales/InvoiceGenerator';
import OrderSummary from '../../src/components/sales/OrderSummary';
import PastOrders from '../../src/components/sales/PastOrders';
import SalesAnalytics from '../../src/components/sales/SalesAnalytics';
import { supabase } from '../../src/lib/supabase';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
}

interface Product {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  price: number;
  category: string;
  is_active: boolean;
}

interface OrderItem {
  product: Product;
  quantity: number;
  unit_price: number;
  total_price: number;
  in_stock: boolean;
  stock_status: 'in_stock' | 'out_of_stock' | 'low_stock';
  custom_price?: boolean;
}

interface OrderForm {
  customerId: string;
  deliveryDate: Date;
  deliveryTime: Date;
  paymentType: string;
  orderType: 'pickup' | 'phone' | 'card_zelle';
  items: OrderItem[];
}

// Product item with local state for quantity and price
interface ProductItemState {
  product: Product;
  quantity: string;
  customPrice: string;
  useCustomPrice: boolean;
}

export default function SalesAgentDashboard() {
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'past' | 'analytics'>('new');
  
  // Customer search states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customersPage, setCustomersPage] = useState(0);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(true);
  const CUSTOMERS_PER_PAGE = 20;
  
  // Modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  
  // Product modal states with individual controls
  const [productItemStates, setProductItemStates] = useState<Map<string, ProductItemState>>(new Map());

  // Calendar and time state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');

  const [orderForm, setOrderForm] = useState<OrderForm>({
    customerId: '',
    deliveryDate: new Date(),
    deliveryTime: new Date(),
    paymentType: 'cash',
    orderType: 'pickup',
    items: [],
  });

  const paymentTypes = [
    { label: 'Cash', value: 'cash' },
    { label: 'Credit Card', value: 'credit' },
    { label: 'Net 30', value: 'net30' },
    { label: 'Net 60', value: 'net60' },
  ];

  const orderTypes = [
    { label: 'Pick Up', value: 'pickup', icon: 'walk-outline' },
    { label: 'By Phone', value: 'phone', icon: 'call-outline' },
    { label: 'Card/Zelle', value: 'card_zelle', icon: 'card-outline' },
  ];

  useEffect(() => {
    fetchUserInfo();
    fetchProducts();
  }, []);

  // Debounced customer search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (customerSearchQuery.length > 0) {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        searchCustomers();
      }, 300);
    } else {
      setCustomers([]);
      setCustomersPage(0);
      setHasMoreCustomers(true);
    }
    
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [customerSearchQuery]);

  const fetchUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      } else {
        setUserName(user.email?.split('@')[0] || 'Agent');
      }
    }
  };

  const searchCustomers = async (loadMore = false) => {
    if (isLoadingCustomers) return;
    
    setIsLoadingCustomers(true);
    const currentPage = loadMore ? customersPage + 1 : 0;
    
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // Add search filter
      if (customerSearchQuery && customerSearchQuery.trim() !== '') {
        const searchTerm = customerSearchQuery.trim();
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      // Add pagination
      const start = currentPage * CUSTOMERS_PER_PAGE;
      const end = start + CUSTOMERS_PER_PAGE - 1;
      query = query.range(start, end);

      const { data, error } = await query;

      if (error) {
        console.error('Customer search error:', error);
        throw error;
      }

      if (loadMore) {
        setCustomers(prev => [...prev, ...(data || [])]);
      } else {
        setCustomers(data || []);
      }

      setCustomersPage(currentPage);
      setHasMoreCustomers((data?.length || 0) >= CUSTOMERS_PER_PAGE);
    } catch (error) {
      console.error('Error searching customers:', error);
      Alert.alert('Error', 'Failed to search customers. Please try again.');
    } finally {
      setIsLoadingCustomers(false);
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
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // Memoized filtered products for search
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery) return [];
    
    const query = productSearchQuery.toLowerCase();
    const filtered = products.filter(p => 
      p.product_name.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    ).slice(0, 20);

    // Initialize states for new products
    filtered.forEach(product => {
      if (!productItemStates.has(product.id)) {
        setProductItemStates(prev => {
          const newMap = new Map(prev);
          newMap.set(product.id, {
            product,
            quantity: '1',
            customPrice: product.price.toString(),
            useCustomPrice: false
          });
          return newMap;
        });
      }
    });

    return filtered;
  }, [productSearchQuery, products]);

  // Calculate order totals - Fixed to include out of stock items
  const orderSummary = useMemo(() => {
    const subtotal = orderForm.items.reduce((sum, item) => sum + item.total_price, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    const allInStock = orderForm.items.every(item => item.in_stock);
    const hasOutOfStock = orderForm.items.some(item => !item.in_stock);

    return { subtotal, tax, total, allInStock, hasOutOfStock };
  }, [orderForm.items]);

  const addProductToOrder = useCallback((productState: ProductItemState) => {
    const { product, quantity, customPrice, useCustomPrice } = productState;
    const requestedQty = parseInt(quantity) || 1;
    const availableStock = product.quantity;
    
    const stockStatus: 'in_stock' | 'out_of_stock' | 'low_stock' = 
      availableStock === 0 ? 'out_of_stock' :
      availableStock < requestedQty ? 'low_stock' : 'in_stock';

    const finalPrice = useCustomPrice ? (parseFloat(customPrice) || 0) : product.price;

    const newItem: OrderItem = {
      product,
      quantity: requestedQty,
      unit_price: finalPrice,
      total_price: requestedQty * finalPrice,
      in_stock: stockStatus === 'in_stock',
      stock_status: stockStatus,
      custom_price: useCustomPrice,
    };

    setOrderForm(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    // Show warning if out of stock but still add to order
    if (stockStatus === 'out_of_stock') {
      Alert.alert('Out of Stock', `${product.product_name} is currently out of stock but has been added to the order.`);
    } else if (stockStatus === 'low_stock') {
      Alert.alert('Low Stock', `Only ${availableStock} units available. Requested ${requestedQty}. Item added to order.`);
    }
  }, []);

  const removeItemFromOrder = useCallback((index: number) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setOrderForm(prev => ({
              ...prev,
              items: prev.items.filter((_, i) => i !== index),
            }));
          }
        }
      ]
    );
  }, []);

  const updateItemQuantity = useCallback((index: number, newQuantity: number) => {
    setOrderForm(prev => {
      const updatedItems = [...prev.items];
      const item = updatedItems[index];
      const availableStock = item.product.quantity;
      
      const stockStatus: 'in_stock' | 'out_of_stock' | 'low_stock' = 
        availableStock === 0 ? 'out_of_stock' :
        availableStock < newQuantity ? 'low_stock' : 'in_stock';

      updatedItems[index] = {
        ...item,
        quantity: newQuantity,
        total_price: newQuantity * item.unit_price,
        in_stock: stockStatus === 'in_stock',
        stock_status: stockStatus,
      };

      return { ...prev, items: updatedItems };
    });
  }, []);

  const handleSubmitOrder = useCallback(() => {
    // Validation
    if (!orderForm.customerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (orderForm.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item to the order');
      return;
    }

    if (orderSummary.hasOutOfStock) {
      Alert.alert(
        'Out of Stock Items',
        'Some items in your order are out of stock. The order will be created but may need adjustment.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: () => setShowOrderSummary(true) }
        ]
      );
    } else {
      setShowOrderSummary(true);
    }
  }, [orderForm, orderSummary]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
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

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setOrderForm({ ...orderForm, customerId: customer.id });
    setShowCustomerModal(false);
    setCustomerSearchQuery('');
  };

  const selectPaymentType = (type: string) => {
    setOrderForm({ ...orderForm, paymentType: type });
    setShowPaymentModal(false);
  };

  const selectOrderType = (type: string) => {
    setOrderForm({ ...orderForm, orderType: type as 'pickup' | 'phone' | 'card_zelle' });
    setShowOrderTypeModal(false);
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, disabled: true });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      date.setHours(0, 0, 0, 0);
      const isPast = date < today;
      days.push({
        day,
        date,
        disabled: isPast,
        isToday: date.getTime() === today.getTime(),
        isSelected: orderForm.deliveryDate &&
          date.getTime() === new Date(orderForm.deliveryDate.getFullYear(),
            orderForm.deliveryDate.getMonth(),
            orderForm.deliveryDate.getDate()).getTime()
      });
    }

    return days;
  };

  const handleDateSelection = (date: Date) => {
    setOrderForm({ ...orderForm, deliveryDate: date });
    setShowDateModal(false);
  };

  const handleTimeConfirm = () => {
    const newTime = new Date();
    let hours = selectedHour;

    if (selectedPeriod === 'PM' && hours !== 12) {
      hours += 12;
    } else if (selectedPeriod === 'AM' && hours === 12) {
      hours = 0;
    }

    newTime.setHours(hours, selectedMinute, 0, 0);
    setOrderForm({ ...orderForm, deliveryTime: newTime });
    setShowTimeModal(false);
  };

  const changeMonth = (increment: number) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + increment);
    setCalendarMonth(newMonth);
  };

  const openTimePicker = () => {
    const currentTime = orderForm.deliveryTime;
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    setSelectedPeriod(hours >= 12 ? 'PM' : 'AM');
    setSelectedHour(hours === 0 ? 12 : hours > 12 ? hours - 12 : hours);
    setSelectedMinute(Math.round(minutes / 15) * 15);
    setShowTimeModal(true);
  };

  const handleProductStateChange = (productId: string, field: keyof ProductItemState, value: any) => {
    setProductItemStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(productId);
      if (currentState) {
        newMap.set(productId, {
          ...currentState,
          [field]: value
        });
      }
      return newMap;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Sales Dashboard</Text>
            <Text style={styles.userName}>{userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()}</Text>
            <Text style={styles.roleText}>Sales Manager</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.activeTab]}
          onPress={() => setActiveTab('new')}
        >
          <Ionicons name="add-circle-outline" size={20} color={activeTab === 'new' ? '#E74C3C' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'new' && styles.activeTabText]}>New Order</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Ionicons name="time-outline" size={20} color={activeTab === 'past' ? '#E74C3C' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>Past Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
          onPress={() => setActiveTab('analytics')}
        >
          <Ionicons name="analytics-outline" size={20} color={activeTab === 'analytics' ? '#E74C3C' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>Analytics</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'new' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Order Form */}
            <View style={styles.formCard}>
              {/* Customer Selection */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Order Information</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Customer <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowCustomerModal(true)}
                  >
                    <Text style={[styles.selectButtonText, !selectedCustomer && styles.placeholderText]}>
                      {selectedCustomer ? selectedCustomer.name : 'Search and select customer'}
                    </Text>
                    <Ionicons name="search-outline" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Order Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Order Type <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowOrderTypeModal(true)}
                  >
                    <View style={styles.orderTypeDisplay}>
                      <Ionicons 
                        name={orderTypes.find(t => t.value === orderForm.orderType)?.icon as any} 
                        size={20} 
                        color="#666" 
                      />
                      <Text style={styles.selectButtonText}>
                        {orderTypes.find(t => t.value === orderForm.orderType)?.label}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Delivery Date and Time */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>
                      Delivery Date <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowDateModal(true)}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#666" />
                      <Text style={styles.dateTimeText}>{formatDate(orderForm.deliveryDate)}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>
                      Delivery Time <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={openTimePicker}
                    >
                      <Ionicons name="time-outline" size={20} color="#666" />
                      <Text style={styles.dateTimeText}>{formatTime(orderForm.deliveryTime)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Payment Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Payment Type <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowPaymentModal(true)}
                  >
                    <Text style={styles.selectButtonText}>
                      {paymentTypes.find(p => p.value === orderForm.paymentType)?.label || 'Select payment'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Order Items Section */}
              <View style={styles.formSection}>
                <View style={styles.itemsHeader}>
                  <Text style={styles.sectionTitle}>Order Items</Text>
                  <TouchableOpacity
                    style={styles.addItemButton}
                    onPress={() => setShowProductModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#E74C3C" />
                    <Text style={styles.addItemButtonText}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                {orderForm.items.length === 0 ? (
                  <View style={styles.emptyItems}>
                    <Ionicons name="cube-outline" size={48} color="#DDD" />
                    <Text style={styles.emptyItemsText}>No items added yet</Text>
                    <Text style={styles.emptyItemsSubtext}>Tap "Add Item" to start building your order</Text>
                  </View>
                ) : (
                  <View style={styles.itemsList}>
                    {orderForm.items.map((item, index) => (
                      <View key={index} style={styles.orderItem}>
                        <View style={styles.orderItemHeader}>
                          <Text style={styles.orderItemName}>{item.product.product_name}</Text>
                          <TouchableOpacity onPress={() => removeItemFromOrder(index)}>
                            <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={styles.orderItemDetails}>
                          <View style={styles.orderItemQuantity}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => updateItemQuantity(index, Math.max(1, item.quantity - 1))}
                            >
                              <Ionicons name="remove" size={18} color="#666" />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => updateItemQuantity(index, item.quantity + 1)}
                            >
                              <Ionicons name="add" size={18} color="#666" />
                            </TouchableOpacity>
                            <Text style={styles.unitText}>{item.product.unit}</Text>
                          </View>
                          
                          <View style={styles.orderItemPricing}>
                            <Text style={styles.unitPrice}>
                              @ ${item.unit_price.toFixed(2)} {item.custom_price && '(custom)'}
                            </Text>
                            <Text style={styles.itemTotal}>${item.total_price.toFixed(2)}</Text>
                          </View>
                        </View>

                        {!item.in_stock && (
                          <View style={styles.stockWarning}>
                            <Ionicons name="warning" size={16} color="#E74C3C" />
                            <Text style={styles.stockWarningText}>
                              {item.stock_status === 'out_of_stock' ? 'Out of stock' : 
                               `Only ${item.product.quantity} available`}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Order Summary */}
                {orderForm.items.length > 0 && (
                  <View style={styles.summaryBox}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal</Text>
                      <Text style={styles.summaryValue}>${orderSummary.subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Tax (10%)</Text>
                      <Text style={styles.summaryValue}>${orderSummary.tax.toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>${orderSummary.total.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, (isLoading || orderForm.items.length === 0) && styles.submitButtonDisabled]}
                onPress={handleSubmitOrder}
                disabled={isLoading || orderForm.items.length === 0}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Review Order</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : activeTab === 'past' ? (
        <PastOrders salesAgentId={userId} />
      ) : (
        <SalesAnalytics salesAgentId={userId} />
      )}

      {/* Customer Selection Modal - Updated with Search */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCustomerModal(false);
          setCustomerSearchQuery('');
          setCustomers([]);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.customerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => {
                setShowCustomerModal(false);
                setCustomerSearchQuery('');
                setCustomers([]);
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Customer Search Input */}
            <View style={styles.customerSearchContainer}>
              <Ionicons name="search-outline" size={20} color="#666" />
              <TextInput
                style={styles.customerSearchInput}
                placeholder="Search by name, email, or phone..."
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                autoFocus
              />
              {customerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setCustomerSearchQuery('');
                  setCustomers([]);
                }}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.customerListContainer}>
              {isLoadingCustomers && customers.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#E74C3C" />
                  <Text style={styles.loadingText}>Searching customers...</Text>
                </View>
              ) : customerSearchQuery.length === 0 ? (
                <View style={styles.searchPrompt}>
                  <Ionicons name="people-outline" size={48} color="#DDD" />
                  <Text style={styles.searchPromptText}>Start typing to search customers</Text>
                </View>
              ) : customers.length === 0 ? (
                <View style={styles.noResults}>
                  <Ionicons name="search-outline" size={48} color="#DDD" />
                  <Text style={styles.noResultsText}>No customers found</Text>
                  <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                </View>
              ) : (
                <FlatList
                  data={customers}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.customerItem}
                      onPress={() => selectCustomer(item)}
                    >
                      <View style={styles.customerItemInfo}>
                        <Text style={styles.customerName}>{item.name}</Text>
                        <Text style={styles.customerDetail}>{item.email}</Text>
                        <Text style={styles.customerDetail}>{item.phone}</Text>
                      </View>
                      {selectedCustomer?.id === item.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#E74C3C" />
                      )}
                    </TouchableOpacity>
                  )}
                  style={styles.customerList}
                  onEndReached={() => {
                    if (hasMoreCustomers && !isLoadingCustomers) {
                      searchCustomers(true);
                    }
                  }}
                  onEndReachedThreshold={0.1}
                  ListFooterComponent={() => 
                    isLoadingCustomers && customers.length > 0 ? (
                      <ActivityIndicator style={styles.loadMoreIndicator} color="#E74C3C" />
                    ) : null
                  }
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Type Modal */}
      <Modal
        visible={showOrderTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOrderTypeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Order Type</Text>
              <TouchableOpacity onPress={() => setShowOrderTypeModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {orderTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.orderTypeItem}
                onPress={() => selectOrderType(type.value)}
              >
                <View style={styles.orderTypeItemContent}>
                  <Ionicons name={type.icon as any} size={24} color="#666" />
                  <Text style={styles.orderTypeText}>{type.label}</Text>
                </View>
                {orderForm.orderType === type.value && (
                  <Ionicons name="checkmark-circle" size={24} color="#E74C3C" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Payment Type Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Type</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {paymentTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.paymentItem}
                onPress={() => selectPaymentType(type.value)}
              >
                <Text style={styles.paymentText}>{type.label}</Text>
                {orderForm.paymentType === type.value && (
                  <Ionicons name="checkmark-circle" size={24} color="#E74C3C" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Product Selection Modal - Updated with individual controls */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowProductModal(false);
          setProductSearchQuery('');
          setProductItemStates(new Map());
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.productModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={() => {
                setShowProductModal(false);
                setProductSearchQuery('');
                setProductItemStates(new Map());
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
                autoFocus
              />
              {productSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setProductSearchQuery('');
                  setProductItemStates(new Map());
                }}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.productList}>
              {productSearchQuery.length > 0 ? (
                filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => {
                    const productState = productItemStates.get(product.id);
                    if (!productState) return null;

                    return (
                      <View key={product.id} style={styles.productItemCard}>
                        <View style={styles.productInfoSection}>
                          <Text style={styles.productName} numberOfLines={2}>
                            {product.product_name}
                          </Text>
                          <View style={styles.productMetaRow}>
                            <Text style={styles.productSku}>SKU: {product.sku}</Text>
                            <Text style={[
                              styles.productStock,
                              product.quantity === 0 && styles.outOfStock
                            ]}>
                              Stock: {product.quantity} {product.unit}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.productControls}>
                          <View style={styles.quantityRow}>
                            <Text style={styles.controlLabel}>Qty:</Text>
                            <TextInput
                              style={styles.quantityInput}
                              value={productState.quantity}
                              onChangeText={(text) => handleProductStateChange(product.id, 'quantity', text)}
                              keyboardType="numeric"
                              placeholder="1"
                            />
                            <Text style={styles.unitLabel}>{product.unit}</Text>
                          </View>

                          <View style={styles.priceRow}>
                            <TouchableOpacity
                              style={styles.priceToggle}
                              onPress={() => handleProductStateChange(product.id, 'useCustomPrice', !productState.useCustomPrice)}
                            >
                              <Ionicons 
                                name={productState.useCustomPrice ? "checkbox" : "square-outline"} 
                                size={20} 
                                color={productState.useCustomPrice ? "#E74C3C" : "#666"} 
                              />
                              <Text style={styles.priceToggleText}>Custom</Text>
                            </TouchableOpacity>
                            
                            <TextInput
                              style={[styles.priceInput, !productState.useCustomPrice && styles.priceInputDisabled]}
                              value={productState.useCustomPrice ? productState.customPrice : product.price.toString()}
                              onChangeText={(text) => handleProductStateChange(product.id, 'customPrice', text)}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              editable={productState.useCustomPrice}
                            />
                          </View>

                          <TouchableOpacity 
                            style={styles.addProductButton}
                            onPress={() => {
                              addProductToOrder(productState);
                              setProductSearchQuery('');
                              setProductItemStates(new Map());
                              setShowProductModal(false);
                            }}
                          >
                            <Ionicons name="add-circle" size={28} color="#E74C3C" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.noResults}>
                    <Ionicons name="search-outline" size={48} color="#DDD" />
                    <Text style={styles.noResultsText}>No products found</Text>
                  </View>
                )
              ) : (
                <View style={styles.searchPrompt}>
                  <Ionicons name="cube-outline" size={48} color="#DDD" />
                  <Text style={styles.searchPromptText}>Start typing to search</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date and Time Modals remain the same */}
      {/* Date Modal */}
      <Modal
        visible={showDateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery Date</Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.quickDateOptions}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.quickDateChip}
                  onPress={() => handleDateSelection(new Date())}
                >
                  <Text style={styles.quickDateChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateChip}
                  onPress={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    handleDateSelection(tomorrow);
                  }}
                >
                  <Text style={styles.quickDateChipText}>Tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateChip}
                  onPress={() => {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    handleDateSelection(nextWeek);
                  }}
                >
                  <Text style={styles.quickDateChipText}>Next Week</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View style={styles.calendar}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={() => changeMonth(-1)}>
                  <Ionicons name="chevron-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.calendarMonth}>
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)}>
                  <Ionicons name="chevron-forward" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.weekDays}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <Text key={index} style={styles.weekDay}>{day}</Text>
                ))}
              </View>

              <View style={styles.calendarDays}>
                {generateCalendarDays().map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      item.isToday && styles.todayDay,
                      item.isSelected && styles.selectedDay,
                      item.disabled && styles.disabledDay,
                    ]}
                    onPress={() => item.date && !item.disabled && handleDateSelection(item.date)}
                    disabled={item.disabled}
                  >
                    {item.day && (
                      <Text style={[
                        styles.calendarDayText,
                        item.isToday && styles.todayDayText,
                        item.isSelected && styles.selectedDayText,
                        item.disabled && styles.disabledDayText,
                      ]}>
                        {item.day}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Modal */}
      <Modal
        visible={showTimeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.timeModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery Time</Text>
              <TouchableOpacity onPress={() => setShowTimeModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.timePicker}>
              <View style={styles.timePickerRow}>
                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Hour</Text>
                  <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                    {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.timePickerItem,
                          selectedHour === hour && styles.timePickerItemSelected
                        ]}
                        onPress={() => setSelectedHour(hour)}
                      >
                        <Text style={[
                          styles.timePickerItemText,
                          selectedHour === hour && styles.timePickerItemTextSelected
                        ]}>
                          {hour}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Minute</Text>
                  <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                    {[0, 15, 30, 45].map((minute) => (
                      <TouchableOpacity
                        key={minute}
                        style={[
                          styles.timePickerItem,
                          selectedMinute === minute && styles.timePickerItemSelected
                        ]}
                        onPress={() => setSelectedMinute(minute)}
                      >
                        <Text style={[
                          styles.timePickerItemText,
                          selectedMinute === minute && styles.timePickerItemTextSelected
                        ]}>
                          {minute.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Period</Text>
                  <View style={styles.periodPicker}>
                    <TouchableOpacity
                      style={[
                        styles.periodButton,
                        selectedPeriod === 'AM' && styles.periodButtonSelected
                      ]}
                      onPress={() => setSelectedPeriod('AM')}
                    >
                      <Text style={[
                        styles.periodButtonText,
                        selectedPeriod === 'AM' && styles.periodButtonTextSelected
                      ]}>
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.periodButton,
                        selectedPeriod === 'PM' && styles.periodButtonSelected
                      ]}
                      onPress={() => setSelectedPeriod('PM')}
                    >
                      <Text style={[
                        styles.periodButtonText,
                        selectedPeriod === 'PM' && styles.periodButtonTextSelected
                      ]}>
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.confirmTimeButton} onPress={handleTimeConfirm}>
                <Text style={styles.confirmTimeButtonText}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Summary Modal */}
      {showOrderSummary && (
        <OrderSummary
          orderForm={orderForm}
          customer={selectedCustomer}
          orderSummary={orderSummary}
          salesAgentId={userId}
          onClose={() => setShowOrderSummary(false)}
          onConfirm={(orderId) => {
            setSavedOrderId(orderId);
            setShowOrderSummary(false);
            setShowInvoice(true);
          }}
        />
      )}

      {/* Invoice Generator */}
      {showInvoice && savedOrderId && (
        <InvoiceGenerator
          orderId={savedOrderId}
          customer={selectedCustomer}
          items={orderForm.items.map(item => ({
            product_name: item.product.product_name,
            sku: item.product.sku,
            quantity: item.quantity,
            unit: item.product.unit,
            unit_price: item.unit_price,
            total_price: item.total_price,
          }))}
          orderSummary={orderSummary}
          orderData={orderForm}
          onClose={() => {
            setShowInvoice(false);
            // Reset form
            setOrderForm({
              customerId: '',
              deliveryDate: new Date(),
              deliveryTime: new Date(),
              paymentType: 'cash',
              orderType: 'pickup',
              items: [],
            });
            setSelectedCustomer(null);
            setSavedOrderId(null);
            Alert.alert('Success', 'Order created successfully!');
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#E74C3C',
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.95,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  roleText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  logoutButton: {
    padding: 5,
    marginTop: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#E74C3C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#E74C3C',
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 30,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  required: {
    color: '#E74C3C',
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    backgroundColor: '#FAFAFA',
  },
  selectButtonText: {
    fontSize: 15,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  orderTypeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    backgroundColor: '#FAFAFA',
  },
  dateTimeText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addItemButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderStyle: 'dashed',
  },
  emptyItemsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    fontWeight: '500',
  },
  emptyItemsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  itemsList: {
    gap: 10,
  },
  orderItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  orderItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  orderItemPricing: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: 14,
    color: '#666',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  stockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 6,
    gap: 6,
  },
  stockWarningText: {
    fontSize: 13,
    color: '#E74C3C',
    fontWeight: '500',
  },
  summaryBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
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
    fontSize: 18,
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
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  customerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  productModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
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
  // Customer search styles
  customerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    margin: 20,
    marginTop: 0,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  customerSearchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#333',
  },
  customerListContainer: {
    flex: 1,
  },
  customerList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  customerItemInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  customerDetail: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  loadMoreIndicator: {
    paddingVertical: 20,
  },
  searchPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  searchPromptText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 20,
  },
  noResults: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
  orderTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderTypeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderTypeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  paymentText: {
    fontSize: 16,
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
  productList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  // Updated product item styles for better layout
  productItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  productInfoSection: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  productMetaRow: {
    flexDirection: 'row',
    gap: 15,
  },
  productSku: {
    fontSize: 12,
    color: '#666',
  },
  productStock: {
    fontSize: 12,
    color: '#666',
  },
  outOfStock: {
    color: '#E74C3C',
    fontWeight: '500',
  },
  productControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  controlLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 6,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    width: 50,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  unitLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.5,
  },
  priceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  priceToggleText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  priceInputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#999',
  },
  addProductButton: {
    padding: 4,
  },
  // Calendar styles
  quickDateOptions: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  quickDateChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  quickDateChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  calendar: {
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarMonth: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  calendarDayText: {
    fontSize: 16,
    color: '#333',
  },
  todayDay: {
    backgroundColor: '#F0F0F0',
    borderRadius: 50,
  },
  todayDayText: {
    fontWeight: '600',
  },
  selectedDay: {
    backgroundColor: '#E74C3C',
    borderRadius: 50,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: '#CCC',
  },
  // Time picker styles
  timeModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  timePicker: {
    padding: 20,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timePickerLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 10,
  },
  timePickerScroll: {
    maxHeight: 200,
  },
  timePickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    marginVertical: 2,
    borderRadius: 8,
  },
  timePickerItemSelected: {
    backgroundColor: '#FFF0F0',
  },
  timePickerItemText: {
    fontSize: 18,
    color: '#333',
  },
  timePickerItemTextSelected: {
    color: '#E74C3C',
    fontWeight: '600',
  },
  periodPicker: {
    marginTop: 10,
  },
  periodButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    marginVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  periodButtonSelected: {
    backgroundColor: '#E74C3C',
  },
  periodButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  periodButtonTextSelected: {
    color: '#FFFFFF',
  },
  confirmTimeButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
  },
  confirmTimeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});