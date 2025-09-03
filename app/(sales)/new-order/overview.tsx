// app/(sales)/new-order/overview.tsx - Order Overview and Submit Screen
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import InvoiceGenerator from '../../../src/components/sales/InvoiceGenerator';
import ProposalGenerator from '../../../src/components/sales/ProposalGenerator';
import { useCart } from '../../../src/contexts/CartContext';
import { useOrderFlow } from '../../../src/contexts/OrderFlowContext';
import { supabase } from '../../../src/lib/supabase';

interface OrderItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  available_quantity: number;
  is_tobacco?: boolean;
}

export default function OrderOverviewScreen() {
  const params = useLocalSearchParams();
  const { clearCart } = useCart();
  const { customer, orderData, flowType, resetFlow } = useOrderFlow();
  
  const [items, setItems] = useState<OrderItem[]>([]);
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);
  const [showProposalGenerator, setShowProposalGenerator] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

useEffect(() => {
  // Parse the passed data
  if (params.items) {
    try {
      const parsedItems = JSON.parse(params.items as string);
      setItems(parsedItems);
    } catch (error) {
      console.error('Error parsing items:', error);
    }
  }
  if (params.summary) {
    try {
      const parsedSummary = JSON.parse(params.summary as string);
      setOrderSummary(parsedSummary);
    } catch (error) {
      console.error('Error parsing summary:', error);
    }
  }
}, [params.items, params.summary]);

  const getStatusColor = (available: number, quantity: number) => {
    if (available === 0) return '#E74C3C';
    if (quantity > available) return '#F39C12';
    return '#27AE60';
  };

  const getStatusText = (available: number, quantity: number) => {
    if (available === 0) return 'Out of Stock';
    if (quantity > available) return `Only ${available} available`;
    if (quantity <= available) return 'In Stock';
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${year}${month}${day}-${random}`;
  };

  const handleSubmitOrder = async () => {
    if (!customer || !orderData) {
      Alert.alert('Error', 'Missing customer or order details');
      return;
    }

    // Check for out of stock items
    const outOfStockItems = items.filter(item => item.available_quantity === 0);
    const lowStockItems = items.filter(item => 
      item.available_quantity > 0 && item.quantity > item.available_quantity
    );

    if (outOfStockItems.length > 0 || lowStockItems.length > 0) {
      const message = outOfStockItems.length > 0
        ? `${outOfStockItems.length} items are out of stock.`
        : `${lowStockItems.length} items exceed available stock.`;
      
      Alert.alert(
        'Stock Warning',
        `${message} Do you want to proceed anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: () => submitOrder(), style: 'destructive' },
        ]
      );
    } else {
      submitOrder();
    }
  };

