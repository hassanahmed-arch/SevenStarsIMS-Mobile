// src/components/sales/PastProposals.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface PastProposalsProps {
  salesAgentId: string;
}

interface Proposal {
  id: string;
  order_number: string; // Using order_number field
  sales_agent_id: string;
  customer_id: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  order_items: any[]; // From order_items table
  total_amount: number;
  status: string;
  created_at: string;
  delivery_date: string;
  order_type: string;
  payment_type: string;
  notes?: string;
  is_proposal: boolean;
}

export default function PastProposals({ salesAgentId }: PastProposalsProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConverting, setIsConverting] = useState(false); // Added missing state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showProposalDetails, setShowProposalDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchProposals();
  }, [salesAgentId]);

  useEffect(() => {
    applyFilters();
  }, [proposals, searchQuery, filterStatus]);

  const fetchProposals = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // Query orders table where is_proposal = true
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(name, email, phone),
          order_items(*)
        `)
        .eq('sales_agent_id', salesAgentId)
        .eq('is_proposal', true) // Only get proposals
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      Alert.alert('Error', 'Failed to fetch proposals');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleConvertToOrder = async () => {
    if (!selectedProposal) return;
    
    Alert.alert(
      'Convert to Order',
      'Are you sure you want to convert this proposal to an order?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Convert', 
          onPress: async () => {
            try {
              setIsConverting(true);
              
              // Simply update the is_proposal flag to false
              const { error: updateError } = await supabase
                .from('orders')
                .update({ 
                  is_proposal: false,
                  status: 'draft', // Ensure it stays as draft
                  confirmed_at: new Date().toISOString() // Track when it was converted
                })
                .eq('id', selectedProposal.id);

              if (updateError) throw updateError;

              // Get the user for price history
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('No authenticated user');

              // Now create inventory reservations since it's now an order
              if (selectedProposal.order_items && selectedProposal.order_items.length > 0) {
                for (const item of selectedProposal.order_items) {
                  let quantityToReserve = item.quantity;
                  if (item.unit === 'Case') quantityToReserve = item.quantity * 30;
                  else if (item.unit === 'Pallet') quantityToReserve = item.quantity * 100;
                  
                  // Create reservation
                  const { error: reserveError } = await supabase
                    .from('reserved_inventory')
                    .insert({
                      product_id: item.product_id,
                      quantity: quantityToReserve,
                      reserved_by: selectedProposal.customer_id,
                      reserved_for: `Order ${selectedProposal.order_number}`,
                      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                      released: false
                    });

                  if (reserveError) {
                    console.log(`Note: Reservation for ${item.product_name}: ${reserveError.message}`);
                  }

                  // Update customer price history
                  let totalQuantityInItems = item.quantity;
                  if (item.unit === 'Case') totalQuantityInItems = item.quantity * 30;
                  else if (item.unit === 'Pallet') totalQuantityInItems = item.quantity * 100;

                  // Check existing price history
                  const { data: existingHistory } = await supabase
                    .from('customer_price_history')
                    .select('*')
                    .eq('customer_id', selectedProposal.customer_id)
                    .eq('product_id', item.product_id)
                    .single();

                  // Get original product price
                  const { data: product } = await supabase
                    .from('products')
                    .select('price')
                    .eq('id', item.product_id)
                    .single();

                  const originalPrice = product?.price || item.unit_price;
                  const discountPercentage = originalPrice > 0 
                    ? ((originalPrice - item.unit_price) / originalPrice * 100)
                    : 0;

                  // Upsert price history
                  const priceHistoryData = {
                    customer_id: selectedProposal.customer_id,
                    product_id: item.product_id,
                    last_price: item.unit_price,
                    last_quantity: item.quantity,
                    last_unit: item.unit,
                    last_order_date: new Date().toISOString(),
                    original_price: originalPrice,
                    discount_percentage: discountPercentage,
                    price_locked: false,
                    times_ordered: existingHistory ? (existingHistory.times_ordered || 0) + 1 : 1,
                    total_quantity_ordered: existingHistory 
                      ? (existingHistory.total_quantity_ordered || 0) + totalQuantityInItems 
                      : totalQuantityInItems,
                    updated_at: new Date().toISOString(),
                  };

                  await supabase
                    .from('customer_price_history')
                    .upsert(priceHistoryData, {
                      onConflict: 'customer_id,product_id',
                    });
                }
              }

              // Close modal and show success
              setShowProposalDetails(false);
              
              Alert.alert(
                'Success!', 
                `Proposal ${selectedProposal.order_number} has been converted to an order.`,
                [
                  {
                    text: 'View Orders',
                    onPress: () => router.push('/(sales)/past-orders'),
                  },
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(sales)'),
                    style: 'cancel'
                  }
                ]
              );
              
              // Refresh the proposals list
              fetchProposals();
              
            } catch (error) {
              console.error('Error converting proposal:', error);
              Alert.alert('Error', 'Failed to convert proposal to order. Please try again.');
            } finally {
              setIsConverting(false);
            }
          }
        }
      ]
    );
  };

  const applyFilters = () => {
    let filtered = [...proposals];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(proposal => 
        proposal.order_number.toLowerCase().includes(query) ||
        proposal.customer?.name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'converted') {
        // Converted proposals are those with is_proposal = false
        // Since we're only fetching is_proposal = true, we can't show converted ones
        filtered = [];
      } else if (filterStatus === 'expired') {
        // Check if proposal is expired (7 days from creation)
        filtered = filtered.filter(proposal => {
          const expiryDate = new Date(proposal.created_at);
          expiryDate.setDate(expiryDate.getDate() + 7);
          return expiryDate < new Date();
        });
      } else {
        filtered = filtered.filter(proposal => proposal.status === filterStatus);
      }
    }

    setFilteredProposals(filtered);
  };

  const getStatusColor = (proposal: Proposal) => {
    // Check if expired (7 days old)
    const expiryDate = new Date(proposal.created_at);
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    if (expiryDate < new Date()) return '#E74C3C'; // Expired
    if (proposal.status === 'draft') return '#3498DB'; // Active draft
    return '#666'; // Default
  };

  const getStatusIcon = (proposal: Proposal) => {
    const expiryDate = new Date(proposal.created_at);
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    if (expiryDate < new Date()) return 'close-circle'; // Expired
    if (proposal.status === 'draft') return 'document-text'; // Active
    return 'help-circle'; // Default
  };

  const getProposalStatus = (proposal: Proposal) => {
    const expiryDate = new Date(proposal.created_at);
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    if (expiryDate < new Date()) return 'expired';
    return proposal.status;
  };

  const getExpiryDate = (proposal: Proposal) => {
    const expiryDate = new Date(proposal.created_at);
    expiryDate.setDate(expiryDate.getDate() + 7);
    return expiryDate;
  };

  const renderProposal = ({ item }: { item: Proposal }) => {
    const status = getProposalStatus(item);
    const itemCount = item.order_items ? item.order_items.length : 0;
    
    return (
      <TouchableOpacity
        style={styles.proposalCard}
        onPress={() => {
          setSelectedProposal(item);
          setShowProposalDetails(true);
        }}
      >
        <View style={styles.proposalHeader}>
          <View>
            <Text style={styles.proposalNumber}>{item.order_number}</Text>
            <Text style={styles.proposalDate}>
              Created: {new Date(item.created_at).toLocaleDateString()}
            </Text>
            <Text style={styles.expiryDate}>
              Expires: {getExpiryDate(item).toLocaleDateString()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item)}15` }]}>
            <Ionicons 
              name={getStatusIcon(item) as any} 
              size={14} 
              color={getStatusColor(item)} 
            />
            <Text style={[styles.statusText, { color: getStatusColor(item) }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>
        
        <View style={styles.proposalBody}>
          <View style={styles.proposalInfo}>
            <Ionicons name="person-outline" size={16} color="#666" />
            <Text style={styles.customerName}>{item.customer?.name || 'N/A'}</Text>
          </View>
          <View style={styles.proposalInfo}>
            <Ionicons name="cube-outline" size={16} color="#666" />
            <Text style={styles.itemCount}>{itemCount} items</Text>
          </View>
        </View>

        <View style={styles.proposalFooter}>
          <Text style={styles.totalAmount}>${item.total_amount?.toFixed(2) || '0.00'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by proposal # or customer..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {['all', 'draft', 'expired'].map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              filterStatus === status && styles.filterChipActive
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[
              styles.filterChipText,
              filterStatus === status && styles.filterChipTextActive
            ]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Proposals List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>Loading proposals...</Text>
        </View>
      ) : filteredProposals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#DDD" />
          <Text style={styles.emptyText}>No proposals found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your filters'
              : 'Your proposals will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProposals}
          renderItem={renderProposal}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.proposalsList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchProposals(true)}
              colors={['#E74C3C']}
            />
          }
        />
      )}

      {/* Proposal Details Modal */}
      <Modal
        visible={showProposalDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProposalDetails(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Proposal Details</Text>
              <TouchableOpacity onPress={() => setShowProposalDetails(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedProposal && (
              <ScrollView style={styles.modalBody}>
                {/* Proposal Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Proposal Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Number:</Text>
                    <Text style={styles.detailValue}>{selectedProposal.order_number}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedProposal)}15` }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(selectedProposal) }]}>
                        {getProposalStatus(selectedProposal).charAt(0).toUpperCase() + getProposalStatus(selectedProposal).slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedProposal.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expires:</Text>
                    <Text style={styles.detailValue}>
                      {getExpiryDate(selectedProposal).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Delivery Date:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedProposal.delivery_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order Type:</Text>
                    <Text style={styles.detailValue}>
                      {selectedProposal.order_type?.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment:</Text>
                    <Text style={styles.detailValue}>
                      {selectedProposal.payment_type?.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Customer Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Customer Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>{selectedProposal.customer?.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email:</Text>
                    <Text style={styles.detailValue}>{selectedProposal.customer?.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailValue}>{selectedProposal.customer?.phone}</Text>
                  </View>
                </View>

                {/* Proposal Items */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Proposal Items</Text>
                  {selectedProposal.order_items?.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <Text style={styles.itemQuantity}>
                          {item.quantity} {item.unit} @ ${item.unit_price?.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>${item.total_price?.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Total */}
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>${selectedProposal.total_amount?.toFixed(2)}</Text>
                </View>

                {/* Notes if any */}
                {selectedProposal.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Notes</Text>
                    <Text style={styles.notesText}>{selectedProposal.notes}</Text>
                  </View>
                )}

                {/* Convert to Order Button */}
                {selectedProposal && getProposalStatus(selectedProposal) === 'draft' && (
                  <View style={styles.convertSection}>
                    <TouchableOpacity
                      style={[styles.convertButton, isConverting && styles.buttonDisabled]}
                      onPress={handleConvertToOrder}
                      disabled={isConverting}
                    >
                      {isConverting ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="swap-horizontal" size={20} color="#FFF" />
                          <Text style={styles.convertButtonText}>Convert to Order</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchSection: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 44,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#333',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    maxHeight: 50,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#E74C3C',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  proposalsList: {
    padding: 15,
  },
  proposalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  proposalNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  proposalDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  expiryDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  proposalBody: {
    marginBottom: 12,
  },
  proposalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  proposalFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
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
    maxHeight: '90%',
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
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 13,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#E74C3C',
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
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  convertSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  convertButton: {
    flexDirection: 'row',
    backgroundColor: '#27AE60',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  convertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});