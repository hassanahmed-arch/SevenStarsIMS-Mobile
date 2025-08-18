// Real-time Statistics: Total products, low stock alerts, inventory value
// Advanced Search: By name, SKU, or barcode
// Filtering: All products, low stock, out of stock, in stock
// Product Management: View, edit, delete products
// Stock Monitoring: Visual indicators for stock levels





// app/(admin)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { debounce } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface Product {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unit: string;
  price: number;
  stock_level?: string;
  min_stock_level: number;
  max_stock_level: number;
  category?: string;
  relevance?: number;
}

interface SearchStats {
  totalProducts: number;
  lowStockCount: number;
  totalValue: number;
}

const PAGE_SIZE = 20;

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);
  const [userName, setUserName] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter states
  const [stockFilter, setStockFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<SearchStats>({
    totalProducts: 0,
    lowStockCount: 0,
    totalValue: 0,
  });

  // Search debounce
  const debouncedSearch = useRef(
    debounce((query: string) => {
      setDebouncedSearchQuery(query);
    }, 500)
  ).current;

  // Format number with K, M, B suffixes
  const formatCurrency = (num: number): string => {
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    } else {
      return `$${num.toFixed(2)}`;
    }
  };

  // Format with more precision for smaller numbers
  const formatCurrencyPrecise = (num: number): string => {
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 10000) {
      return `$${(num / 1000).toFixed(1)}K`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    } else {
      return `$${num.toFixed(2)}`;
    }
  };

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toString();
    }
  };

  useEffect(() => {
    fetchUserInfo();
    fetchInitialData();
  }, []);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    // Reset and search when debounced query changes
    setCurrentPage(0);
    setProducts([]);
    fetchProducts(0, true);
  }, [debouncedSearchQuery, stockFilter, categoryFilter]);

  const fetchUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      } else {
        setUserName(user.email?.split('@')[0] || 'Admin');
      }
    }
  };

  const fetchInitialData = async () => {
    setIsInitialLoad(true);
    await Promise.all([
      fetchProducts(0, true),
      fetchStats(),
    ]);
    setIsInitialLoad(false);
  };

  const fetchStats = async () => {
    try {
      // Get total count
      const { data: totalData } = await supabase
        .rpc('count_products', {
          search_query: '',
          stock_filter: null,
          category_filter: null,
        });

      // Get low stock count
      const { data: lowStockData } = await supabase
        .rpc('count_products', {
          search_query: '',
          stock_filter: 'low',
          category_filter: null,
        });

      // Get total value (sampling for performance)
      const { data: valueData } = await supabase
        .from('products')
        .select('quantity, price')
        .eq('is_active', true)
        .limit(1000); // Sample for estimation

      const sampleValue = valueData?.reduce((sum, p) => sum + (p.quantity * p.price), 0) || 0;
      const estimatedTotalValue = totalData ? (sampleValue * totalData / 1000) : 0;

      setStats({
        totalProducts: totalData || 0,
        lowStockCount: lowStockData || 0,
        totalValue: estimatedTotalValue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchProducts = async (page: number = 0, reset: boolean = false) => {
    if (!reset && (isLoading || !hasMore)) return;

    setIsLoading(true);
    setIsLoadingMore(!reset && page > 0);

    try {
      // Fetch products using optimized search function
      const { data, error } = await supabase.rpc('search_products', {
        search_query: debouncedSearchQuery || '',
        page_size: PAGE_SIZE,
        page_offset: page * PAGE_SIZE,
        stock_filter: stockFilter,
        category_filter: categoryFilter,
      });

      if (error) throw error;

      const newProducts = data || [];

      if (reset) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }

      setHasMore(newProducts.length === PAGE_SIZE);
      setCurrentPage(page);

      // Get total count for pagination info
      const { data: countData } = await supabase.rpc('count_products', {
        search_query: debouncedSearchQuery || '',
        stock_filter: stockFilter,
        category_filter: categoryFilter,
      });

      setTotalProducts(countData || 0);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setCurrentPage(0);
    fetchProducts(0, true);
    fetchStats();
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchProducts(currentPage + 1);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const getStockLevelColor = (level: string) => {
    switch (level) {
      case 'low': return '#E74C3C';
      case 'medium': return '#F39C12';
      case 'high': return '#27AE60';
      default: return '#666666';
    }
  };

  const getStockLevelIcon = (level: string) => {
    switch (level) {
      case 'low': return 'alert-circle';
      case 'medium': return 'remove-circle';
      case 'high': return 'checkmark-circle';
      default: return 'help-circle';
    }
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditedProduct({ ...product });
    setIsEditModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!editedProduct) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          product_name: editedProduct.product_name,
          quantity: editedProduct.quantity,
          price: editedProduct.price,
          unit: editedProduct.unit,
          barcode: editedProduct.barcode,
        })
        .eq('id', editedProduct.id);

      if (error) throw error;

      Alert.alert('Success', 'Product updated successfully');
      setIsEditModalVisible(false);
      handleRefresh();
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .update({ is_active: false })
                .eq('id', productId);

              if (error) throw error;

              Alert.alert('Success', 'Product deleted successfully');
              handleRefresh();
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'Failed to delete product');
            }
          }
        }
      ]
    );
  };

  const renderProductCard = ({ item: product }: { item: Product }) => {
    const stockLevel = product.stock_level || 'medium';
    const stockColor = getStockLevelColor(stockLevel);
    const stockIcon = getStockLevelIcon(stockLevel);

    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.productIdContainer}>
            <Text style={styles.productIdLabel}>ID:</Text>
            <Text style={styles.productId}>{product.product_id}</Text>
          </View>
          <View style={styles.productActions}>
            <TouchableOpacity
              onPress={() => handleEditProduct(product)}
              style={styles.actionButton}
            >
              <Ionicons name="create-outline" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteProduct(product.id)}
              style={styles.actionButton}
            >
              <Ionicons name="trash-outline" size={20} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.productName}>{product.product_name}</Text>

        {product.barcode && (
          <View style={styles.barcodeContainer}>
            <Ionicons name="barcode-outline" size={16} color="#666" />
            <Text style={styles.barcodeText}>{product.barcode}</Text>
          </View>
        )}

        <View style={styles.productDetails}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Quantity</Text>
              <Text style={styles.detailValue}>{product.quantity}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Unit</Text>
              <Text style={styles.detailValue}>{product.unit}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>{formatCurrency(product.price)}</Text>
            </View>
          </View>

          <View style={[styles.stockLevelContainer, { backgroundColor: `${stockColor}15` }]}>
            <Ionicons name={stockIcon as any} size={16} color={stockColor} />
            <Text style={[styles.stockLevelText, { color: stockColor }]}>
              {stockLevel.charAt(0).toUpperCase() + stockLevel.slice(1)} Stock
            </Text>
          </View>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Value:</Text>
          <Text style={styles.totalValue}>{formatCurrencyPrecise(product.quantity * product.price)}</Text>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#E74C3C" />
        <Text style={styles.loadingMoreText}>Loading more products...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={64} color="#CCC" />
        <Text style={styles.emptyText}>
          {debouncedSearchQuery ? 'No products found' : 'No products available'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, ID, SKU, or barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, stockFilter === 'low' && styles.filterChipActive]}
            onPress={() => setStockFilter(stockFilter === 'low' ? null : 'low')}
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={stockFilter === 'low' ? '#FFF' : '#E74C3C'}
              style={styles.filterIcon}
            />
            <Text style={[styles.filterChipText, stockFilter === 'low' && styles.filterChipTextActive]}>
              Low Stock
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, stockFilter === 'medium' && styles.filterChipActive]}
            onPress={() => setStockFilter(stockFilter === 'medium' ? null : 'medium')}
          >
            <Ionicons
              name="remove-circle-outline"
              size={16}
              color={stockFilter === 'medium' ? '#FFF' : '#F39C12'}
              style={styles.filterIcon}
            />
            <Text style={[styles.filterChipText, stockFilter === 'medium' && styles.filterChipTextActive]}>
              Medium Stock
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, stockFilter === 'high' && styles.filterChipActive]}
            onPress={() => setStockFilter(stockFilter === 'high' ? null : 'high')}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={stockFilter === 'high' ? '#FFF' : '#27AE60'}
              style={styles.filterIcon}
            />
            <Text style={[styles.filterChipText, stockFilter === 'high' && styles.filterChipTextActive]}>
              High Stock
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatNumber(stats.totalProducts)}</Text>
          <Text style={styles.summaryLabel}>Total Products</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>
            {formatNumber(stats.lowStockCount)}
          </Text>
          <Text style={styles.summaryLabel}>Low Stock</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: '#27AE60' }]}>
            {formatCurrency(stats.totalValue)}
          </Text>
          <Text style={styles.summaryLabel}>Est. Value</Text>
        </View>
      </View>

      {totalProducts > 0 && (
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            Showing {products.length} of {formatNumber(totalProducts)} products
          </Text>
        </View>
      )}

      {isInitialLoad ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#E74C3C']}
              tintColor="#E74C3C"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
        />
      )}

      {/* Edit Product Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Product</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {editedProduct && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Product Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedProduct.product_name}
                    onChangeText={(text) => setEditedProduct({ ...editedProduct, product_name: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Barcode</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedProduct.barcode || ''}
                    onChangeText={(text) => setEditedProduct({ ...editedProduct, barcode: text })}
                    placeholder="Enter barcode"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.inputLabel}>Quantity</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editedProduct.quantity.toString()}
                      onChangeText={(text) => setEditedProduct({ ...editedProduct, quantity: parseInt(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Unit</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editedProduct.unit}
                      onChangeText={(text) => setEditedProduct({ ...editedProduct, unit: text })}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Price ($)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedProduct.price.toString()}
                    onChangeText={(text) => setEditedProduct({ ...editedProduct, price: parseFloat(text) || 0 })}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setIsEditModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSaveProduct}
                  >
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(admin)/add-product')}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  logoutButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 15,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    marginBottom: 10,
    height: 45,
  },
  filterScrollContent: {
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 36,
    minWidth: 100,
  },
  filterChipActive: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  filterIcon: {
    marginRight: 4,
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  resultsInfo: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 13,
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 100,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productIdLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 5,
  },
  productId: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  productActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 5,
    marginLeft: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barcodeText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  productDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stockLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stockLevelText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: 5,
    fontSize: 12,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    backgroundColor: '#E74C3C',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
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
  saveButton: {
    backgroundColor: '#E74C3C',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});