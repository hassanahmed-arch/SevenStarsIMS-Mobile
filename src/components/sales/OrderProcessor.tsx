// src/components/sales/OrderProcessor.tsx


//IMP notes: why do we match the products using Sku and what if i changed the sku 
//to something easier for the sales agent?

//why do i need to write the unti first before the product name like why isnt 
//the product name enough?

// we need to create something called scheduling matching meaning that after we
// send the order to the warehouse manager i want to suggest warehouse operators
//to pick from based on who has the least amount of orders and maybe other parameters
//for more advanced matching


import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import InvoiceGenerator from './InvoiceGenerator';

interface OrderProcessorProps {
  orderData: {
    naturalLanguageOrder: string;
    customerId: string;
    deliveryDate: Date;
    deliveryTime: Date;
    paymentType: string;
  };
  customerId: string;
  salesAgentId: string;
  onClose: () => void;
}

interface ProcessedItem {
  original_text: string;
  matched_product?: any;
  product_name: string;
  product_id?: string;
  sku?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  confidence: 'high' | 'medium' | 'low' | 'no_match';
  in_stock: boolean;
  current_stock?: number;
  stock_status?: string;
}

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

interface Product {
  id: string;
  product_id: string;
  product_name: string;
  sku?: string;
  barcode?: string;
  price: number;
  quantity: number;
  unit: string;
  is_active?: boolean;
}

// Text similarity calculation (from openai2.ts)
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/)
  const words2 = text2.toLowerCase().split(/\s+/)

  const commonWords = words1.filter(word => words2.includes(word))
  const totalWords = new Set([...words1, ...words2]).size

  return commonWords.length / totalWords
}

