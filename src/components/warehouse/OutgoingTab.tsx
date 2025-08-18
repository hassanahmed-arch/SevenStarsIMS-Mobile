import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import {
  AssignedOrder,
  OrderItem,
  calculateWorkDuration,
  completeOrder,
  getAssignedOrders,
  getOrderItems,
  getPriorityColor,
  getPriorityText,
  startOrder,
} from '../../services/warehouseOrderService';

export default function OutgoingTab() {
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AssignedOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const assignedOrders = await getAssignedOrders(user.id);
      setOrders(assignedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, []);

  const handleStartOrder = async (order: AssignedOrder) => {
    Alert.alert(
      'Start Order',
      `Are you ready to start working on order ${order.order.order_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setActionLoading(true);
            const success = await startOrder(order.id);
            if (success) {
              fetchOrders(); // Refresh the list
            } else {
              Alert.alert('Error', 'Failed to start order. Please try again.');
            }
            setActionLoading(false);
          }
        }
      ]
    );
  };

  const handleCompleteOrder = async (order: AssignedOrder) => {
    Alert.alert(
      'Complete Order',
      `Mark order ${order.order.order_number} as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await completeOrder(order.id);
            if (success) {
              setShowOrderDetails(false);
              fetchOrders(); // Refresh the list
            } else {
              Alert.alert('Error', 'Failed to complete order. Please try again.');
            }
            setActionLoading(false);
          }
        }
      ]
    );
  };

  const handleViewOrder = async (order: AssignedOrder) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
    
    // Fetch order items
    const items = await getOrderItems(order.order.id);
    setOrderItems(items);
  };

  const renderOrderCard = ({ item }: { item: AssignedOrder }) => {
    const canStart = item.status === 'pending_manager_review' || item.status === 'assigned';
    const isInProgress = item.status === 'in_progress';
    const isCompleted = item.status === 'completed';

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{item.order.order_number}</Text>
            <Text style={styles.customerName}>{item.order.customer?.name || 'Unknown Customer'}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.order.priority_level) }]}>
            <Text style={styles.priorityText}>{getPriorityText(item.order.priority_level)}</Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {new Date(item.order.delivery_date).toLocaleDateString()} at {item.order.delivery_time}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.detailText}>${item.order.total_amount.toFixed(2)}</Text>
          </View>
          {isInProgress && item.work_started_at && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color="#3498DB" />
              <Text style={[styles.detailText, { color: '#3498DB' }]}>
                Working for {calculateWorkDuration(item.work_started_at)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.orderActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.viewButton]} 
            onPress={() => handleViewOrder(item)}
          >
            <Ionicons name="eye-outline" size={18} color="#3498DB" />
            <Text style={styles.viewButtonText}>View Items</Text>
          </TouchableOpacity>

          {canStart && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.startButton]} 
              onPress={() => handleStartOrder(item)}
              disabled={actionLoading}
            >
              <Ionicons name="play-outline" size={18} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Start</Text>
            </TouchableOpacity>
          )}

          {isCompleted && (
            <View style={[styles.actionButton, styles.completedButton]}>
              <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
              <Text style={styles.completedButtonText}>Completed</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E74C3C" />
        <Text style={styles.loadingText}>Loading your assigned orders...</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={64} color="#CCC" />
        <Text style={styles.emptyTitle}>No Orders Assigned</Text>
        <Text style={styles.emptyText}>
          You don't have any orders assigned to you right now.
          Pull to refresh to check for new assignments.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
      />

      {/* Order Details Modal */}
      <Modal
        visible={showOrderDetails}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Order {selectedOrder?.order.order_number}
            </Text>
            <TouchableOpacity onPress={() => setShowOrderDetails(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={orderItems}
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemSku}>{item.product_sku || 'No SKU'}</Text>
                </View>
                <View style={styles.itemQuantity}>
                  <Text style={styles.quantityText}>{item.quantity} {item.unit}</Text>
                  <Text style={styles.priceText}>${item.total_price.toFixed(2)}</Text>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
            style={styles.itemsList}
          />

          {selectedOrder?.status === 'in_progress' && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => selectedOrder && handleCompleteOrder(selectedOrder)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.completeButtonText}>Order Fulfilled</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    padding: 15,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  orderDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  viewButton: {
    backgroundColor: '#E8F4FD',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  viewButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#3498DB',
    fontWeight: '500',
  },
  startButton: {
    backgroundColor: '#E74C3C',
  },
  startButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  completedButton: {
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#27AE60',
  },
  completedButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  itemsList: {
    flex: 1,
    padding: 15,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  itemSku: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemQuantity: {
    alignItems: 'flex-end',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  priceText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  completeButton: {
    backgroundColor: '#27AE60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    margin: 15,
    borderRadius: 12,
  },
  completeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});