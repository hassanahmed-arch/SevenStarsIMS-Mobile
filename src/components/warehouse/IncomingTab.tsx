// src/components/warehouse/IncomingTab.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import CameraScanner from './CameraScanner';

interface Product {
  id: string;
  product_id: string;
  product_name: string;
  barcode?: string;
  quantity: number;
  unit: string;
  price: number;
  category?: string;
}

interface ScannedItem {
  id: string;
  barcode: string;
  product?: Product;
  quantity: number;
  timestamp: Date;
  status: 'pending' | 'found' | 'not_found' | 'added';
}

function IncomingTab() {
  const [barcode, setBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScannedItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New product form states
  const [newProduct, setNewProduct] = useState({
    product_id: '',
    product_name: '',
    barcode: '',
    quantity: '',
    unit: 'piece',
    price: '',
    category: '',
  });

  // Stats
  const [stats, setStats] = useState({
    totalScanned: 0,
    totalAdded: 0,
    newProducts: 0,
  });

  useEffect(() => {
    updateStats();
  }, [scannedItems]);

  const updateStats = () => {
    const totalScanned = scannedItems.length;
    const totalAdded = scannedItems.filter(item => item.status === 'added').length;
    const newProducts = scannedItems.filter(item => item.status === 'not_found').length;
    
    setStats({ totalScanned, totalAdded, newProducts });
  };

  const handleBarcodeScan = (barcode: string) => {
    setBarcode(barcode);
    setShowScannerModal(false);
    
    // Process the scanned barcode
    setTimeout(() => {
      handleBarcodeSubmit(barcode);
    }, 500);
  };

  const openScanner = () => {
    setShowScannerModal(true);
  };

  const handleBarcodeSubmit = async (barcodeValue?: string) => {
    const codeToProcess = barcodeValue || barcode.trim();
    
    if (!codeToProcess) {
      Alert.alert('Error', 'Please enter or scan a barcode');
      return;
    }

    setIsScanning(true);
    
    try {
      // Check if product exists with this barcode
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', codeToProcess)
        .single();

      const newScannedItem: ScannedItem = {
        id: Date.now().toString(),
        barcode: codeToProcess,
        product: product || undefined,
        quantity: 1,
        timestamp: new Date(),
        status: product ? 'found' : 'not_found',
      };

      setScannedItems(prev => [newScannedItem, ...prev]);
      
      if (product) {
        // Product found, show quantity modal
        setSelectedItem(newScannedItem);
        setShowAddModal(true);
      } else {
        // Product not found, prompt to create new
        Alert.alert(
          'Product Not Found',
          `No product found with barcode: ${codeToProcess}\n\nWould you like to add it as a new product?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add New Product',
              onPress: () => {
                setSelectedItem(newScannedItem);
                setNewProduct({ ...newProduct, barcode: codeToProcess });
                setShowNewProductModal(true);
              }
            }
          ]
        );
      }
      
      setBarcode('');
    } catch (error) {
      console.error('Error scanning barcode:', error);
      Alert.alert('Error', 'Failed to process barcode');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddQuantity = async () => {
    if (!selectedItem || !selectedItem.product) return;
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Update product quantity in database
      const newQuantity = selectedItem.product.quantity + qty;
      
      const { error } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', selectedItem.product.id);

      if (error) throw error;

      // Update scanned item status
      setScannedItems(prev => 
        prev.map(item => 
          item.id === selectedItem.id 
            ? { ...item, quantity: qty, status: 'added' as const }
            : item
        )
      );

      Alert.alert('Success', `Added ${qty} ${selectedItem.product.unit}(s) to inventory`);
      setShowAddModal(false);
      setQuantity('1');
      setSelectedItem(null);
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update inventory');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNewProduct = async () => {
    // Validate form
    if (!newProduct.product_id || !newProduct.product_name || !newProduct.quantity || !newProduct.price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Check for duplicates by product_id or name
      const { data: existingProducts } = await supabase
        .from('products')
        .select('product_id, product_name')
        .or(`product_id.eq.${newProduct.product_id},product_name.ilike.%${newProduct.product_name}%`);

      if (existingProducts && existingProducts.length > 0) {
        Alert.alert(
          'Possible Duplicate',
          `Similar products found:\n${existingProducts.map(p => p.product_name).join('\n')}\n\nDo you still want to add this product?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Anyway', onPress: () => createProduct() }
          ]
        );
      } else {
        await createProduct();
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
      Alert.alert('Error', 'Failed to check for duplicates');
    } finally {
      setIsProcessing(false);
    }
  };

  const createProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          product_id: newProduct.product_id.toUpperCase(),
          product_name: newProduct.product_name,
          barcode: newProduct.barcode,
          quantity: parseInt(newProduct.quantity),
          unit: newProduct.unit,
          price: parseFloat(newProduct.price),
          category: newProduct.category || null,
          min_stock_level: 10,
          max_stock_level: 100,
          sku: newProduct.product_id.toUpperCase(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update scanned item with new product
      if (selectedItem) {
        setScannedItems(prev => 
          prev.map(item => 
            item.id === selectedItem.id 
              ? { ...item, product: data, status: 'added' as const, quantity: parseInt(newProduct.quantity) }
              : item
          )
        );
      }

      Alert.alert('Success', 'New product added to inventory');
      setShowNewProductModal(false);
      resetNewProductForm();
    } catch (error: any) {
      console.error('Error creating product:', error);
      if (error.code === '23505') {
        Alert.alert('Error', 'A product with this ID or barcode already exists');
      } else {
        Alert.alert('Error', 'Failed to create product');
      }
    }
  };

  const resetNewProductForm = () => {
    setNewProduct({
      product_id: '',
      product_name: '',
      barcode: '',
      quantity: '',
      unit: 'piece',
      price: '',
      category: '',
    });
    setSelectedItem(null);
  };

  const renderScannedItem = ({ item }: { item: ScannedItem }) => {
    const getStatusColor = () => {
      switch (item.status) {
        case 'found': return '#27AE60';
        case 'not_found': return '#F39C12';
        case 'added': return '#3498DB';
        default: return '#666';
      }
    };

    const getStatusIcon = () => {
      switch (item.status) {
        case 'found': return 'checkmark-circle';
        case 'not_found': return 'alert-circle';
        case 'added': return 'checkmark-done-circle';
        default: return 'time-outline';
      }
    };

    return (
      <View style={styles.scannedItem}>
        <View style={styles.itemHeader}>
          <View style={styles.barcodeInfo}>
            <Ionicons name="barcode-outline" size={16} color="#666" />
            <Text style={styles.barcodeText}>{item.barcode}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}15` }]}>
            <Ionicons name={getStatusIcon() as any} size={16} color={getStatusColor()} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        
        {item.product && (
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.product.product_name}</Text>
            <Text style={styles.productDetails}>
              {item.status === 'added' ? `Added: ${item.quantity} ${item.product.unit}(s)` : `Current Stock: ${item.product.quantity} ${item.product.unit}(s)`}
            </Text>
          </View>
        )}
        
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  const units = ['piece', 'box', 'case', 'carton', 'pack', 'bottle', 'kg', 'g'];
  const categories = ['Tobacco', 'Cigarettes', 'Vape', 'Accessories', 'Other'];

  return (
    <View style={styles.container}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalScanned}</Text>
          <Text style={styles.statLabel}>Scanned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#27AE60' }]}>{stats.totalAdded}</Text>
          <Text style={styles.statLabel}>Added</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#F39C12' }]}>{stats.newProducts}</Text>
          <Text style={styles.statLabel}>New Items</Text>
        </View>
      </View>

      {/* Barcode Input */}
      <View style={styles.scanSection}>
        <View style={styles.inputContainer}>
          <Ionicons name="barcode-outline" size={24} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.barcodeInput}
            placeholder="Enter or scan barcode..."
            value={barcode}
            onChangeText={setBarcode}
            onSubmitEditing={() => handleBarcodeSubmit()}
            keyboardType="default"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={openScanner}
          >
            <Ionicons name="scan" size={24} color="#E74C3C" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={[styles.submitButton, isScanning && styles.submitButtonDisabled]}
          onPress={() => handleBarcodeSubmit()}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Add to Inventory</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Scanned Items List */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Recent Scans</Text>
        {scannedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>No items scanned yet</Text>
            <Text style={styles.emptySubtext}>Scan or enter a barcode to get started</Text>
          </View>
        ) : (
          <FlatList
            data={scannedItems}
            keyExtractor={(item) => item.id}
            renderItem={renderScannedItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Camera Scanner Modal */}
      <CameraScanner
        isVisible={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onBarCodeScanned={handleBarcodeScan}
      />

      {/* Add Quantity Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Inventory</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedItem?.product && (
              <View style={styles.modalBody}>
                <View style={styles.productCard}>
                  <Text style={styles.modalProductName}>{selectedItem.product.product_name}</Text>
                  <Text style={styles.modalProductInfo}>
                    Current Stock: {selectedItem.product.quantity} {selectedItem.product.unit}(s)
                  </Text>
                </View>
                
                <View style={styles.quantitySection}>
                  <Text style={styles.inputLabel}>Quantity to Add</Text>
                  <View style={styles.quantityInput}>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => {
                        const qty = parseInt(quantity) - 1;
                        if (qty > 0) setQuantity(qty.toString());
                      }}
                    >
                      <Ionicons name="remove" size={24} color="#666" />
                    </TouchableOpacity>
                    
                    <TextInput
                      style={styles.quantityValue}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                    
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => {
                        const qty = parseInt(quantity) + 1;
                        setQuantity(qty.toString());
                      }}
                    >
                      <Ionicons name="add" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowAddModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.confirmButton, isProcessing && styles.confirmButtonDisabled]}
                    onPress={handleAddQuantity}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Add to Stock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* New Product Modal */}
      <Modal
        visible={showNewProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewProductModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <ScrollView>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Product</Text>
                <TouchableOpacity onPress={() => {
                  setShowNewProductModal(false);
                  resetNewProductForm();
                }}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Barcode</Text>
                  <TextInput
                    style={[styles.formInput, styles.disabledInput]}
                    value={newProduct.barcode}
                    editable={false}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Product ID <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.product_id}
                    onChangeText={(text) => setNewProduct({...newProduct, product_id: text})}
                    placeholder="e.g., PROD-001"
                    autoCapitalize="characters"
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Product Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.product_name}
                    onChangeText={(text) => setNewProduct({...newProduct, product_name: text})}
                    placeholder="Enter product name"
                  />
                </View>
                
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.inputLabel}>
                      Quantity <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      value={newProduct.quantity}
                      onChangeText={(text) => setNewProduct({...newProduct, quantity: text})}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Unit</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.unitContainer}>
                        {units.slice(0, 3).map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              styles.unitButton,
                              newProduct.unit === unit && styles.unitButtonActive
                            ]}
                            onPress={() => setNewProduct({...newProduct, unit})}
                          >
                            <Text style={[
                              styles.unitButtonText,
                              newProduct.unit === unit && styles.unitButtonTextActive
                            ]}>
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>
                    Price ($) <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.price}
                    onChangeText={(text) => setNewProduct({...newProduct, price: text})}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.categoryContainer}>
                      {categories.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryButton,
                            newProduct.category === cat && styles.categoryButtonActive
                          ]}
                          onPress={() => setNewProduct({...newProduct, category: cat})}
                        >
                          <Text style={[
                            styles.categoryButtonText,
                            newProduct.category === cat && styles.categoryButtonTextActive
                          ]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowNewProductModal(false);
                      resetNewProductForm();
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.confirmButton, isProcessing && styles.confirmButtonDisabled]}
                    onPress={handleCreateNewProduct}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Create Product</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  scanSection: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: {
    marginRight: 10,
  },
  barcodeInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  scanButton: {
    padding: 10,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  listContent: {
    paddingBottom: 20,
  },
  scannedItem: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barcodeText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  productInfo: {
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productDetails: {
    fontSize: 14,
    color: '#666',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 5,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  productCard: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  modalProductName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  modalProductInfo: {
    fontSize: 14,
    color: '#666',
  },
  quantitySection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  quantityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 44,
    height: 44,
    backgroundColor: '#F0F0F0',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 30,
    minWidth: 60,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: '#E74C3C',
    marginLeft: 10,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  disabledInput: {
    backgroundColor: '#F0F0F0',
    color: '#999',
  },
  required: {
    color: '#E74C3C',
  },
  unitContainer: {
    flexDirection: 'row',
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    backgroundColor: '#FAFAFA',
  },
  unitButtonActive: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  unitButtonText: {
    fontSize: 12,
    color: '#666',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 10,
    backgroundColor: '#FAFAFA',
  },
  categoryButtonActive: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default IncomingTab;