// Find inventory matches using semantic search (adapted from openai2.ts)
async function findInventoryMatches(extractedProduct: string, limit = 10) {
  try {
    // First, try exact matches in product_name and sku (adapted from openai2.ts)
    const { data: exactMatches, error: exactError } = await supabase
      .from('products')
      .select('id, product_id, product_name, sku, category, quantity, price, unit')
      .or(`product_name.ilike.%${extractedProduct}%,sku.ilike.%${extractedProduct}%`)
      .eq('is_active', true)
      .limit(limit)

    if (exactError) {
      console.error('Error in exact search:', exactError)
    }

    // If we have exact matches, return them
    if (exactMatches && exactMatches.length > 0) {
      return exactMatches.map(item => ({
        ...item,
        similarity: calculateSimilarity(extractedProduct, item.product_name),
        matchType: 'exact'
      })).sort((a, b) => b.similarity - a.similarity)
    }

    // If no exact matches, do a broader search and use similarity scoring
    const { data: allItems, error: allError } = await supabase
      .from('products')
      .select('id, product_id, product_name, sku, category, quantity, price, unit')
      .eq('is_active', true)
      .limit(500) // Get a larger sample for similarity matching

    if (allError || !allItems) {
      console.error('Error in broad search:', allError)
      return []
    }

    // Calculate similarity scores for all items
    const scoredItems = allItems.map(item => ({
      ...item,
      similarity: Math.max(
        calculateSimilarity(extractedProduct, item.product_name),
        calculateSimilarity(extractedProduct, item.sku || ''),
        calculateSimilarity(extractedProduct, item.category || '')
      ),
      matchType: 'similarity'
    }))

    // Return top matches with similarity > 0.1
    return scoredItems
      .filter(item => item.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

  } catch (error) {
    console.error('Error finding inventory matches:', error)
    return []
  }
}

export default function OrderProcessor({ orderData, customerId, salesAgentId, onClose }: OrderProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(true);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    tax: 0,
    total: 0,
    allInStock: true,
  });
  const [showInvoice, setShowInvoice] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<{ [key: number]: ProcessedItem }>({});
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  // Manual item addition states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  useEffect(() => {
    processOrder();
    fetchCustomer();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = products.filter(p =>
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [searchQuery, products]);

  const fetchCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      setCustomer(data);
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('product_name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addProductManually = (product: Product) => {
    const newItem: ProcessedItem = {
      original_text: 'Manual Entry',
      product_name: product.product_name,
      product_id: product.id,
      sku: product.sku,
      quantity: 1,
      unit: product.unit,
      unit_price: product.price,
      total_price: product.price,
      confidence: 'high',
      in_stock: product.quantity > 0,
      current_stock: product.quantity,
      stock_status: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
    };

    setProcessedItems([...processedItems, newItem]);

    // Recalculate totals
    const updatedItems = [...processedItems, newItem];
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total_price, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    const allInStock = updatedItems.every(item => item.in_stock);

    setOrderSummary({ subtotal, tax, total, allInStock });
    setSearchQuery('');
    setShowAddItemModal(false);
  };

  const processOrder = async () => {
    setIsProcessing(true);

    try {
      // Step 1: Process with AI (using OpenAI or similar)
      const aiProcessedItems = await processWithAI(orderData.naturalLanguageOrder);

      // Step 2: Match with inventory and check stock
      const matchedItems = await matchWithInventory(aiProcessedItems);

      // Step 3: Calculate totals
      const subtotal = matchedItems.reduce((sum, item) => sum + item.total_price, 0);
      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;
      const allInStock = matchedItems.every(item => item.in_stock);

      setProcessedItems(matchedItems);
      setOrderSummary({ subtotal, tax, total, allInStock });
    } catch (error) {
      console.error('Error processing order:', error);
      Alert.alert('Error', 'Failed to process order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processWithAI = async (naturalLanguageOrder: string): Promise<ProcessedItem[]> => {
    try {
      // Use the existing OpenAI service with sophisticated parsing
      const { processOrderWithAI } = await import('../../services/openai');
      const parsedItems = await processOrderWithAI(naturalLanguageOrder);

      // Convert to ProcessedItem format
      const items: ProcessedItem[] = parsedItems.map((item) => ({
        original_text: item.original_text || item.product_name,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.price || 0,
        total_price: (item.price || 0) * item.quantity,
        confidence: item.confidence,
        in_stock: false,
      }));

      return items;
    } catch (error) {
      console.error('Error calling OpenAI service:', error);

      // Fallback to enhanced basic parsing if AI service fails
      return processWithBasicParser(naturalLanguageOrder);
    }
  };

  const processWithBasicParser = (naturalLanguageOrder: string): ProcessedItem[] => {
    const items: ProcessedItem[] = [];

    // Enhanced parsing to handle "and" separators and multiple products
    const text = naturalLanguageOrder.toLowerCase();

    // Split by "and" first, then by commas as fallback
    let segments = text.split(' and ');
    if (segments.length === 1) {
      segments = text.split(',');
    }

    for (const segment of segments) {
      const trimmedSegment = segment.trim();
      if (!trimmedSegment) continue;

      // Extract quantity
      const quantityMatch = trimmedSegment.match(/(\d+)\s*(cases?|boxes?|packs?|pieces?|cartons?|bottles?)/i);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      const unit = quantityMatch ? quantityMatch[2].replace(/s$/, '') : 'piece';

      // Extract price if mentioned
      const priceMatch = trimmedSegment.match(/\$?\s*(\d+(?:\.\d{2})?)\s*(?:each|per|\/)?/i);
      const unitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

      // Extract product name (remove quantity and price parts)
      let productName = trimmedSegment
        .replace(/^\d+\s*(cases?|boxes?|packs?|pieces?|cartons?|bottles?)\s*(?:of\s*)?/i, '')
        .replace(/\$?\s*\d+(?:\.\d{2})?\s*(?:each|per|\/)?/i, '')
        .replace(/^\s*of\s*/i, '')
        .trim();

      if (productName) {
        items.push({
          original_text: segment.trim(),
          product_name: productName,
          quantity,
          unit,
          unit_price: unitPrice,
          total_price: quantity * unitPrice,
          confidence: 'medium',
          in_stock: false,
        });
      }
    }

    return items;
  };

  const matchWithInventory = async (aiItems: ProcessedItem[]): Promise<ProcessedItem[]> => {
    const processedItems: ProcessedItem[] = [];

    for (const extractedItem of aiItems) {
      // Find potential matches using openai2.ts logic
      const candidates = await findInventoryMatches(extractedItem.product_name, 10);

      let confidence: 'high' | 'medium' | 'low' | 'no_match' = 'no_match';
      let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'not_found' = 'not_found';
      let finalPrice = 0;
      let bestMatch = null;

      if (candidates.length > 0) {
        // Take the best match (highest similarity)
        bestMatch = candidates[0];

        // Determine confidence based on similarity score (from openai2.ts)
        if (bestMatch.similarity > 0.7) {
          confidence = 'high';
        } else if (bestMatch.similarity > 0.4) {
          confidence = 'medium';
        } else {
          confidence = 'low';
        }

        // Determine stock status
        const stock = Number(bestMatch.quantity || 0);
        if (stock === 0) {
          stockStatus = 'out_of_stock';
        } else if (stock < extractedItem.quantity) {
          stockStatus = 'low_stock';
        } else {
          stockStatus = 'in_stock';
        }

        // Use inventory price (from openai2.ts logic)
        if (bestMatch.price) {
          finalPrice = Number(bestMatch.price);
        }
      }

      if (bestMatch) {
        processedItems.push({
          original_text: extractedItem.original_text,
          matched_product: bestMatch,
          product_id: bestMatch.id,
          product_name: bestMatch.product_name,
          sku: bestMatch.sku,
          quantity: extractedItem.quantity,
          unit: extractedItem.unit,
          unit_price: finalPrice,
          total_price: extractedItem.quantity * finalPrice,
          confidence,
          in_stock: stockStatus === 'in_stock',
          current_stock: bestMatch.quantity,
          stock_status: stockStatus,
        });
      } else {
        // No match found
        processedItems.push({
          original_text: extractedItem.original_text,
          product_name: extractedItem.product_name,
          quantity: extractedItem.quantity,
          unit: extractedItem.unit,
          unit_price: 0,
          total_price: 0,
          confidence: 'no_match',
          in_stock: false,
          stock_status: 'not_found',
        });
      }
    }

    return processedItems;
  };

  // Rest of the component methods remain the same...
  const handleItemEdit = (index: number, field: string, value: any) => {
    const updatedItem = { ...processedItems[index], [field]: value };

    // Recalculate total if quantity or price changed
    if (field === 'quantity' || field === 'unit_price') {
      updatedItem.total_price = updatedItem.quantity * updatedItem.unit_price;
    }

    // Recalculate stock status if quantity changed
    if (field === 'quantity' && updatedItem.current_stock !== undefined) {
      const requestedQty = parseInt(value) || 0;
      const availableStock = updatedItem.current_stock;

      updatedItem.in_stock = availableStock >= requestedQty;

      if (availableStock === 0) {
        updatedItem.stock_status = 'out_of_stock';
      } else if (availableStock < requestedQty) {
        updatedItem.stock_status = 'low_stock';
      } else {
        updatedItem.stock_status = 'in_stock';
      }
    }

    setEditingItems({ ...editingItems, [index]: updatedItem });
  };

  // Save, remove item, and all other methods remain exactly the same as in the original file...
  const saveItemEdit = (index: number) => {
    const updatedItems = [...processedItems];
    updatedItems[index] = editingItems[index] || processedItems[index];
    setProcessedItems(updatedItems);

    // Recalculate totals and stock status
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total_price, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    const allInStock = updatedItems.every(item => item.in_stock);

    setOrderSummary({ subtotal, tax, total, allInStock });
    delete editingItems[index];
    setEditingItems({ ...editingItems });
  };

  const removeItem = (index: number) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedItems = processedItems.filter((_, i) => i !== index);
            setProcessedItems(updatedItems);

            // Recalculate totals
            const subtotal = updatedItems.reduce((sum, item) => sum + item.total_price, 0);
            const tax = subtotal * 0.1;
            const total = subtotal + tax;

            setOrderSummary({ ...orderSummary, subtotal, tax, total });
          }
        }
      ]
    );
  };

  const handleSubmitOrder = async () => {
    if (!orderSummary.allInStock) {
      Alert.alert(
        'Stock Warning',
        'Some items are out of stock. Do you want to proceed with available items?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: () => saveOrder() }
        ]
      );
    } else {
      saveOrder();
    }
  };

  const saveOrder = async () => {
    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;
      
      // Determine priority level based on delivery date and order value
      const deliveryDate = new Date(orderData.deliveryDate);
      const daysDiff = Math.ceil((deliveryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const priorityLevel = daysDiff <= 1 ? 9 : daysDiff <= 3 ? 7 : orderSummary.total > 1000 ? 6 : 5;

      // Save order to database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId,
          sales_agent_id: salesAgentId,
          natural_language_order: orderData.naturalLanguageOrder,
          delivery_date: orderData.deliveryDate.toISOString().split('T')[0],
          delivery_time: orderData.deliveryTime.toTimeString().split(' ')[0],
          payment_type: orderData.paymentType,
          status: 'confirmed',
          subtotal: orderSummary.subtotal,
          tax_amount: orderSummary.tax,
          total_amount: orderSummary.total,
          priority_level: priorityLevel,
          warehouse_status: 'pending_assignment'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Save order items
      const orderItems = processedItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        original_text: item.original_text,
        confidence_level: item.confidence,
        match_status: item.confidence === 'no_match' ? 'not_found' : 'matched',
        stock_available: item.current_stock,
        stock_status: item.stock_status,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;
      
      // Get warehouse operator suggestion
      try {
        const { suggestWarehouseOperator, createOrderAssignment } = await import('../../services/warehouseOperatorSuggestion');
        const suggestion = await suggestWarehouseOperator(processedItems, deliveryDate, priorityLevel);
        
        if (suggestion) {
          // Create order assignment with AI suggestion
          await createOrderAssignment(order.id, suggestion);
          console.log(`Order ${order.order_number} assigned suggested operator: ${suggestion.suggested_operator.operator_name} (${suggestion.suggestion_confidence}% confidence)`);
        } else {
          console.log(`No warehouse operator suggestion available for order ${order.order_number}`);
        }
      } catch (suggestionError) {
        console.error('Error creating warehouse operator suggestion:', suggestionError);
        // Don't fail the order if suggestion fails
      }

      // Update product quantities for in-stock items
      for (const item of processedItems) {
        if (item.product_id && item.in_stock) {
          const newQuantity = (item.current_stock || 0) - item.quantity;
          await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', item.product_id);
        }
      }

      setSavedOrderId(order.id);
      setShowInvoice(true);

    } catch (error) {
      console.error('Error saving order:', error);
      Alert.alert('Error', 'Failed to save order. Please try again.');
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'checkmark-circle';
      case 'medium': return 'alert-circle';
      case 'low': return 'warning';
      case 'no_match': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return '#27AE60';
      case 'medium': return '#F39C12';
      case 'low': return '#E74C3C';
      case 'no_match': return '#E74C3C';
      default: return '#666';
    }
  };

  const getStockIcon = (status: string) => {
    switch (status) {
      case 'in_stock': return 'checkmark-circle';
      case 'out_of_stock': return 'close-circle';
      case 'not_found': return 'help-circle-outline';
      default: return 'remove-circle-outline';
    }
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'in_stock': return '#27AE60';
      case 'out_of_stock': return '#E74C3C';
      case 'not_found': return '#999';
      default: return '#666';
    }
  };

  if (isProcessing) {
    return (
      <Modal visible animationType="fade" transparent>
        <View style={styles.processingContainer}>
          <View style={styles.processingCard}>
            <View style={styles.processingAnimation}>
              <ActivityIndicator size="large" color="#E74C3C" />
              <View style={styles.processingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
            <Text style={styles.processingTitle}>Processing Order with AI</Text>
            <Text style={styles.processingSubtext}>Matching products and checking inventory...</Text>
            <View style={styles.processingSteps}>
              <View style={styles.processingStep}>
                <Ionicons name="sparkles" size={16} color="#E74C3C" />
                <Text style={styles.processingStepText}>Analyzing order text</Text>
              </View>
              <View style={styles.processingStep}>
                <Ionicons name="search" size={16} color="#E74C3C" />
                <Text style={styles.processingStepText}>Matching products</Text>
              </View>
              <View style={styles.processingStep}>
                <Ionicons name="cube-outline" size={16} color="#E74C3C" />
                <Text style={styles.processingStepText}>Checking inventory</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (showInvoice && savedOrderId) {
    return (
      <InvoiceGenerator
        orderId={savedOrderId}
        customer={customer}
        items={processedItems}
        orderSummary={orderSummary}
        orderData={orderData}
        onClose={onClose}
      />
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
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Review Order</Text>
            <Text style={styles.headerSubtitle}>AI-Processed Results</Text>
          </View>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="help-circle-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Customer Info Card */}
          {customer && (
            <View style={styles.customerCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="person-circle" size={24} color="#333" />
                  <Text style={styles.cardTitle}>Customer Information</Text>
                </View>
              </View>
              <View style={styles.customerContent}>
                <View style={styles.customerInfoRow}>
                  <View style={styles.customerInfoLeft}>
                    <Text style={styles.customerInfoLabel}>Name:</Text>
                    <Text style={styles.customerInfoValue}>{customer.name}</Text>
                    <Text style={styles.customerInfoLabel}>Email:</Text>
                    <Text style={styles.customerInfoValue}>{customer.email}</Text>
                    <Text style={styles.customerInfoLabel}>Phone:</Text>
                    <Text style={styles.customerInfoValue}>{customer.phone}</Text>
                  </View>
                  <View style={styles.customerInfoRight}>
                    <Text style={styles.customerInfoLabel}>Address:</Text>
                    <Text style={styles.customerInfoValue}>{customer.address}</Text>
                    <Text style={styles.customerInfoValue}>{customer.city}, {customer.state} {customer.zip_code}</Text>
                  </View>
                </View>
                <View style={styles.outstandingBalance}>
                  <Text style={styles.balanceLabel}>Outstanding Balance:</Text>
                  <Text style={styles.balanceValue}>$0.00</Text>
                </View>
              </View>
            </View>
          )}

          {/* Delivery Info Card */}
          <View style={styles.deliveryCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="calendar" size={24} color="#E74C3C" />
                <Text style={styles.cardTitle}>Delivery Information</Text>
              </View>
            </View>
            <View style={styles.deliveryContent}>
              <View style={styles.deliveryRow}>
                <View style={styles.deliveryItem}>
                  <Text style={styles.deliveryLabel}>Date</Text>
                  <Text style={styles.deliveryValue}>
                    {orderData.deliveryDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                <View style={styles.deliveryItem}>
                  <Text style={styles.deliveryLabel}>Time</Text>
                  <Text style={styles.deliveryValue}>
                    {orderData.deliveryTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.deliveryRow}>
                <View style={styles.deliveryItem}>
                  <Text style={styles.deliveryLabel}>Payment Method</Text>
                  <Text style={styles.deliveryValue}>
                    {orderData.paymentType.charAt(0).toUpperCase() + orderData.paymentType.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* AI-Processed Order */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={styles.itemsTitle}>AI-Processed Order</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddItemModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#E74C3C" />
                <Text style={styles.addButtonText}>Add Manual Item</Text>
              </TouchableOpacity>
            </View>

            {/* Matching Summary */}
            <View style={styles.matchingSummary}>
              <Text style={styles.matchingSummaryTitle}>Matching Summary</Text>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.summaryStatLabel}>Total Items:</Text>
                  <Text style={styles.summaryStatValue}>{processedItems.length}</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatLabel, { color: '#27AE60' }]}>High Confidence:</Text>
                  <Text style={[styles.summaryStatValue, { color: '#27AE60' }]}>
                    {processedItems.filter(i => i.confidence === 'high').length}
                  </Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatLabel, { color: '#F39C12' }]}>Medium Confidence:</Text>
                  <Text style={[styles.summaryStatValue, { color: '#F39C12' }]}>
                    {processedItems.filter(i => i.confidence === 'medium').length}
                  </Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatLabel, { color: '#E74C3C' }]}>Low Confidence:</Text>
                  <Text style={[styles.summaryStatValue, { color: '#E74C3C' }]}>
                    {processedItems.filter(i => i.confidence === 'low').length}
                  </Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatLabel, { color: '#E74C3C' }]}>No Match:</Text>
                  <Text style={[styles.summaryStatValue, { color: '#E74C3C' }]}>
                    {processedItems.filter(i => i.confidence === 'no_match').length}
                  </Text>
                </View>
              </View>
            </View>

            {processedItems.map((item, index) => {
              const isEditing = editingItems[index];
              const currentItem = isEditing || item;

              return (
                <View key={index} style={styles.itemCard}>
                  {/* Item Header with Confidence and Stock Status */}
                  <TouchableOpacity
                    style={styles.itemHeader}
                    onPress={() => setExpandedItem(expandedItem === index ? null : index)}
                  >
                    <View style={styles.itemHeaderLeft}>
                      <View style={[styles.confidenceBadge, { backgroundColor: `${getConfidenceColor(item.confidence)}15` }]}>
                        <Ionicons
                          name={getConfidenceIcon(item.confidence)}
                          size={16}
                          color={getConfidenceColor(item.confidence)}
                        />
                        <Text style={[styles.confidenceText, { color: getConfidenceColor(item.confidence) }]}>
                          {item.confidence === 'high' ? 'Matched' :
                            item.confidence === 'medium' ? 'Partial' :
                              item.confidence === 'no_match' ? 'Not Found' : 'Low Match'}
                        </Text>
                      </View>
                      <View style={[styles.stockBadge, { backgroundColor: `${getStockColor(item.stock_status || '')}15` }]}>
                        <Ionicons
                          name={getStockIcon(item.stock_status || '')}
                          size={16}
                          color={getStockColor(item.stock_status || '')}
                        />
                        <Text style={[styles.stockText, { color: getStockColor(item.stock_status || '') }]}>
                          {item.stock_status === 'in_stock' ? 'In Stock' :
                            item.stock_status === 'out_of_stock' ? 'Out of Stock' : 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={expandedItem === index ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>

                  {/* Main Item Content */}
                  <View style={styles.itemContent}>
                    <View style={styles.itemMainInfo}>
                      <Text style={styles.itemProductName}>{currentItem.product_name}</Text>
                      {item.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
                      <Text style={styles.itemOriginal}>"{item.original_text}"</Text>
                    </View>

                    <View style={styles.itemQuantityPrice}>
                      {isEditing ? (
                        <>
                          <View style={styles.editingFields}>
                            <TextInput
                              style={styles.editInput}
                              value={String(currentItem.quantity)}
                              onChangeText={(text) => handleItemEdit(index, 'quantity', parseInt(text) || 0)}
                              keyboardType="numeric"
                              placeholder="Qty"
                            />
                            <Text style={styles.unitText}>{currentItem.unit}</Text>
                            <Text style={styles.atText}>@</Text>
                            <TextInput
                              style={styles.editInput}
                              value={String(currentItem.unit_price)}
                              onChangeText={(text) => handleItemEdit(index, 'unit_price', parseFloat(text) || 0)}
                              keyboardType="decimal-pad"
                              placeholder="Price"
                            />
                          </View>

                          {currentItem.current_stock !== undefined && (
                            <View style={styles.stockWarning}>
                              {currentItem.current_stock === 0 ? (
                                <Text style={styles.stockWarningTextDanger}>
                                  ⚠️ This item is out of stock
                                </Text>
                              ) : currentItem.quantity > currentItem.current_stock ? (
                                <Text style={styles.stockWarningTextWarning}>
                                  ⚠️ Only {currentItem.current_stock} available in stock
                                </Text>
                              ) : (
                                <Text style={styles.stockWarningTextSuccess}>
                                  ✅ {currentItem.current_stock} available in stock
                                </Text>
                              )}
                            </View>
                          )}
                        </>
                      ) : (
                        <View style={styles.quantityPriceRow}>
                          <Text style={styles.quantityText}>
                            {currentItem.quantity} {currentItem.unit}
                          </Text>
                          <Text style={styles.priceText}>
                            @ ${currentItem.unit_price.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.itemTotal}>${currentItem.total_price.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Expanded Details */}
                  {expandedItem === index && (
                    <View style={styles.itemExpanded}>
                      {item.current_stock !== undefined && (
                        <View style={styles.expandedRow}>
                          <Text style={styles.expandedLabel}>Current Stock:</Text>
                          <Text style={styles.expandedValue}>{item.current_stock} units</Text>
                        </View>
                      )}
                      <View style={styles.itemActions}>
                        {isEditing ? (
                          <>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.saveButton]}
                              onPress={() => saveItemEdit(index)}
                            >
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                              <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.cancelButton]}
                              onPress={() => {
                                delete editingItems[index];
                                setEditingItems({ ...editingItems });
                              }}
                            >
                              <Ionicons name="close" size={16} color="#666" />
                              <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.editButton]}
                              onPress={() => setEditingItems({ ...editingItems, [index]: item })}
                            >
                              <Ionicons name="create-outline" size={16} color="#E74C3C" />
                              <Text style={styles.editButtonText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.deleteButton]}
                              onPress={() => removeItem(index)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                              <Text style={styles.deleteButtonText}>Remove</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${orderSummary.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax (10%)</Text>
                <Text style={styles.summaryValue}>${orderSummary.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>${orderSummary.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Stock Warning */}
          {!orderSummary.allInStock && (
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color="#F39C12" />
              <Text style={styles.warningText}>
                Some items are out of stock. You can proceed with available items only.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              !orderSummary.allInStock && styles.primaryButtonDisabled
            ]}
            onPress={orderSummary.allInStock ? handleSubmitOrder : undefined}
            disabled={!orderSummary.allInStock}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={orderSummary.allInStock ? "#FFFFFF" : "#CCCCCC"}
            />
            <Text style={[
              styles.primaryButtonText,
              !orderSummary.allInStock && styles.primaryButtonTextDisabled
            ]}>
              Submit Sales Order
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItemModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.addItemModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product to Order</Text>
              <TouchableOpacity onPress={() => {
                setShowAddItemModal(false);
                setSearchQuery('');
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Product Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by product name, SKU, or barcode..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            <ScrollView style={styles.searchResults}>
              {searchQuery.length > 0 ? (
                filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.productItem}
                      onPress={() => addProductManually(product)}
                    >
                      <View style={styles.productItemInfo}>
                        <Text style={styles.productItemName}>{product.product_name}</Text>
                        <View style={styles.productItemMeta}>
                          <Text style={styles.productItemSku}>SKU: {product.sku || 'N/A'}</Text>
                          <Text style={styles.productItemStock}>
                            Stock: {product.quantity} {product.unit}
                          </Text>
                          <Text style={styles.productItemPrice}>${product.price.toFixed(2)}</Text>
                        </View>
                      </View>
                      <View style={styles.productItemAction}>
                        <Ionicons name="add-circle" size={28} color="#E74C3C" />
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noResults}>
                    <Ionicons name="search-outline" size={48} color="#DDD" />
                    <Text style={styles.noResultsText}>No products found</Text>
                    <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                  </View>
                )
              ) : (
                <View style={styles.searchPrompt}>
                  <Ionicons name="cube-outline" size={48} color="#DDD" />
                  <Text style={styles.searchPromptText}>Start typing to search products</Text>
                  <Text style={styles.searchPromptSubtext}>Search by name, SKU, or barcode</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // All the same styles from the original file...
  processingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  processingAnimation: {
    marginBottom: 20,
    alignItems: 'center',
  },
  processingDots: {
    flexDirection: 'row',
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E74C3C',
    marginHorizontal: 4,
    opacity: 0.3,
  },
  dot1: {
    opacity: 1,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.3,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  processingSteps: {
    width: '100%',
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  processingStepText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
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
    padding: 5,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  customerContent: {
    padding: 15,
  },
  customerInfoRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  customerInfoLeft: {
    flex: 1,
    marginRight: 20,
  },
  customerInfoRight: {
    flex: 1,
  },
  customerInfoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 2,
  },
  customerInfoValue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  outstandingBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 16,
    color: '#27AE60',
    fontWeight: '600',
  },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveryContent: {
    paddingLeft: 32,
  },
  deliveryRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  deliveryItem: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  deliveryValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  itemsSection: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  matchingSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  matchingSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  summaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  summaryStatLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  summaryStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  itemContent: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 15,
  },
  itemProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  itemOriginal: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  itemQuantityPrice: {
    alignItems: 'flex-end',
  },
  quantityPriceRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  quantityText: {
    fontSize: 14,
    color: '#666',
  },
  priceText: {
    fontSize: 14,
    color: '#666',
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  editingFields: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    minWidth: 50,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  atText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  itemExpanded: {
    padding: 15,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  expandedLabel: {
    fontSize: 14,
    color: '#666',
  },
  expandedValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: '#FFF0F0',
    borderColor: '#E74C3C',
  },
  editButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#E74C3C',
  },
  deleteButtonText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
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
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 15,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F39C12',
    marginLeft: 10,
    lineHeight: 20,
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
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  primaryButtonTextDisabled: {
    color: '#999999',
  },
  stockWarning: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  stockWarningTextDanger: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '500',
  },
  stockWarningTextWarning: {
    fontSize: 12,
    color: '#F39C12',
    fontWeight: '500',
  },
  stockWarningTextSuccess: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '500',
  },

  // Add Item Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  addItemModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    margin: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#333',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  productItemInfo: {
    flex: 1,
  },
  productItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  productItemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  productItemSku: {
    fontSize: 13,
    color: '#666',
  },
  productItemStock: {
    fontSize: 13,
    color: '#666',
  },
  productItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
  },
  productItemAction: {
    justifyContent: 'center',
    marginLeft: 10,
  },
  noResults: {
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 20,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
  },
  searchPrompt: {
    alignItems: 'center',
    paddingTop: 60,
  },
  searchPromptText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 20,
  },
  searchPromptSubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
  },
});