// Fixed OrderSummary.tsx - Add proper null checking
// Add this validation at the beginning of your OrderSummary component

const OrderSummary = ({ orderForm, customer, onConfirm, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CRITICAL: Add null checking at the very beginning
  const validateOrderData = () => {
    if (!orderForm) {
      Alert.alert('Error', 'Order data is missing');
      return false;
    }

    if (!customer) {
      Alert.alert('Error', 'Customer information is missing');
      return false;
    }

    if (!orderForm.deliveryDate) {
      Alert.alert('Error', 'Delivery date is required');
      return false;
    }

    if (!orderForm.items || orderForm.items.length === 0) {
      Alert.alert('Error', 'Please add items to your order');
      return false;
    }

    return true;
  };

  const handleSaveOrder = async () => {
    // Validate data before proceeding
    if (!validateOrderData()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Safely parse the delivery date
      let deliveryDate: string;
      try {
        if (typeof orderForm.deliveryDate === 'string') {
          deliveryDate = orderForm.deliveryDate;
        } else if (orderForm.deliveryDate instanceof Date) {
          deliveryDate = orderForm.deliveryDate.toISOString().split('T')[0];
        } else {
          throw new Error('Invalid delivery date format');
        }
      } catch (dateError) {
        console.error('Date parsing error:', dateError);
        Alert.alert('Error', 'Invalid delivery date format. Please check the date.');
        return;
      }

      // Safely handle delivery time
      let deliveryTime: string | null = null;
      if (orderForm.deliveryTime) {
        try {
          if (typeof orderForm.deliveryTime === 'string') {
            deliveryTime = orderForm.deliveryTime;
          } else if (orderForm.deliveryTime instanceof Date) {
            deliveryTime = orderForm.deliveryTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
          }
        } catch (timeError) {
          console.error('Time parsing error:', timeError);
          // Don't fail on time error, just set to null
          deliveryTime = null;
        }
      }

      const orderPayload = {
        order_number: orderForm.orderNumber || `ORD-${Date.now()}`,
        customer_id: customer.id,
        sales_agent_id: user.id,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        payment_type: orderForm.paymentType || 'cash',
        order_type: orderForm.orderType || 'delivery',
        status: 'pending',
        subtotal: Number(orderForm.subtotal) || 0,
        tax_amount: Number(orderForm.taxAmount) || 0,
        total_amount: Number(orderForm.totalAmount) || 0,
        po_number: orderForm.poNumber || null,
        notes: orderForm.notes || null,
        special_handling_notes: orderForm.specialHandlingNotes || null,
      };

      console.log('Order payload:', orderPayload);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        throw orderError;
      }

      console.log('Order created successfully:', order.id);

      // Create order items with validation
      const orderItems = orderForm.items.map(item => {
        // Validate each item has required fields
        if (!item.product_id || !item.quantity) {
          throw new Error(`Invalid item data for ${item.product_name || 'unknown item'}`);
        }

        return {
          order_id: order.id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit: item.unit || 'piece',
          unit_price: Number(item.unit_price) || 0,
          total_price: Number(item.total_price) || 0,
          stock_available: Number(item.available_quantity) || 0,
          stock_status: (item.available_quantity || 0) > 0 ? 'in_stock' : 'out_of_stock',
        };
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
      
      // Provide specific error messages
      if (error?.message?.includes('delivery_date')) {
        Alert.alert('Error', 'Invalid delivery date format. Please try again.');
      } else if (error?.message?.includes('Invalid item data')) {
        Alert.alert('Error', error.message);
      } else if (error?.code === '23503') {
        Alert.alert('Error', 'Invalid reference data. Please refresh and try again.');
      } else {
        Alert.alert('Error', `Failed to save order: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Early return if validation fails
  if (!validateOrderData()) {
    return (
      <Modal visible animationType="slide" transparent={false}>
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Order data is incomplete</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Rest of your component JSX...
  return (
    <Modal visible animationType="slide" transparent={false}>
      {/* Your existing JSX */}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default OrderSummary;