const submitOrder = async () => {
  setIsSubmitting(true);
  const generatedOrderNumber = generateOrderNumber();
  setOrderNumber(generatedOrderNumber);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    console.log(`Creating ${flowType === 'proposal' ? 'proposal' : 'order'} ${generatedOrderNumber}`);

    // ============================================
    // CREATE ORDER/PROPOSAL RECORD
    // ============================================
    const orderPayload = {
      order_number: generatedOrderNumber,
      customer_id: customer!.id,
      sales_agent_id: user.id,
      delivery_date: orderData!.deliveryDate,
      delivery_time: orderData!.deliveryTime || null,
      payment_type: orderData!.paymentType,
      status: 'draft',
      subtotal: orderSummary.subtotal,
      tax_amount: orderSummary.tax,
      discount_amount: 0,
      total_amount: orderSummary.total,
      notes: orderData!.notes || null,
      special_handling_notes: orderData!.specialHandlingNotes || null,
      order_type: orderData!.orderType,
      is_proposal: flowType === 'proposal', // KEY FIELD: Determines if this is a proposal or order
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError) throw orderError;

    console.log(`${flowType === 'proposal' ? 'Proposal' : 'Order'} created with ID: ${order.id}`);

    // ============================================
    // CREATE ORDER ITEMS (Same for both proposals and orders)
    // ============================================
    const orderItems = items.map(item => {
      // Calculate actual items needed for stock status display
      let actualItemsNeeded = item.quantity;
      if (item.unit === 'Case') actualItemsNeeded = item.quantity * 30;
      if (item.unit === 'Pallet') actualItemsNeeded = item.quantity * 100;

      return {
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.sku,
        quantity: item.quantity, // Store the unit quantity (e.g., 2 cases)
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        stock_available: item.available_quantity,
        stock_status: actualItemsNeeded > item.available_quantity 
          ? `Only ${item.available_quantity} items available` 
          : 'In Stock',
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    console.log(`Created ${orderItems.length} order items`);

    // ============================================
    // ONLY FOR ACTUAL ORDERS (NOT PROPOSALS)
    // ============================================
    if (flowType !== 'proposal') {
      
      // ============================================
      // CREATE INVENTORY RESERVATIONS
      // ============================================
      console.log('Creating inventory reservations for order...');
      
      for (const item of items) {
        let quantityToReserve = item.quantity;
        if (item.unit === 'Case') {
          quantityToReserve = item.quantity * 30;
        } else if (item.unit === 'Pallet') {
          quantityToReserve = item.quantity * 100;
        }
        
        const { error: reserveError } = await supabase
          .from('reserved_inventory')
          .insert({
            product_id: item.product_id,
            quantity: quantityToReserve,
            reserved_by: customer!.id,
            reserved_for: `Order ${order.order_number}`,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            released: false
          });

        if (reserveError) {
          console.log(`Note: Reservation for ${item.product_name}: ${reserveError.message}`);
          if (reserveError.message?.includes('Insufficient stock')) {
            console.log(`Backorder created for ${item.product_name} - Reserved ${quantityToReserve} items`);
          }
        } else {
          console.log(`Reserved ${quantityToReserve} units of ${item.product_name}`);
        }
      }

      // ============================================
      // SAVE/UPDATE CUSTOMER PRICE HISTORY
      // ============================================
      console.log('Updating customer price history...');
      
      for (const item of items) {
        // Calculate total quantity in base units for history tracking
        let totalQuantityInItems = item.quantity;
        if (item.unit === 'Case') {
          totalQuantityInItems = item.quantity * 30;
        } else if (item.unit === 'Pallet') {
          totalQuantityInItems = item.quantity * 100;
        }

        // Check if there's existing price history for this customer-product combo
        const { data: existingHistory, error: fetchError } = await supabase
          .from('customer_price_history')
          .select('*')
          .eq('customer_id', customer!.id)
          .eq('product_id', item.product_id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Error fetching price history:', fetchError);
        }

        // Get the original product price for discount calculation
        const { data: product } = await supabase
          .from('products')
          .select('price')
          .eq('id', item.product_id)
          .single();

        const originalPrice = product?.price || item.unit_price;
        const discountPercentage = originalPrice > 0 
          ? ((originalPrice - item.unit_price) / originalPrice * 100).toFixed(2)
          : '0';

        // Check if price changed or this is a new customer-product combination
        const priceChanged = !existingHistory || existingHistory.last_price !== item.unit_price;
        const unitChanged = existingHistory && existingHistory.last_unit !== item.unit;

        if (priceChanged || unitChanged || !existingHistory) {
          // Either create new record or update existing one
          const priceHistoryData = {
            customer_id: customer!.id,
            product_id: item.product_id,
            last_price: item.unit_price,
            last_quantity: item.quantity,
            last_unit: item.unit,
            last_order_date: new Date().toISOString(),
            original_price: originalPrice,
            discount_percentage: parseFloat(discountPercentage),
            price_locked: false,
            times_ordered: existingHistory ? (existingHistory.times_ordered || 0) + 1 : 1,
            total_quantity_ordered: existingHistory 
              ? (existingHistory.total_quantity_ordered || 0) + totalQuantityInItems 
              : totalQuantityInItems,
            updated_at: new Date().toISOString(),
          };

          const { error: priceError } = await supabase
            .from('customer_price_history')
            .upsert(priceHistoryData, {
              onConflict: 'customer_id,product_id',
            });

          if (priceError) {
            console.error('Error saving price history:', priceError);
          } else {
            console.log(`Price history updated for ${item.product_name}: 
              Price: $${item.unit_price} (${discountPercentage}% discount), 
              Unit: ${item.unit}`);
          }

          // Log price change to price_change_log if price actually changed
          if (priceChanged && existingHistory) {
            const { error: logError } = await supabase
              .from('price_change_log')
              .insert({
                customer_id: customer!.id,
                product_id: item.product_id,
                old_price: existingHistory.last_price,
                new_price: item.unit_price,
                original_price: originalPrice,
                price_difference_percentage: parseFloat(discountPercentage),
                changed_by: user.id,
                order_id: order.id,
                change_type: item.unit_price < existingHistory.last_price ? 'discount' : 'increase',
                reason: `Order ${order.order_number}`,
              });

            if (logError) {
              console.error('Error logging price change:', logError);
            } else {
              console.log(`Price change logged for ${item.product_name}`);
            }
          }
        } else {
          // Price didn't change, just update the order count and total quantity
          const { error: updateError } = await supabase
            .from('customer_price_history')
            .update({
              times_ordered: (existingHistory.times_ordered || 0) + 1,
              total_quantity_ordered: (existingHistory.total_quantity_ordered || 0) + totalQuantityInItems,
              last_order_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', customer!.id)
            .eq('product_id', item.product_id);

          if (updateError) {
            console.error('Error updating order count:', updateError);
          } else {
            console.log(`Order count updated for ${item.product_name} (price unchanged at $${item.unit_price})`);
          }
        }
      }
    } else {
      console.log('Skipping inventory reservations and price history for proposal');
    }

    // ============================================
    // SUCCESS HANDLING
    // ============================================
    setCreatedOrderId(order.id);
    setShowSuccessModal(true);
    
    // Clear cart after successful submission
    clearCart();
    
    console.log(`${flowType === 'proposal' ? 'Proposal' : 'Order'} ${generatedOrderNumber} created successfully with ${items.length} items`);
    
  } catch (error: any) {
    console.error('Error submitting order:', error);
    Alert.alert(
      'Error', 
      error.message || `Failed to create ${flowType === 'proposal' ? 'proposal' : 'order'}. Please try again.`
    );
  } finally {
    setIsSubmitting(false);
  }
};

  const handleGenerateDocument = () => {
    setShowSuccessModal(false);
    if (flowType === 'proposal') {
      setShowProposalGenerator(true);
    } else {
      setShowInvoiceGenerator(true);
    }
  };

const handleDone = async () => {
  // Navigate FIRST to unmount all order screens
  router.dismissAll();
  router.replace('/(sales)/' as any); // or your main sales route
  
  // Clear contexts after navigation with a delay
  setTimeout(() => {
    resetFlow();
    clearCart();
  }, 100);
};
  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Progress */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {flowType === 'proposal' ? 'Proposal Review' : 'Order Review'}
        </Text>
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
            <View style={[styles.progressDot, styles.progressDotComplete]}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
            <Text style={styles.progressLabel}>Details</Text>
          </View>
          <View style={[styles.progressLine, styles.progressLineComplete]} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotComplete]}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
            <Text style={styles.progressLabel}>Products</Text>
          </View>
          <View style={[styles.progressLine, styles.progressLineComplete]} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <Text style={[styles.progressLabel, styles.progressLabelActive]}>Review</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Warning Banner */}

        {items.some(item => item.available_quantity === 0) && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#0e0d0aff" />
            <Text style={styles.warningText}>
              Some items are out of stock. You can still proceed with the order.
            </Text>
          </View>
        )}
        {/* Customer Section */}
        {customer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoName}>{customer.name}</Text>
              <Text style={styles.infoDetail}>{customer.email}</Text>
              <Text style={styles.infoDetail}>{customer.phone}</Text>
              <Text style={styles.infoDetail}>
                {customer.address}, {customer.city}, {customer.state} {customer.zip_code}
              </Text>
              {customer.customer_type && (
                <View style={[styles.badge, { marginTop: 8 }]}>
                  <Text style={styles.badgeText}>{customer.customer_type} Customer</Text>
                </View>
              )}
            </View>
          </View>
        )}

       {/* Order Details Section */}
{orderData ? (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Order Details</Text>
    <View style={styles.detailsGrid}>
      <View style={styles.detailItem}>
        <Text style={styles.detailLabel}>Type</Text>
        <Text style={styles.detailValue}>
          {orderData.orderType === 'delivery' ? 'Delivery' :
           orderData.orderType === 'pickup' ? 'Pick Up' :
           orderData.orderType === 'phone' ? 'By Phone' : 'Out of State'}
        </Text>
      </View>
      <View style={styles.detailItem}>
        <Text style={styles.detailLabel}>Payment</Text>
        <Text style={styles.detailValue}>
          {orderData.paymentType.toUpperCase().replace('_', ' ')}
        </Text>
      </View>
      <View style={styles.detailItem}>
        <Text style={styles.detailLabel}>Delivery Date</Text>
        <Text style={styles.detailValue}>
          {new Date(orderData.deliveryDate).toLocaleDateString()}
        </Text>
      </View>
      {orderData.deliveryTime && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Delivery Time</Text>
          <Text style={styles.detailValue}>{orderData.deliveryTime}</Text>
        </View>
      )}
    </View>
    {orderData.notes && (
      <View style={styles.notesContainer}>
        <Text style={styles.notesLabel}>Notes:</Text>
        <Text style={styles.notesText}>{orderData.notes}</Text>
      </View>
    )}
  </View>
) : (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Order Details Missing</Text>
    <Text style={styles.errorText}>Please complete order details before proceeding.</Text>
  </View>
)}

       {/* Items Section */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Items ({items.length})</Text>
  {items.map((item, index) => (
    <View key={index} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.product_name}</Text>
          {item.is_tobacco && (
            <View style={styles.tobaccoBadge}>
              <Text style={styles.tobaccoText}>Tobacco</Text>
            </View>
          )}
          <Text style={styles.itemSku}>SKU: {item.sku}</Text>
          
        </View>
      
        <View style={styles.itemQuantity}>
          <Text style={styles.quantityText}>
            {/* UPDATE THIS: Show quantity with proper unit */}
            {item.quantity} {item.unit || 'Item'}(s)
          </Text>
          
          {/* ADD THIS: Show total items for Cases and Pallets */}
          {(item.unit === 'Case' || item.unit === 'Pallet') && (
            <Text style={styles.totalItemsText}>
              = {item.unit === 'Case' ? item.quantity * 30 : item.quantity * 100} total items
            </Text>
          )}
          
          <Text style={[
            styles.stockStatus,
            { color: getStatusColor(item.available_quantity, item.quantity) }
          ]}>
            {getStatusText(item.available_quantity, item.quantity)}
          </Text>
        </View>
      </View>
      
      <View style={styles.itemPricing}>
        <Text style={styles.unitPrice}>
          {/* UPDATE THIS: Show price per correct unit */}
          ${item.unit_price.toFixed(2)} per {item.unit || 'Item'}
        </Text>
        <Text style={styles.lineTotal}>${item.total_price.toFixed(2)}</Text>
      </View>
    </View>
  ))}
