// app/(sales)/new-customer.tsx - New Customer Screen
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  address_2: string;
  address_3: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  customer_type: 'Standard' | 'Gold' | 'Platinum';
  credit_limit: string; // retained in type for minimal diff (no longer used to save)
  tax_id: string;
  bill_to: string;
  bill_to_2: string;
  bill_to_3: string;
  ship_to: string;
  ship_to_2: string;
  ship_to_3: string;
  out_of_state: boolean;
  notes: string;
}

export default function NewCustomerScreen() {
  const [form, setForm] = useState<CustomerForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    address_2: '',
    address_3: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    customer_type: 'Standard',
    credit_limit: '10000', // unused for saving; derived instead
    tax_id: '',
    bill_to: '',
    bill_to_2: '',
    bill_to_3: '',
    ship_to: '',
    ship_to_2: '',
    ship_to_3: '',
    out_of_state: false,
    notes: '',
  });

  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<CustomerForm>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<CustomerForm> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Business name is required';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!form.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!form.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!form.state.trim()) {
      newErrors.state = 'State is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Map customer_type to credit limit and platinum flag
  const getTierInfo = (tier: CustomerForm['customer_type']) => {
    switch (tier) {
      case 'Standard':
        return { credit_limit: 10000, is_platinum: false };
      case 'Gold':
        return { credit_limit: 15000, is_platinum: false };
      case 'Platinum':
        return { credit_limit: 50000, is_platinum: true };
      default:
        return { credit_limit: 10000, is_platinum: false };
    }
  }; // React state updates and derived values pattern per hooks usage. [6][11]

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { credit_limit, is_platinum } = getTierInfo(form.customer_type);

      // Prepare customer data
      const customerData = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        address_2: form.address_2.trim() || null,
        address_3: form.address_3.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        zip_code: form.zip_code.trim(),
        country: form.country,
        customer_type: form.customer_type,
        credit_limit, // derived from tier
        outstanding_balance: 0,
        Bill_to: sameAsBilling ? form.address : form.bill_to,
        Bill_to_2: sameAsBilling ? form.address_2 : form.bill_to_2,
        Bill_to_3: sameAsBilling ? form.address_3 : form.bill_to_3,
        Ship_to: form.ship_to || form.address,
        Ship_to_2: form.ship_to_2 || form.address_2,
        Ship_to_3: form.ship_to_3 || form.address_3,
        out_of_state: form.out_of_state,
        is_platinum, // boolean column as requested
        is_active: true,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single(); // return inserted row if RLS allows select [2][4][7]

      if (error) throw error;

      Alert.alert(
        'Success',
        'Customer created successfully',
        [
          {
            text: 'Create Order',
            onPress: () => {
              router.replace('/(sales)/new-order/select-customer' as any);
            },
          },
          {
            text: 'View Customer',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating customer:', error);
      Alert.alert('Error', error.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const CustomerTypeButton = ({ 
    type, 
    label, 
  }: { 
    type: CustomerForm['customer_type']; 
    label: string;
   
  }) => (
    <TouchableOpacity
      style={[
        styles.tierButton,
        form.customer_type === type && styles.tierButtonActive
      ]}
      onPress={() => setForm(prev => ({ ...prev, customer_type: type }))}
    >
      <View style={styles.tierHeader}>
        <Text style={[
          styles.tierLabel,
          form.customer_type === type && styles.tierLabelActive
        ]}>
          {label}
        </Text>
        {form.customer_type === type && (
          <Ionicons name="checkmark-circle" size={20} color="#E74C3C" />
        )}
      </View>
     
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#ffffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Customer</Text>
          <TouchableOpacity 
            onPress={handleSave}
            disabled={isSubmitting}
            style={styles.saveButton}
          >
            <Text style={[styles.saveButtonText, isSubmitting && styles.saveButtonTextDisabled]}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Name *</Text>
              <TextInput
                style={[styles.textInput, errors.name && styles.inputError]}
                placeholder="Enter business name"
                value={form.name}
                onChangeText={(text) => setForm(prev => ({ ...prev, name: text }))}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={[styles.textInput, errors.email && styles.inputError]}
                placeholder="email@example.com"
                value={form.email}
                onChangeText={(text) => setForm(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone *</Text>
              <TextInput
                style={[styles.textInput, errors.phone && styles.inputError]}
                placeholder="(555) 123-4567"
                value={form.phone}
                onChangeText={(text) => setForm(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tax ID</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Tax identification number"
                value={form.tax_id}
                onChangeText={(text) => setForm(prev => ({ ...prev, tax_id: text }))}
              />
            </View>
          </View>

          {/* Customer Tier */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Tier</Text>
            <View style={styles.tierGrid}>
              <CustomerTypeButton 
                type="Standard" 
                label="Standard"
                
              />
              <CustomerTypeButton 
                type="Gold" 
                label="Gold"
                
              />
              <CustomerTypeButton 
                type="Platinum" 
                label="Platinum"
                
              />
            </View>
            {/* Credit limit input removed; now derived from tier */}
          </View>

          {/* Primary Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Primary Address</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address Line 1 *</Text>
              <TextInput
                style={[styles.textInput, errors.address && styles.inputError]}
                placeholder="Street address"
                value={form.address}
                onChangeText={(text) => setForm(prev => ({ ...prev, address: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address Line 2</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Apt, Suite, Unit, etc. (optional)"
                value={form.address_2}
                onChangeText={(text) => setForm(prev => ({ ...prev, address_2: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address Line 3</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Additional info (optional)"
                value={form.address_3}
                onChangeText={(text) => setForm(prev => ({ ...prev, address_3: text }))}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput
                  style={[styles.textInput, errors.city && styles.inputError]}
                  placeholder="City"
                  value={form.city}
                  onChangeText={(text) => setForm(prev => ({ ...prev, city: text }))}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>State *</Text>
                <TextInput
                  style={[styles.textInput, errors.state && styles.inputError]}
                  placeholder="NJ"
                  value={form.state}
                  onChangeText={(text) => setForm(prev => ({ ...prev, state: text }))}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1.5 }]}>
                <Text style={styles.inputLabel}>ZIP Code</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="12345"
                  value={form.zip_code}
                  onChangeText={(text) => setForm(prev => ({ ...prev, zip_code: text }))}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Out of State Customer</Text>
              <Switch
                value={form.out_of_state}
                onValueChange={(value) => setForm(prev => ({ ...prev, out_of_state: value }))}
                trackColor={{ false: '#E0E0E0', true: '#FFB3B3' }}
                thumbColor={form.out_of_state ? '#E74C3C' : '#FFF'}
              />
            </View>
          </View>

          {/* Billing Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Billing Address</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabelSmall}>Same as primary</Text>
                <Switch
                  value={sameAsBilling}
                  onValueChange={setSameAsBilling}
                  trackColor={{ false: '#E0E0E0', true: '#90EE90' }}
                  thumbColor={sameAsBilling ? '#27AE60' : '#FFF'}
                />
              </View>
            </View>

            {!sameAsBilling && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Billing Address Line 1</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Billing street address"
                    value={form.bill_to}
                    onChangeText={(text) => setForm(prev => ({ ...prev, bill_to: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Billing Address Line 2</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Apt, Suite, Unit, etc."
                    value={form.bill_to_2}
                    onChangeText={(text) => setForm(prev => ({ ...prev, bill_to_2: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Billing Address Line 3</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Additional billing info"
                    value={form.bill_to_3}
                    onChangeText={(text) => setForm(prev => ({ ...prev, bill_to_3: text }))}
                  />
                </View>
              </>
            )}
          </View>

          {/* Shipping Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Address (if different)</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shipping Address Line 1</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Shipping street address"
                value={form.ship_to}
                onChangeText={(text) => setForm(prev => ({ ...prev, ship_to: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shipping Address Line 2</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Apt, Suite, Unit, etc."
                value={form.ship_to_2}
                onChangeText={(text) => setForm(prev => ({ ...prev, ship_to_2: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shipping Address Line 3</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Additional shipping info"
                value={form.ship_to_3}
                onChangeText={(text) => setForm(prev => ({ ...prev, ship_to_3: text }))}
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add any notes about this customer..."
              value={form.notes}
              onChangeText={(text) => setForm(prev => ({ ...prev, notes: text }))}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
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
  saveButton: {
    padding: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  saveButtonTextDisabled: {
    color: '#CCC',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
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
  inputError: {
    borderColor: '#E74C3C',
  },
  errorText: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  tierGrid: {
    gap: 12,
    marginBottom: 16,
  },
  tierButton: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  tierButtonActive: {
    borderColor: '#E74C3C',
    backgroundColor: '#FFF0F0',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  tierLabelActive: {
    color: '#E74C3C',
  },
  tierDescription: {
    fontSize: 13,
    color: '#999',
  },
  creditInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  dollarSign: {
    fontSize: 16,
    color: '#666',
    marginRight: 4,
  },
  creditInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 15,
    color: '#333',
  },
  switchLabelSmall: {
    fontSize: 14,
    color: '#666',
  },
  bottomPadding: {
    height: 40,
  },
});