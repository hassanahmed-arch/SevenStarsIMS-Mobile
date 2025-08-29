// app/(sales)/new-order/select-customer.tsx - Select Customer Screen
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useOrderFlow } from '../../../src/contexts/OrderFlowContext';
import { supabase } from '../../../src/lib/supabase';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  customer_type?: string;
  outstanding_balance: number;
  credit_limit: number;
  is_active: boolean;
  out_of_state: boolean;
}

export default function SelectCustomerScreen() {
  const { setCustomer, setCurrentStep, flowType } = useOrderFlow();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery]);

  const fetchCustomers = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      customer.phone?.includes(query)
    );

    setFilteredCustomers(filtered);
  };

  const getCustomerStatus = (customer: Customer) => {
    if (customer.customer_type === 'Platinum') {
      return { badge: 'Platinum', color: '#8E44AD' };
    } else if (customer.customer_type === 'Gold') {
      return { badge: 'Gold', color: '#F39C12' };
    } else {
      return { badge: 'Standard', color: '#95A5A6' };
    }
  };

  const checkCreditLimit = (customer: Customer): boolean => {
    // Platinum customers have no credit limit restrictions
    if (customer.customer_type === 'Platinum') {
      return true;
    }

    // Check if outstanding balance exceeds credit limit
    return customer.outstanding_balance <= customer.credit_limit;
  };

  const handleSelectCustomer = (customer: Customer) => {
    const withinLimit = checkCreditLimit(customer);

    if (!withinLimit) {
      setSelectedCustomer(customer);
      setShowWarningModal(true);
    } else {
      proceedWithCustomer(customer);
    }
  };

  const proceedWithCustomer = (customer: Customer) => {
    setCustomer(customer);
    setCurrentStep(2);
    router.push('/(sales)/new-order/order-details' as any);
  };

  const renderCustomer = ({ item }: { item: Customer }) => {
    const status = getCustomerStatus(item);
    const withinLimit = checkCreditLimit(item);
    const balancePercentage = item.credit_limit > 0 
      ? (item.outstanding_balance / item.credit_limit) * 100 
      : 0;

    return (
      <TouchableOpacity
        style={styles.customerCard}
        onPress={() => handleSelectCustomer(item)}
      >
        <View style={styles.customerHeader}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.badge}
              </Text>
            </View>
          </View>
          {item.out_of_state && (
            <View style={styles.outOfStateBadge}>
              <Text style={styles.outOfStateText}>Out of State</Text>
            </View>
          )}
        </View>

        <View style={styles.customerDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{item.email}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{item.phone || 'No phone'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.city}, {item.state}
            </Text>
          </View>
        </View>

        <View style={styles.creditSection}>
          <View style={styles.creditHeader}>
            <Text style={styles.creditLabel}>Outstanding Balance</Text>
            <Text style={[
              styles.creditValue,
              !withinLimit && styles.creditValueWarning
            ]}>
              ${item.outstanding_balance.toLocaleString()}
            </Text>
          </View>
          
          {item.customer_type !== 'Platinum' && (
            <>
              <View style={styles.creditBar}>
                <View 
                  style={[
                    styles.creditBarFill,
                    { 
                      width: `${Math.min(balancePercentage, 100)}%`,
                      backgroundColor: balancePercentage > 90 ? '#E74C3C' : 
                                      balancePercentage > 70 ? '#F39C12' : '#27AE60'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.creditLimit}>
                Credit Limit: ${item.credit_limit.toLocaleString()}
              </Text>
            </>
          )}
        </View>

        {!withinLimit && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={16} color="#E74C3C" />
            <Text style={styles.warningText}>Exceeds credit limit</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Progress */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {flowType === 'proposal' ? 'New Proposal' : 'New Order'}
        </Text>
        <TouchableOpacity 
          style={styles.addCustomerButton}
          onPress={() => router.push('/(sales)/new-customer' as any)}
        >
          <Ionicons name="person-add-outline" size={20} color="#ffffffff" />
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressSteps}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <Text style={[styles.progressLabel, styles.progressLabelActive]}>Customer</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={styles.progressDot} />
            <Text style={styles.progressLabel}>Details</Text>
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

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Customer List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchCustomers(true)}
              colors={['#E74C3C']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#DDD" />
              <Text style={styles.emptyText}>No customers found</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/(sales)/new-customer' as any)}
              >
                <Text style={styles.addButtonText}>Add New Customer</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Credit Warning Modal */}
      <Modal
        visible={showWarningModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={48} color="#F39C12" />
            </View>
            
            <Text style={styles.modalTitle}>Credit Limit Exceeded</Text>
            
            {selectedCustomer && (
              <>
                <Text style={styles.modalMessage}>
                  {selectedCustomer.name} has exceeded their credit limit.
                </Text>
                
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Outstanding Balance:</Text>
                    <Text style={styles.modalDetailValue}>
                      ${selectedCustomer.outstanding_balance.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Credit Limit:</Text>
                    <Text style={styles.modalDetailValue}>
                      ${selectedCustomer.credit_limit.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Over Limit:</Text>
                    <Text style={[styles.modalDetailValue, styles.overLimitText]}>
                      ${(selectedCustomer.outstanding_balance - selectedCustomer.credit_limit).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalQuestion}>
                  Do you want to continue with this order?
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowWarningModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.modalContinueButton}
                    onPress={() => {
                      setShowWarningModal(false);
                      if (selectedCustomer) {
                        proceedWithCustomer(selectedCustomer);
                      }
                    }}
                  >
                    <Text style={styles.modalContinueText}>Continue Anyway</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  addCustomerButton: {
    padding: 4,
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
  },
  progressDotActive: {
    backgroundColor: '#E74C3C',
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#333',
  },
  listContent: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  outOfStateBadge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  outOfStateText: {
    fontSize: 11,
    color: '#E74C3C',
    fontWeight: '500',
  },
  customerDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  creditSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  creditLabel: {
    fontSize: 13,
    color: '#666',
  },
  creditValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  creditValueWarning: {
    color: '#E74C3C',
  },
  creditBar: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  creditBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  creditLimit: {
    fontSize: 12,
    color: '#999',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFE0E0',
  },
  warningText: {
    fontSize: 13,
    color: '#E74C3C',
    marginLeft: 6,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalDetails: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  overLimitText: {
    color: '#E74C3C',
  },
  modalQuestion: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  modalContinueButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F39C12',
    alignItems: 'center',
  },
  modalContinueText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
});