</View>

        {/* Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>${orderSummary.subtotal.toFixed(2)}</Text>
            </View>
            {orderSummary.shipping > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={styles.summaryValue}>${orderSummary.shipping.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax (10%)</Text>
              <Text style={styles.summaryValue}>${orderSummary.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${orderSummary.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.back()}
        >
          <Text style={styles.editButtonText}>Edit Items</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmitOrder}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>
                {flowType === 'proposal' ? 'Create Proposal' : 'Place Order'}
              </Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#27AE60" />
            </View>
            <Text style={styles.successTitle}>
              {flowType === 'proposal' ? 'Proposal Created!' : 'Order Placed!'}
            </Text>
            <Text style={styles.successMessage}>
              {flowType === 'proposal' 
                ? `Proposal ${orderNumber} has been created successfully.`
                : `Order ${orderNumber} has been confirmed and inventory has been reserved.`}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleGenerateDocument}
              >
                <Ionicons 
                  name={flowType === 'proposal' ? 'document-text' : 'receipt'} 
                  size={20} 
                  color="#E74C3C" 
                />
                <Text style={styles.modalButtonText}>
                  {flowType === 'proposal' ? 'Generate Proposal' : 'Generate Invoice'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleDone}
              >
                <Text style={styles.modalButtonTextPrimary}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invoice Generator */}
      {showInvoiceGenerator && createdOrderId && (
        <InvoiceGenerator
          orderId={createdOrderId}
          customer={customer!}
          items={items}
          orderSummary={orderSummary}
          orderData={orderData!}
          onClose={handleDone}
        />
      )}

      {/* Proposal Generator */}
      {showProposalGenerator && createdOrderId && (
        <ProposalGenerator
          customer={customer!}
          items={items}
          orderSummary={orderSummary}
          orderData={orderData!}
          onClose={handleDone}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000ff',
  },
  unitBadge: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  unitText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  totalItemsText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
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
  scrollView: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    marginLeft: 10,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
  },
  infoName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3498DB',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    minWidth: '45%',
  },
  detailLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  notesContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  itemCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  tobaccoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE0E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  tobaccoText: {
    fontSize: 10,
    color: '#E74C3C',
    fontWeight: '600',
  },
  itemSku: {
    fontSize: 12,
    color: '#999',
  },
  itemQuantity: {
    alignItems: 'flex-end',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stockStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  unitPrice: {
    fontSize: 13,
    color: '#666',
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E74C3C',
  },
  summaryCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
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
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E74C3C',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 25,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
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
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: {
    width: '100%',
    gap: 12,
  },
  errorText: {
  fontSize: 14,
  color: '#E74C3C',
  textAlign: 'center',
  padding: 20,
},
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E74C3C',
    gap: 8,
  },
  modalButtonPrimary: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E74C3C',
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});