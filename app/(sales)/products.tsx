// app/(sales)/products.tsx - Product Selection Screen
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  View
} from 'react-native';
import { useCart } from '../../src/contexts/CartContext';
import { useOrderFlow } from '../../src/contexts/OrderFlowContext';
import { supabase } from '../../src/lib/supabase';

interface Product {
  id: string;
  product_name: string;
  sku: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
  description?: string;
  image_url?: string;
  is_tobacco: boolean;
  min_stock_level: number;
  brand_id?: number;
  search_text?: string;
}

interface FilterState {
  category: string;
  stockLevel: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  priceRange: 'all' | 'under_10' | '10_50' | '50_100' | 'over_100';
}

export default function ProductsScreen() {
  const { addToCart, cartCount, isInCart, getItemQuantity } = useCart();
  const { customer } = useOrderFlow();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddQuantity, setQuickAddQuantity] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  const [customerPrices, setCustomerPrices] = useState<Map<string, number>>(new Map());
  
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    stockLevel: 'all',
    priceRange: 'all',
  });

  // Pagination
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    if (customer) {
      fetchCustomerPrices();
    }
  }, [customer]);

  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, filters]);

  const fetchProducts = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('product_name', { ascending: true })
        .range(0, 100); // Load first 100 products

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null);

      if (error) throw error;

      const uniqueCategories = ['All', ...new Set(data?.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchCustomerPrices = async () => {
    if (!customer) return;

    try {
      const { data, error } = await supabase
        .from('customer_price_history')
        .select('product_id, last_price')
        .eq('customer_id', customer.id);

      if (error) throw error;

      const priceMap = new Map<string, number>();
      data?.forEach(item => {
        priceMap.set(item.product_id, item.last_price);
      });
      setCustomerPrices(priceMap);
    } catch (error) {
      console.error('Error fetching customer prices:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.product_name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filters.category !== 'All') {
      filtered = filtered.filter(product => product.category === filters.category);
    }

    // Stock level filter
    switch (filters.stockLevel) {
      case 'in_stock':
        filtered = filtered.filter(product => product.quantity > product.min_stock_level);
        break;
      case 'low_stock':
        filtered = filtered.filter(product => 
          product.quantity > 0 && product.quantity <= product.min_stock_level
        );
        break;
      case 'out_of_stock':
        filtered = filtered.filter(product => product.quantity === 0);
        break;
    }

    // Price range filter
    switch (filters.priceRange) {
      case 'under_10':
        filtered = filtered.filter(product => product.price < 10);
        break;
      case '10_50':
        filtered = filtered.filter(product => product.price >= 10 && product.price <= 50);
        break;
      case '50_100':
        filtered = filtered.filter(product => product.price > 50 && product.price <= 100);
        break;
      case 'over_100':
        filtered = filtered.filter(product => product.price > 100);
        break;
    }

    setFilteredProducts(filtered);
  };

  const getAvailableQuantity = (product: Product): number => {
    // For now, just return the actual quantity
    // In production, this would calculate: actual - reserved
    return product.quantity;
  };

  const getStockStatus = (product: Product) => {
    const available = getAvailableQuantity(product);
    if (available === 0) {
      return { text: 'Out of Stock', color: '#E74C3C' };
    } else if (available <= product.min_stock_level) {
      return { text: `Low Stock: ${available}`, color: '#F39C12' };
    } else {
      return { text: `Stock: ${available}`, color: '#27AE60' };
    }
  };

  const handleQuickAdd = (product: Product) => {
    setSelectedProduct(product);
    setQuickAddQuantity('1');
    
    // Set custom price from customer history or default
    const customerPrice = customerPrices.get(product.id);
    setCustomPrice(customerPrice ? customerPrice.toFixed(2) : product.price.toFixed(2));
    
    setShowQuickAdd(true);
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const quantity = parseInt(quickAddQuantity) || 1;
    const price = parseFloat(customPrice) || selectedProduct.price;
    const available = getAvailableQuantity(selectedProduct);

    if (quantity > available && available > 0) {
      Alert.alert(
        'Low Stock',
        `Only ${available} units available. Do you want to add them all?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Available',
            onPress: () => {
              addToCart(selectedProduct, available, selectedProduct.unit, price);
              setShowQuickAdd(false);
            }
          },
          {
            text: 'Add Anyway',
            onPress: () => {
              addToCart(selectedProduct, quantity, selectedProduct.unit, price);
              setShowQuickAdd(false);
            },
            style: 'destructive'
          }
        ]
      );
    } else if (available === 0) {
      Alert.alert(
        'Out of Stock',
        'This item is out of stock. Do you want to add it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            onPress: () => {
              addToCart(selectedProduct, quantity, selectedProduct.unit, price);
              setShowQuickAdd(false);
            },
            style: 'destructive'
          }
        ]
      );
    } else {
      addToCart(selectedProduct, quantity, selectedProduct.unit, price);
      setShowQuickAdd(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const stockStatus = getStockStatus(item);
    const inCart = isInCart(item.id);
    const cartQuantity = getItemQuantity(item.id);
    const customerPrice = customerPrices.get(item.id);
    const displayPrice = customerPrice || item.price;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleQuickAdd(item)}
      >
        <View style={styles.productImageContainer}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="cube-outline" size={32} color="#CCC" />
            </View>
          )}
          {item.is_tobacco && (
            <View style={styles.tobaccoBadge}>
              <Text style={styles.tobaccoText}>Tobacco</Text>
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
          <Text style={styles.productSku}>SKU: {item.sku || 'N/A'}</Text>
          
          <View style={styles.stockContainer}>
            <Text style={[styles.stockText, { color: stockStatus.color }]}>
              {stockStatus.text}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.price}>
                ${displayPrice.toFixed(2)}
              </Text>
              {customerPrice && customerPrice !== item.price && (
                <Text style={styles.originalPrice}>
                  Reg: ${item.price.toFixed(2)}
                </Text>
              )}
            </View>
            
            {inCart ? (
              <View style={styles.inCartBadge}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={styles.inCartText}>{cartQuantity}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleQuickAdd(item)}
              >
                <Ionicons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Products</Text>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push('/(sales)/cart' as any)}
        >
          <Ionicons name="cart" size={24} color="#ffffffff" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
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
                                <View style={[styles.progressDot, styles.progressDotActive]} />
                                <Text style={[styles.progressLabel, styles.progressLabelActive]}>Products</Text>
                              </View>
                      <View style={styles.progressLine} />
                                <View style={styles.progressStep}>
                                  <View style={styles.progressDot} />
                                  <Text style={styles.progressLabel}>Review</Text>
                                </View>
                              </View>
                </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterPill, filters.category !== 'All' && styles.filterPillActive]}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterPillText}>Category</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterPill, filters.stockLevel !== 'all' && styles.filterPillActive]}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterPillText}>Stock Level</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterPill, filters.priceRange !== 'all' && styles.filterPillActive]}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterPillText}>Price</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Products List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.productList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchProducts(true)}
              colors={['#E74C3C']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color="#DDD" />
              <Text style={styles.emptyText}>No products found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}

        {/* Quick Add Modal */}
   {/* Quick Add Modal */}
<Modal
  visible={showQuickAdd}
  transparent={true}
  animationType="slide"
  onRequestClose={() => setShowQuickAdd(false)}
>
  <KeyboardAvoidingView 
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={styles.modalOverlay}
  >
    <TouchableOpacity 
      style={styles.modalBackdrop} 
      activeOpacity={1} 
      onPress={() => setShowQuickAdd(false)}
    />
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Add to Cart</Text>
        <TouchableOpacity onPress={() => setShowQuickAdd(false)}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {selectedProduct && (
        <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.modalProduct}>
            <Text style={styles.modalProductName}>{selectedProduct.product_name}</Text>
            <Text style={styles.modalProductSku}>SKU: {selectedProduct.sku}</Text>
            <Text style={[styles.modalStock, { color: getStockStatus(selectedProduct).color }]}>
              {getStockStatus(selectedProduct).text}
            </Text>
          </View>

          <View style={styles.modalInputs}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <View style={styles.quantityRow}>
                <TextInput
                  style={styles.quantityInput}
                  value={quickAddQuantity}
                  onChangeText={setQuickAddQuantity}
                  keyboardType="number-pad"
                  placeholder="1"
                />
                <View style={styles.quickButtons}>
                  <TouchableOpacity
                    style={styles.quickButton}
                    onPress={() => setQuickAddQuantity('30')}
                  >
                    <Text style={styles.quickButtonText}>Case (30)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickButton}
                    onPress={() => setQuickAddQuantity('100')}
                  >
                    <Text style={styles.quickButtonText}>Pallet (100)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Unit Price {customerPrices.has(selectedProduct.id) && '(Custom)'}
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={customPrice}
                  onChangeText={setCustomPrice}
                  keyboardType="decimal-pad"
                  placeholder={selectedProduct.price.toString()}
                />
              </View>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowQuickAdd(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={handleAddToCart}
            >
              <Text style={styles.addToCartButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  </KeyboardAvoidingView>
</Modal>

{/* Continue to Cart Button */}
{cartCount > 0 && (
  <View style={styles.bottomActionContainer}>
    <TouchableOpacity
      style={styles.continueButton}
      onPress={() => router.push('/(sales)/cart' as any)}
    >
      <Text style={styles.continueButtonText}>Continue to Cart</Text>
      <View style={styles.cartCountBadge}>
        <Text style={styles.cartCountText}>{cartCount}</Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color="#FFF" />
    </TouchableOpacity>
  </View>
)}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  bottomActionContainer: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: '#FFF',
  padding: 20,
  borderTopWidth: 1,
  borderTopColor: '#E0E0E0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 5,
},
continueButton: {
  flexDirection: 'row',
  backgroundColor: '#E74C3C',
  borderRadius: 25,
  paddingVertical: 16,
  paddingHorizontal: 24,
  alignItems: 'center',
  justifyContent: 'center',
},
continueButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FFF',
  flex: 1,
  textAlign: 'center',
},
cartCountBadge: {
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  borderRadius: 12,
  paddingHorizontal: 8,
  paddingVertical: 2,
  marginRight: 8,
},
cartCountText: {
  color: '#FFF',
  fontSize: 14,
  fontWeight: '600',
},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000000ff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f7f7f7ff',
  },
  cartButton: {
    position: 'relative',
    padding: 4,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: -4,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  cartBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
  },
  filterPillActive: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  filterPillText: {
    fontSize: 13,
    color: '#666',
    marginRight: 4,
  },
  productList: {
    padding: 10,
    paddingBottom: 80,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productImageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tobaccoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tobaccoText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    minHeight: 36,
  },
  productSku: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  stockContainer: {
    marginBottom: 8,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  originalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27AE60',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inCartText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
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
  },
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'flex-end',
},
modalBackdrop: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
},
  backButton: {
  padding: 4,
  color: '#ffffffff'
},
modalContent: {
  backgroundColor: '#FFF',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  maxHeight: Platform.OS === 'ios' ? '70%' : '75%',
  paddingBottom: Platform.OS === 'ios' ? 20 : 10,
},
  modalScrollContent: {
    padding: 20,
  },
modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 20,
  borderBottomWidth: 1,
  borderBottomColor: '#E0E0E0',
},
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalProduct: {
    marginBottom: 20,
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  modalProductSku: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  modalStock: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalInputs: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginRight: 10,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  quickButtonText: {
    fontSize: 12,
    color: '#666',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  dollarSign: {
    fontSize: 16,
    color: '#666',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  addToCartButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
  },
  addToCartButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#E74C3C',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
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
});