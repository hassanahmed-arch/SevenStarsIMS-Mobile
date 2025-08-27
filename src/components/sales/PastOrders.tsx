// src/components/sales/PastOrders.tsx - Fixed to show admin manager name
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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

interface PastOrdersProps {
  salesAgentId: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  delivery_date: string;
  delivery_time: string;
  payment_type: string;
  status: string;
  total_amount: number;
  created_at: string;
  items?: OrderItem[];
  admin_manager_id?: string;
  admin_manager_name?: string;
  admin_manager_email?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  confirmed_at?: string;
  order_type?: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export default function PastOrders({ salesAgentId }: PastOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchOrders();
  }, [salesAgentId]);

  useEffect(() => {
    applyFilters();
  }, [orders, searchQuery, filterStatus, startDate, endDate]);

const fetchOrders = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setPage(0);
    } else {
      setIsLoading(true);
    }

    try {
      // Use the view to get admin manager details
      const { data, error } = await supabase
        .from('orders_with_admin_profile')
        .select(`
          *,
          customer:customers(name, email, phone),
          items:order_items(*)
        `)
        .eq('sales_agent_id', salesAgentId)
        .order('created_at', { ascending: false })
        .range(0, ITEMS_PER_PAGE - 1);

      if (error) throw error;

      setOrders(data || []);
      setHasMore((data?.length || 0) >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadMoreOrders = async () => {
    if (!hasMore || isLoading) return;

    const nextPage = page + 1;
    
    try {
      const { data, error } = await supabase
        .from('orders_with_admin_profile')
        .select(`
          *,
          customer:customers(name, email, phone),
          items:order_items(*)
        `)
        .eq('sales_agent_id', salesAgentId)
        .order('created_at', { ascending: false })
        .range(nextPage * ITEMS_PER_PAGE, (nextPage + 1) * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        setOrders(prev => [...prev, ...data]);
        setPage(nextPage);
        setHasMore(data.length >= ITEMS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more orders:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.order_number.toLowerCase().includes(query) ||
        order.customer?.name?.toLowerCase().includes(query) ||
        order.items?.some(item => 
          item.product_name.toLowerCase().includes(query)
        )
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(order => 
        new Date(order.created_at) >= startDate
      );
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(order => 
        new Date(order.created_at) <= endOfDay
      );
    }

    setFilteredOrders(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#27AE60';
      case 'draft': return '#3498DB';
      case 'pending': return '#F39C12';
      case 'cancelled': return '#E74C3C';
      case 'delivered': return '#8E44AD';
      case 'paid': return '#16A085';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return 'checkmark-circle';
      case 'draft': return 'document-text';
      case 'pending': return 'time';
      case 'cancelled': return 'close-circle';
      case 'delivered': return 'cube';
      case 'paid': return 'cash';
      default: return 'help-circle';
    }
  };

  const getOrderTypeLabel = (type?: string) => {
    switch (type) {
      case 'pickup': return 'Pick Up';
      case 'phone': return 'By Phone';
      case 'card_zelle': return 'Card/Zelle';
      default: return 'Standard';
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setStartDate(null);
    setEndDate(null);
  };

   const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => {
        setSelectedOrder(item);
        setShowOrderDetails(true);
      }}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>{item.order_number}</Text>
          <Text style={styles.orderDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
          <Ionicons 
            name={getStatusIcon(item.status) as any} 
            size={14} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      
      <View style={styles.orderBody}>
        <View style={styles.orderInfo}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.customerName}>{item.customer?.name || 'N/A'}</Text>
        </View>
        <View style={styles.orderInfo}>
          <Ionicons name="cube-outline" size={16} color="#666" />
          <Text style={styles.itemCount}>
            {item.items?.length || 0} items
          </Text>
        </View>
        {item.order_type && (
          <View style={styles.orderInfo}>
            <Ionicons name="cart-outline" size={16} color="#666" />
            <Text style={styles.orderTypeLabel}>
              {getOrderTypeLabel(item.order_type)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.totalAmount}>${item.total_amount.toFixed(2)}</Text>
        {item.status === 'cancelled' && (
          <View style={styles.cancelledIndicator}>
            <Ionicons name="warning" size={14} color="#E74C3C" />
            <Text style={styles.cancelledText}>Cancelled</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order #, customer, or product..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter-outline" size={20} color="#E74C3C" />
          {(filterStatus !== 'all' || startDate || endDate) && (
            <View style={styles.filterDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', 'draft', 'confirmed', 'pending', 'delivered', 'paid', 'cancelled'].map(status => (
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
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Date Range:</Text>
            <View style={styles.dateFilters}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker('start')}
              >
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.dateButtonText}>
                  {startDate ? startDate.toLocaleDateString() : 'Start Date'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.dateSeparator}>to</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker('end')}
              >
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.dateButtonText}>
                  {endDate ? endDate.toLocaleDateString() : 'End Date'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Orders List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#DDD" />
          <Text style={styles.emptyText}>No orders found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery || filterStatus !== 'all' || startDate || endDate
              ? 'Try adjusting your filters'
              : 'Your past orders will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchOrders(true)}
              colors={['#E74C3C']}
            />
          }
          onEndReached={loadMoreOrders}
          onEndReachedThreshold={0.1}
          ListFooterComponent={() => 
            hasMore && !isRefreshing ? (
              <ActivityIndicator style={styles.loadMore} color="#E74C3C" />
            ) : null
          }
        />
      )}

      {/* Order Details Modal */}
      <Modal
        visible={showOrderDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOrderDetails(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setShowOrderDetails(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody}>
                {/* Order Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Order Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order Number:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.order_number}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedOrder.status)}15` }]}>
                      <Ionicons 
                        name={getStatusIcon(selectedOrder.status) as any} 
                        size={14} 
                        color={getStatusColor(selectedOrder.status)} 
                      />
                      <Text style={[styles.statusText, { color: getStatusColor(selectedOrder.status) }]}>
                        {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order Type:</Text>
                    <Text style={styles.detailValue}>
                      {getOrderTypeLabel(selectedOrder.order_type)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Delivery Date:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedOrder.delivery_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.payment_type}</Text>
                  </View>
                </View>

                {/* Status History - Updated Section */}
                {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'cancelled') && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Status History</Text>
                    {selectedOrder.status === 'confirmed' && (
                      <View style={styles.statusHistoryItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                        <View style={styles.statusHistoryInfo}>
                          <Text style={styles.statusHistoryText}>
                            Confirmed by {selectedOrder.admin_manager_name || 'Admin Manager'}
                          </Text>
                          {selectedOrder.admin_manager_email && (
                            <Text style={styles.statusHistoryEmail}>
                              {selectedOrder.admin_manager_email}
                            </Text>
                          )}
                          {selectedOrder.confirmed_at && (
                            <Text style={styles.statusHistoryDate}>
                              {new Date(selectedOrder.confirmed_at).toLocaleString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                    {selectedOrder.status === 'cancelled' && (
                      <View style={styles.statusHistoryItem}>
                        <Ionicons name="close-circle" size={20} color="#E74C3C" />
                        <View style={styles.statusHistoryInfo}>
                          <Text style={styles.statusHistoryText}>
                            Cancelled by {selectedOrder.admin_manager_name || 'Admin Manager'}
                          </Text>
                          {selectedOrder.admin_manager_email && (
                            <Text style={styles.statusHistoryEmail}>
                              {selectedOrder.admin_manager_email}
                            </Text>
                          )}
                          {selectedOrder.cancellation_reason && (
                            <Text style={styles.cancellationReason}>
                              Reason: {selectedOrder.cancellation_reason}
                            </Text>
                          )}
                          {selectedOrder.cancelled_at && (
                            <Text style={styles.statusHistoryDate}>
                              {new Date(selectedOrder.cancelled_at).toLocaleString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Customer Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Customer Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customer?.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customer?.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customer?.phone}</Text>
                  </View>
                </View>

                {/* Order Items */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Order Items</Text>
                  {selectedOrder.items?.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <Text style={styles.itemQuantity}>
                          {item.quantity} {item.unit} @ ${item.unit_price.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>${item.total_price.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Total */}
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>${selectedOrder.total_amount.toFixed(2)}</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={showDatePicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(null);
            if (date) {
              if (showDatePicker === 'start') {
                setStartDate(date);
              } else {
                setEndDate(date);
              }
            }
          }}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
    statusHistoryEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  searchSection: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#333',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E74C3C',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterRow: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
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
  dateFilters: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
  },
  dateSeparator: {
    marginHorizontal: 10,
    color: '#666',
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '500',
  },
  ordersList: {
    padding: 15,
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 13,
    color: '#666',
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
  orderBody: {
    marginBottom: 12,
  },
  orderInfo: {
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
  orderTypeLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  cancelledIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cancelledText: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '500',
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
  loadMore: {
    paddingVertical: 20,
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
  statusHistoryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    paddingLeft: 10,
  },
  statusHistoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusHistoryText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusHistoryDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  cancellationReason: {
    fontSize: 13,
    color: '#E74C3C',
    marginTop: 6,
    fontStyle: 'italic',
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
});