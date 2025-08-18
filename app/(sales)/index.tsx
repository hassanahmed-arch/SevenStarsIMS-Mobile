//what happens on this file is that:
//1. we get the sales agent info 
//2. we fetch customers from database for dropdown
//3.we make sure that all the fields are filled before placing an order
//4. we have all the UI of the sales agent screen here
//5. here is use AI to matchh the order to inventory and calculate the total of the order
//6. to use the AI we extract the quantity and product name and price and clean up the text
//7. we match the order to inventory using the product name and quantity
//8. we save the order to the database



// app/(sales)/index.tsx - Updated with improved date and time pickers
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import OrderProcessor from '../../src/components/sales/OrderProcessor';
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

interface OrderForm {
  naturalLanguageOrder: string;
  customerId: string;
  deliveryDate: Date;
  deliveryTime: Date;
  paymentType: string;
}

export default function SalesAgentDashboard() {
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New state for calendar view
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');

  const [orderForm, setOrderForm] = useState<OrderForm>({
    naturalLanguageOrder: '',
    customerId: '',
    deliveryDate: new Date(),
    deliveryTime: new Date(),
    paymentType: 'cash',
  });

  const paymentTypes = [
    { label: 'Cash', value: 'cash' },
    { label: 'Credit Card', value: 'credit' },
    { label: 'Net 30', value: 'net30' },
    { label: 'Net 60', value: 'net60' },
  ];

  useEffect(() => {
    fetchUserInfo();
    fetchCustomers();
  }, []);

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

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleProcessOrder = async () => {
    if (!orderForm.naturalLanguageOrder.trim()) {
      Alert.alert('Error', 'Please enter order details');
      return;
    }

    if (!orderForm.customerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    setIsLoading(true);
    try {
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error processing order:', error);
      Alert.alert('Error', 'Failed to process order');
    } finally {
      setIsLoading(false);
    }
  };

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
  };

  const selectPaymentType = (type: string) => {
    setOrderForm({ ...orderForm, paymentType: type });
    setShowPaymentModal(false);
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

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, disabled: true });
    }

    // Add days of the month
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

  // Initialize time picker values when modal opens
  const openTimePicker = () => {
    const currentTime = orderForm.deliveryTime;
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    setSelectedPeriod(hours >= 12 ? 'PM' : 'AM');
    setSelectedHour(hours === 0 ? 12 : hours > 12 ? hours - 12 : hours);
    setSelectedMinute(Math.round(minutes / 15) * 15); // Round to nearest 15
    setShowTimeModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Place Order</Text>
            <Text style={styles.userName}>{userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()}</Text>
            <Text style={styles.roleText}>Sales Agent</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Create Order Form */}
          <View style={styles.formCard}>
            {/* Customer and Agent Selection */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>
                  Sales Agent <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{userName}</Text>
                </View>
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  Customer <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowCustomerModal(true)}
                >
                  <Text style={[styles.selectButtonText, !selectedCustomer && styles.placeholderText]}>
                    {selectedCustomer ? selectedCustomer.name : 'Select customer'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>
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

            {/* Order Details */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Order Details (Natural Language) <Text style={styles.required}>*</Text></Text>
              <Text style={styles.helperText}>
                Describe your order in natural language. Our AI will match products to your inventory and suggest pricing.
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder='e.g., "10 cases of watermelon adalya $250, watermelon adalya"'
                placeholderTextColor="#999"
                multiline
                numberOfLines={6}
                value={orderForm.naturalLanguageOrder}
                onChangeText={(text) => setOrderForm({ ...orderForm, naturalLanguageOrder: text })}
                textAlignVertical="top"
              />
            </View>

            {/* Process Button */}
            <TouchableOpacity
              style={[styles.processButton, isLoading && styles.processButtonDisabled]}
              onPress={handleProcessOrder}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.processButtonText}>Process Order</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Customer Selection Modal */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomerModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={customers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.customerItem}
                  onPress={() => selectCustomer(item)}
                >
                  <View>
                    <Text style={styles.customerName}>{item.name}</Text>
                    <Text style={styles.customerDetail}>{item.email}</Text>
                  </View>
                  {selectedCustomer?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#E74C3C" />
                  )}
                </TouchableOpacity>
              )}
              style={styles.customerList}
            />
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

      {/* Improved Date Selection Modal with Calendar */}
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

            {/* Quick Select Options */}
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

            {/* Calendar View */}
            <View style={styles.calendar}>
              {/* Month Navigation */}
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

              {/* Weekday Headers */}
              <View style={styles.weekDays}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <Text key={index} style={styles.weekDay}>{day}</Text>
                ))}
              </View>

              {/* Calendar Days */}
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

      {/* Improved Time Selection Modal */}
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

            {/* Popular Times */}
            <View style={styles.popularTimes}>
              <Text style={styles.popularTimesTitle}>Popular delivery times</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  { hour: 9, minute: 0, period: 'AM' },
                  { hour: 12, minute: 0, period: 'PM' },
                  { hour: 2, minute: 0, period: 'PM' },
                  { hour: 5, minute: 0, period: 'PM' },
                ].map((time, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.popularTimeChip}
                    onPress={() => {
                      setSelectedHour(time.hour);
                      setSelectedMinute(time.minute);
                      setSelectedPeriod(time.period as 'AM' | 'PM');
                      handleTimeConfirm();
                    }}
                  >
                    <Text style={styles.popularTimeText}>
                      {time.hour}:{time.minute.toString().padStart(2, '0')} {time.period}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Time Picker */}
            <View style={styles.timePicker}>
              <View style={styles.timePickerRow}>
                {/* Hour Picker */}
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

                {/* Minute Picker */}
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

                {/* AM/PM Picker */}
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

              {/* Selected Time Display */}
              <View style={styles.selectedTimeDisplay}>
                <Text style={styles.selectedTimeLabel}>Selected time:</Text>
                <Text style={styles.selectedTimeValue}>
                  {selectedHour}:{selectedMinute.toString().padStart(2, '0')} {selectedPeriod}
                </Text>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity style={styles.confirmTimeButton} onPress={handleTimeConfirm}>
                <Text style={styles.confirmTimeButtonText}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Confirmation Modal */}
      {showConfirmation && (
        <OrderProcessor
          orderData={orderForm}
          customerId={orderForm.customerId}
          salesAgentId={userId}
          onClose={() => {
            setShowConfirmation(false);
            setOrderForm({
              naturalLanguageOrder: '',
              customerId: '',
              deliveryDate: new Date(),
              deliveryTime: new Date(),
              paymentType: 'cash',
            });
            setSelectedCustomer(null);
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
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
    minHeight: 150,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 20,
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
  readOnlyInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 15,
  },
  readOnlyText: {
    fontSize: 15,
    color: '#666',
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
  processButton: {
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  processButtonDisabled: {
    opacity: 0.7,
  },
  processButtonText: {
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
  customerList: {
    padding: 10,
  },
  customerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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

  // New Calendar Styles
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

  // New Time Picker Styles
  timeModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  popularTimes: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  popularTimesTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
  },
  popularTimeChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  popularTimeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
  selectedTimeDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginBottom: 20,
  },
  selectedTimeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  selectedTimeValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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