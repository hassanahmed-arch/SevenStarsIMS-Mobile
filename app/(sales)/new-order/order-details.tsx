// app/(sales)/new-order/order-details.tsx - Order Details Screen
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomDateTimePicker from '../../../src/components/sales/DateTimePicker';
import { useOrderFlow } from '../../../src/contexts/OrderFlowContext';

interface OrderDetailsForm {
  orderType: 'delivery' | 'pickup' | 'phone' | 'out_of_state';
  paymentType: 'cash' | 'card_zelle' | 'net15' | 'net30' | 'net60';
  deliveryDate: Date;
  deliveryTime: string;
  poNumber: string;
  notes: string;
  specialHandlingNotes: string;
}

export default function OrderDetailsScreen() {
  const { customer, setOrderData, setCurrentStep, flowType } = useOrderFlow();
  
  const [form, setForm] = useState<OrderDetailsForm>({
    orderType: 'delivery',
    paymentType: 'cash',
    deliveryDate: new Date(),
    deliveryTime: '',
    poNumber: '',
    notes: '',
    specialHandlingNotes: '',
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Partial<OrderDetailsForm>>({});
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState(new Date());

  useEffect(() => {
    if (!customer) {
      Alert.alert('Error', 'Please select a customer first');
      router.replace('/(sales)/new-order/select-customer' as any);
    }
    
    // Set default delivery date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setForm(prev => ({ ...prev, deliveryDate: tomorrow }));
  }, [customer]);

  const validateForm = (): boolean => {
    const newErrors: Partial<OrderDetailsForm> = {};
    
    if (!form.orderType) {
      newErrors.orderType = 'Please select an order type' as any;
    }
    
    if (!form.paymentType) {
      newErrors.paymentType = 'Please select a payment type' as any;
    }
    
    if (!form.deliveryDate) {
      newErrors.deliveryDate = new Date();
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

 const handleNext = () => {
  if (!validateForm()) {
    Alert.alert('Missing Information', 'Please fill in all required fields');
    return;
  }
const formattedTime = deliveryTime 
    ? `${(deliveryTime.getHours() % 12 || 12)}:${deliveryTime.getMinutes().toString().padStart(2, '0')} ${deliveryTime.getHours() >= 12 ? 'PM' : 'AM'}`
    : form.deliveryTime;

  setOrderData({
    orderType: form.orderType,
    paymentType: form.paymentType,
    deliveryDate: form.deliveryDate.toISOString(),
    deliveryTime: formattedTime,
    poNumber: form.poNumber,
    notes: form.notes,
    specialHandlingNotes: form.specialHandlingNotes,
  });
    
    setCurrentStep(3);
  router.push('/(sales)/products' as any);
};

  const OrderTypeButton = ({ 
    type, 
    icon, 
    label 
  }: { 
    type: typeof form.orderType; 
    icon: keyof typeof Ionicons.glyphMap; 
    label: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.optionButton,
        form.orderType === type && styles.optionButtonActive
      ]}
      onPress={() => setForm(prev => ({ ...prev, orderType: type }))}
    >
      <Ionicons 
        name={icon} 
        size={24} 
        color={form.orderType === type ? '#E74C3C' : '#666'} 
      />
      <Text style={[
        styles.optionButtonText,
        form.orderType === type && styles.optionButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const PaymentTypeButton = ({ 
    type, 
    label 
  }: { 
    type: typeof form.paymentType; 
    label: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.paymentButton,
        form.paymentType === type && styles.paymentButtonActive
      ]}
      onPress={() => setForm(prev => ({ ...prev, paymentType: type }))}
    >
      <Text style={[
        styles.paymentButtonText,
        form.paymentType === type && styles.paymentButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header with Progress */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressSteps}>
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, styles.progressDotComplete]}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
              <Text style={styles.progressLabel}>Customer</Text>
            </View>
            <View style={[styles.progressLine, styles.progressLineComplete]} />
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, styles.progressDotActive]} />
              <Text style={[styles.progressLabel, styles.progressLabelActive]}>Details</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <View style={styles.progressDot} />
              <Text style={styles.progressLabel}>Products</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <View style={styles.progressDot} />
              <Text style={styles.progressLabel}>Review</Text>
            </View>
          </View>
        </View>

        {/* Selected Customer Display */}
        {customer && (
          <View style={styles.customerDisplay}>
            <View style={styles.customerDisplayInfo}>
              <Text style={styles.customerDisplayName}>{customer.name}</Text>
              <Text style={styles.customerDisplayDetail}>{customer.email}</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.changeCustomerText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Order Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Type *</Text>
            <View style={styles.optionGrid}>
              <OrderTypeButton type="delivery" icon="car" label="Delivery" />
              <OrderTypeButton type="pickup" icon="basket" label="Pick Up" />
              <OrderTypeButton type="phone" icon="call" label="By Phone" />
              <OrderTypeButton type="out_of_state" icon="airplane" label="Out of State" />
            </View>
          </View>

          {/* Payment Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Type *</Text>
            <View style={styles.paymentGrid}>
              <PaymentTypeButton type="cash" label="Cash on Delivery" />
              <PaymentTypeButton type="card_zelle" label="Card/Zelle" />
              <PaymentTypeButton type="net15" label="NET 15" />
              <PaymentTypeButton type="net30" label="NET 30" />
              <PaymentTypeButton type="net60" label="NET 60" />
            </View>
          </View>

          {/* Delivery Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Date *</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.dateInputText}>
                {form.deliveryDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </TouchableOpacity>
          </View>

       {/* Delivery Time */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Preferred Delivery Time</Text>
  <TouchableOpacity
    style={styles.dateInput}
    onPress={() => setShowTimePicker(true)}
  >
    <Ionicons name="time-outline" size={20} color="#666" />
    <Text style={styles.dateInputText}>
      {deliveryTime 
        ? `${(deliveryTime.getHours() % 12 || 12)}:${deliveryTime.getMinutes().toString().padStart(2, '0')} ${deliveryTime.getHours() >= 12 ? 'PM' : 'AM'}`
        : 'Select time'}
    </Text>
  </TouchableOpacity>
</View>

          {/* PO Number */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PO Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Purchase order number (optional)"
              value={form.poNumber}
              onChangeText={(text) => setForm(prev => ({ ...prev, poNumber: text }))}
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add any notes about this order..."
              value={form.notes}
              onChangeText={(text) => setForm(prev => ({ ...prev, notes: text }))}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Special Handling Notes */}
          {form.orderType === 'delivery' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Special Handling Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Delivery instructions, access codes, etc..."
                value={form.specialHandlingNotes}
                onChangeText={(text) => setForm(prev => ({ ...prev, specialHandlingNotes: text }))}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Continue to Products</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
<CustomDateTimePicker
  visible={showDatePicker}
  mode="date"
  value={form.deliveryDate}
  minimumDate={new Date()}
  onClose={() => setShowDatePicker(false)}
  onConfirm={(date) => {
    setForm(prev => ({ ...prev, deliveryDate: date }));
    setShowDatePicker(false);
  }}
/>
  {/* Time Picker */}
<CustomDateTimePicker
  visible={showTimePicker}
  mode="time"
  value={deliveryTime}
  onClose={() => setShowTimePicker(false)}
  onConfirm={(date) => {
    setDeliveryTime(date);
    setShowTimePicker(false);
  }}
/>      
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
    backgroundColor: '#000000ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000ff',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffffff',
  },
  progressContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#E74C3C',
  },
  progressDotComplete: {
    backgroundColor: '#27AE60',
  },
  progressLabel: {
    fontSize: 11,
    color: '#999',
  },
  progressLabelActive: {
    color: '#E74C3C',
    fontWeight: '500',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
    marginBottom: 20,
  },
  progressLineComplete: {
    backgroundColor: '#27AE60',
  },
  customerDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5FF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D0E8FF',
  },
  customerDisplayInfo: {
    flex: 1,
  },
  customerDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  customerDisplayDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  changeCustomerText: {
    fontSize: 14,
    color: '#3498DB',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  optionButtonActive: {
    borderColor: '#E74C3C',
    backgroundColor: '#FFF0F0',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  optionButtonTextActive: {
    color: '#E74C3C',
    fontWeight: '500',
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    backgroundColor: '#FFF',
  },
  paymentButtonActive: {
    borderColor: '#E74C3C',
    backgroundColor: '#E74C3C',
  },
  paymentButtonText: {
    fontSize: 14,
    color: '#666',
  },
  paymentButtonTextActive: {
    color: '#FFF',
    fontWeight: '500',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFF',
  },
  dateInputText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#FFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomPadding: {
    height: 100,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    paddingVertical: 16,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});