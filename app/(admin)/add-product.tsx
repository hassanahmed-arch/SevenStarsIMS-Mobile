//the logic of this file is to handle the addition of new products to the inventory
//it includes a form for entering product details, validation, and submission to the database


// app/(admin)/add-product.tsx
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function AddProduct() {
  const [product, setProduct] = useState({
    product_id: '',
    product_name: '',
    sku: '',
    barcode: '',
    quantity: '',
    unit: 'piece',
    price: '',
    min_stock_level: '10',
    max_stock_level: '100',
    category: '',
    description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddProduct = async () => {
    // Validation
    if (!product.product_id || !product.product_name || !product.quantity || !product.price) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('products').insert({
        product_id: product.product_id.toUpperCase(),
        product_name: product.product_name,
        sku: product.sku || product.product_id,
        barcode: product.barcode,
        quantity: parseInt(product.quantity),
        unit: product.unit,
        price: parseFloat(product.price),
        min_stock_level: parseInt(product.min_stock_level),
        max_stock_level: parseInt(product.max_stock_level),
        category: product.category,
        description: product.description,
      });

      if (error) throw error;

      Alert.alert('Success', 'Product added successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Error', error.message || 'Failed to add product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const units = ['piece', 'box', 'case', 'carton', 'pack', 'bottle', 'kg', 'g', 'l', 'ml'];
  const categories = ['Tobacco', 'Cigarettes', 'Vape', 'Accessories', 'Other'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Product</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Product ID <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={product.product_id}
                onChangeText={(text) => setProduct({ ...product, product_id: text })}
                placeholder="e.g., PRODUCT-001"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Product Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={product.product_name}
                onChangeText={(text) => setProduct({ ...product, product_name: text })}
                placeholder="Enter product name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Barcode</Text>
              <View style={styles.barcodeInputContainer}>
                <TextInput
                  style={[styles.input, styles.barcodeInput]}
                  value={product.barcode}
                  onChangeText={(text) => setProduct({ ...product, barcode: text })}
                  placeholder="Enter or scan barcode"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.scanButton}>
                  <Ionicons name="scan-outline" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SKU</Text>
              <TextInput
                style={styles.input}
                value={product.sku}
                onChangeText={(text) => setProduct({ ...product, sku: text })}
                placeholder="Stock Keeping Unit (optional)"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryButton,
                        product.category === cat && styles.categoryButtonActive
                      ]}
                      onPress={() => setProduct({ ...product, category: cat })}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        product.category === cat && styles.categoryButtonTextActive
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stock Information</Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>
                  Quantity <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={product.quantity}
                  onChangeText={(text) => setProduct({ ...product, quantity: text })}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.unitContainer}>
                    {units.slice(0, 4).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.unitButton,
                          product.unit === u && styles.unitButtonActive
                        ]}
                        onPress={() => setProduct({ ...product, unit: u })}
                      >
                        <Text style={[
                          styles.unitButtonText,
                          product.unit === u && styles.unitButtonTextActive
                        ]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Min Stock Level</Text>
                <TextInput
                  style={styles.input}
                  value={product.min_stock_level}
                  onChangeText={(text) => setProduct({ ...product, min_stock_level: text })}
                  placeholder="10"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Max Stock Level</Text>
                <TextInput
                  style={styles.input}
                  value={product.max_stock_level}
                  onChangeText={(text) => setProduct({ ...product, max_stock_level: text })}
                  placeholder="100"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Price ($) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={product.price}
                onChangeText={(text) => setProduct({ ...product, price: text })}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={product.description}
                onChangeText={(text) => setProduct({ ...product, description: text })}
                placeholder="Enter product description (optional)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addButton, isSubmitting && styles.addButtonDisabled]}
              onPress={handleAddProduct}
              disabled={isSubmitting}
            >
              <Text style={styles.addButtonText}>
                {isSubmitting ? 'Adding...' : 'Add Product'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 30 }} />
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
  header: {
    backgroundColor: '#E74C3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  form: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 15,
    marginHorizontal: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  required: {
    color: '#E74C3C',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
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
  barcodeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barcodeInput: {
    flex: 1,
    marginRight: 10,
  },
  scanButton: {
    width: 50,
    height: 50,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 2,
    backgroundColor: '#E74C3C',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});