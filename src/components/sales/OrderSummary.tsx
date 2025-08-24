// src/components/sales/OrderSummary.tsx - Updated for database compatibility
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface OrderSummaryProps {
  orderForm: {
    customerId: string;
    deliveryDate: Date;
    deliveryTime: Date;
    paymentType: string;
    orderType: 'pickup' | 'phone' | 'card_zelle';
    items: Array<{
      product: {
        id: string;
        product_name: string;
        sku: string;
        unit: string;
        quantity: number;
      };
      quantity: number;
      unit_price: number;
      total_price: number;
      in_stock: boolean;
      stock_status: string;
    }>;
  };
  customer: any;
  orderSummary: {
    subtotal: number;
    tax: number;
    total: number;
    hasOutOfStock: boolean;
  };
  salesAgentId: string;
  onClose: () => void;
  onConfirm: (orderId: string) => void;
}

export default function OrderSummary({
  orderForm,
  customer,
  orderSummary,
  salesAgentId,
  onClose,
  onConfirm,
}: OrderSummaryProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);

    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;
      
      // Determine priority level
      const deliveryDate = new Date(orderForm.deliveryDate);
      const daysDiff = Math.ceil((deliveryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const priorityLevel = daysDiff <= 1 ? 9 : daysDiff <= 3 ? 7 : orderSummary.total > 1000 ? 6 : 5;

      // Calculate totals
      const finalSubtotal = Number(orderSummary.subtotal);
      const finalTax = Number(orderSummary.tax);
      const finalTotal = Number(orderSummary.total);

      // Ensure order_type is a valid string value
      const orderType = orderForm.orderType || 'pickup';

      console.log('Creating order with data:', {
        order_number: orderNumber,
        customer_id: orderForm.customerId,
        sales_agent_id: salesAgentId,
        delivery_date: orderForm.deliveryDate.toISOString().split('T')[0],
        delivery_time: orderForm.deliveryTime.toTimeString().split(' ')[0],
        payment_type: orderForm.paymentType,
        order_type: orderType,
        status: 'draft',
        subtotal: finalSubtotal,
        tax_amount: finalTax,
        total_amount: finalTotal,
        priority_level: priorityLevel,
        warehouse_status: 'pending_assignment'
      });

      // Save order to database - CLEANED UP FOR DATABASE COMPATIBILITY
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: orderForm.customerId,
          sales_agent_id: salesAgentId,
          delivery_date: orderForm.deliveryDate.toISOString().split('T')[0],
          delivery_time: orderForm.deliveryTime.toTimeString().split(' ')[0],
          payment_type: orderForm.paymentType,
          order_type: orderType,
          status: 'draft',
          subtotal: finalSubtotal,
          tax_amount: finalTax,
          total_amount: finalTotal,
          priority_level: priorityLevel,
          warehouse_status: 'pending_assignment',
          // Only include fields that exist in the orders table schema
          // No search-related fields or computed columns
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order insertion error:', orderError);
        throw orderError;
      }

      console.log('Order created successfully:', order);

      // Prepare order items - CLEANED UP FOR DATABASE COMPATIBILITY
      const orderItems = orderForm.items.map(item => {
        const orderItem = {
          order_id: order.id,
          product_id: item.product.id,
          product_name: item.product.product_name,
          product_sku: item.product.sku,
          quantity: Number(item.quantity),
          unit: item.product.unit,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
          stock_available: Number(item.product.quantity),
          stock_status: item.stock_status,
          // Only include fields that exist in the order_items table schema
          // No search-related fields or computed columns
        };

        console.log('Order item data:', orderItem);
        return orderItem;
      });

      console.log('Inserting order items:', orderItems);

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Order items insertion error:', itemsError);
        throw itemsError;
      }

      console.log('Order items created successfully');

      // Success - call onConfirm with order ID
      onConfirm(order.id);

    } catch (error: any) {
      console.error('Error saving order:', error);
      
      // Provide specific error messages based on error type
      if (error?.code === '0A000' || error?.message?.includes('gtrgm')) {
        Alert.alert(
          'Database Error', 
          'Search configuration issue detected. Please contact your system administrator.'
        );
      } else if (error?.code === '23503') {
        // Foreign key violation
        Alert.alert(
          'Reference Error', 
          'Invalid customer, product, or user reference. Please refresh and try again.'
        );
      } else if (error?.code === '23505') {
        // Unique constraint violation
        Alert.alert(
          'Duplicate Error', 
          'Order number already exists. Please try again.'
        );
      } else if (error?.message?.includes('order_type')) {
        Alert.alert('Error', 'Invalid order type selected. Please try again.');
      } else if (error?.message?.includes('delivery_date')) {
        Alert.alert('Error', 'Invalid delivery date format. Please try again.');
      } else if (error?.message?.includes('delivery_time')) {
        Alert.alert('Error', 'Invalid delivery time format. Please try again.');
      } else {
        Alert.alert(
          'Error', 
          `Failed to save order: ${error.message || 'Unknown error'}. Please try again.`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOrderTypeLabel = () => {
    switch (orderForm.orderType) {
      case 'pickup': return 'Pick Up';
      case 'phone': return 'By Phone';
      case 'card_zelle': return 'Card/Zelle';
      default: return orderForm.orderType || 'Pick Up';
    }
  };

  const getOrderTypeIcon = () => {
    switch (orderForm.orderType) {
      case 'pickup': return 'walk-outline';
      case 'phone': return 'call-outline';
      case 'card_zelle': return 'card-outline';
      default: return 'cube-outline';
    }
  };

  // Validate required data before rendering
  if (!orderForm || !orderForm.items || orderForm.items.length === 0) {
    return (
      <Modal visible animationType="slide" transparent={false}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.errorText}>No order data available</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
          <Text style={styles.headerTitle}>Order Summary</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Customer Info */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-circle" size={24} color="#333" />
              <Text style={styles.cardTitle}>Customer Information</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.customerName}>{customer?.name || 'N/A'}</Text>
              {customer?.email && <Text style={styles.customerDetail}>{customer.email}</Text>}
              {customer?.phone && <Text style={styles.customerDetail}>{customer.phone}</Text>}
              {customer?.address && (
                <Text style={styles.customerDetail}>
                  {`${customer.address}${customer.city ? `, ${customer.city}` : ''}${customer.state ? `, ${customer.state}` : ''} ${customer.zip_code || ''}`.trim()}
                </Text>
              )}
            </View>
          </View>

          {/* Delivery Info */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar" size={24} color="#E74C3C" />
              <Text style={styles.cardTitle}>Delivery Details</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order Type:</Text>
                <View style={styles.orderTypeBadge}>
                  <Ionicons name={getOrderTypeIcon() as any} size={16} color="#666" />
                  <Text style={styles.orderTypeText}>{getOrderTypeLabel()}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Delivery Date:</Text>
                <Text style={styles.detailValue}>
                  {orderForm.deliveryDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Delivery Time:</Text>
                <Text style={styles.detailValue}>
                  {orderForm.deliveryTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Method:</Text>
                <Text style={styles.detailValue}>
                  {orderForm.paymentType.charAt(0).toUpperCase() + orderForm.paymentType.slice(1)}
                </Text>
              </View>
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Order Items ({orderForm.items.length})</Text>
            
            {orderSummary.hasOutOfStock && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={20} color="#F39C12" />
                <Text style={styles.warningText}>
                  Some items are out of stock. They will be included in the order for review.
                </Text>
              </View>
            )}

            {orderForm.items.map((item, index) => (
              <View 
                key={`${item.product.id}-${index}`}
                style={[
                  styles.itemCard,
                  !item.in_stock && styles.itemCardWarning
                ]}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {item.product.product_name}
                    </Text>
                    <Text style={styles.itemSku}>SKU: {item.product.sku}</Text>
                  </View>
                  {!item.in_stock && (
                    <View style={styles.outOfStockBadge}>
                      <Text style={styles.outOfStockText}>
                        {item.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>
                    {item.quantity} {item.product.unit} @ ${Number(item.unit_price).toFixed(2)}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ${Number(item.total_price).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Final Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>
            
            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  ${Number(orderSummary.subtotal).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax (10%)</Text>
                <Text style={styles.summaryValue}>
                  ${Number(orderSummary.tax).toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  ${Number(orderSummary.total).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.statusNote}>
              <Ionicons name="information-circle" size={16} color="#3498DB" />
              <Text style={styles.statusNoteText}>
                This order will be created as a draft and requires warehouse manager confirmation.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Back to Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
            onPress={handleConfirmOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Create Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  cardContent: {
    padding: 15,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
  },
  orderTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  itemsSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F39C12',
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  itemCardWarning: {
    borderColor: '#F39C12',
    backgroundColor: '#FFFBF0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 12,
    color: '#999',
  },
  outOfStockBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E74C3C',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
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
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
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
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 6,
    marginTop: 15,
    gap: 8,
  },
  statusNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#3498DB',
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
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 20,
  },
});