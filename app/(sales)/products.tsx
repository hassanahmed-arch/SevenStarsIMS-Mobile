// app/(sales)/products.tsx - Updated with Database Search
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
  const { addToCart, cartCount, cartItems, isInCart, getItemQuantity, clearCart } = useCart();
  const { customer, flowType } = useOrderFlow();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<'Item' | 'Case' | 'Pallet'>('Item');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddQuantity, setQuickAddQuantity] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  const [customerPrices, setCustomerPrices] = useState<Map<string, number>>(new Map());
  const [reservedQuantities, setReservedQuantities] = useState<Map<string, number>>(new Map());
  const [cartTotal, setCartTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    category: 'All',
    stockLevel: 'all',
    priceRange: 'all',
  });

  // Pagination
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // Define applyFiltersToProducts as a useCallback to avoid recreation on every render
  const applyFiltersToProducts = useCallback((productsToFilter: Product[]) => {
    let filtered = [...productsToFilter];

    // Category filter
    if (filters.category !== 'All') {
      filtered = filtered.filter(product => product.category === filters.category);
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
  }, [filters]);

  const fetchProducts = async (refresh = false, searchTerm?: string) => {
    if (refresh) setIsRefreshing(true);
    else if (!searchTerm) setIsLoading(true);

    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      // If there's a search term, search in the database
      if (searchTerm && searchTerm.trim()) {
        const searchLower = searchTerm.trim().toLowerCase();
        
        // Use OR conditions to search across multiple fields
        query = query.or(
          `product_name.ilike.%${searchLower}%,` +
          `sku.ilike.%${searchLower}%,` +
          `description.ilike.%${searchLower}%,` +
          `category.ilike.%${searchLower}%`
        );
        
        // Don't limit search results
        query = query.order('product_name', { ascending: true });
      } else {
        // When not searching, get more products but with a limit
        query = query.order('product_name', { ascending: true }).limit(500);
      }

      const { data, error } = await query;

      if (error) throw error;

      setProducts(data || []);
      
      // When searching, directly set filtered products
      if (searchTerm) {
        setFilteredProducts(data || []);
      } else {
        // When not searching, apply filters
        applyFiltersToProducts(data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    // Initial load without search
    fetchProducts();
    fetchCategories();
    fetchReservedQuantities();
    if (customer) {
      fetchCustomerPrices();
    }
  }, [customer]);

  // Apply filters when products or filters change (but not when searching)
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) {
      applyFiltersToProducts(products);
    }
  }, [products, filters, applyFiltersToProducts]);

  // Implement debounced search
  useEffect(() => {
    let timeout: number;
    
    if (searchQuery.trim()) {
      setIsSearching(true);
      timeout = setTimeout(() => {
        fetchProducts(false, searchQuery);
      }, 300); // 300ms delay
    } else if (searchQuery === '') {
      // If search is cleared, fetch all products immediately
      fetchProducts();
    }

    // Cleanup function
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery]);

  // Calculate cart total whenever cart items change
  useEffect(() => {
    calculateCartTotal();
  }, [cartItems, customerPrices, products]);

  const calculateCartTotal = async () => {
    if (!cartItems || cartItems.length === 0) {
      setCartTotal(0);
      return;
    }

    let total = 0;
    
    // If we have products loaded, use them for price calculation
    if (products.length > 0) {
      cartItems.forEach(cartItem => {
        const product = products.find(p => p.id === cartItem.product_id);
        if (product) {
          // Use custom price if set, otherwise customer price history, otherwise product price
          const price = cartItem.custom_price || customerPrices.get(cartItem.product_id) || product.price;
          total += cartItem.quantity * price;
        }
      });
    } else {
      // Fallback: fetch product prices if products aren't loaded yet
      try {
        const productIds = cartItems.map(item => item.product_id);
        const { data: productData } = await supabase
          .from('products')
          .select('id, price')
          .in('id', productIds);
        
        if (productData) {
          cartItems.forEach(cartItem => {
            const product = productData.find(p => p.id === cartItem.product_id);
            if (product) {
              const price = cartItem.custom_price || customerPrices.get(cartItem.product_id) || product.price;
              total += cartItem.quantity * price;
            }
          });
        }
      } catch (error) {
        console.error('Error calculating cart total:', error);
      }
    }
    
    setCartTotal(total);
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

  const fetchReservedQuantities = async () => {
    try {
      const { data: reservations, error } = await supabase
        .from('reserved_inventory')
        .select('product_id, quantity')
        .eq('released', false)
        .neq('reserved_for', 'Cart Reservation')
        .gte('expires_at', new Date().toISOString());

      if (error) throw error;

      const reserved = new Map<string, number>();
      reservations?.forEach(item => {
        const current = reserved.get(item.product_id) || 0;
        reserved.set(item.product_id, current + item.quantity);
      });

      setReservedQuantities(reserved);
    } catch (error) {
      console.error('Error fetching reserved quantities:', error);
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

  const getAvailableQuantity = (product: Product): number => {
    const reserved = reservedQuantities.get(product.id) || 0;
    const available = Math.max(0, product.quantity - reserved);
    return available;
  };

  const getStockStatus = (product: Product) => {
    const available = getAvailableQuantity(product);
    if(flowType === 'order') {
      if (available === 0) {
        return { text: 'Out of Stock', color: '#E74C3C' };
      } else if (available <= product.min_stock_level) {
        return { text: `Low Stock: ${available}`, color: '#F39C12' };
      } else {
        return { text: `Stock: ${available}`, color: '#27AE60' };
      }
    }
    else {
      return { text: '-', color: '#000000ff' }; 
    }
  };

  const handleQuickAdd = (product: Product) => {
    setSelectedProduct(product);
    setQuickAddQuantity('1');
    setSelectedUnit('Item');
    
    const customerPrice = customerPrices.get(product.id);
    setCustomPrice(customerPrice ? customerPrice.toFixed(2) : product.price.toFixed(2));
    
    setShowQuickAdd(true);
  };

  const handleBackPress = () => {
    Alert.alert(
      'Leave Product Selection?',
      'Your cart will be cleared if you go back. Are you sure you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Clear Cart',
          style: 'destructive',
          onPress: () => {
            clearCart();
            router.back();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleAddToCart = async () => {
    if (!selectedProduct) return;

    let quantity = parseInt(quickAddQuantity) || 1;
    const price = parseFloat(customPrice) || selectedProduct.price;
    
    let actualItemsToAdd = quantity;
    if (selectedUnit === 'Case') {
      actualItemsToAdd = quantity * 30;
    } else if (selectedUnit === 'Pallet') {
      actualItemsToAdd = quantity * 100;
    }

    const available = getAvailableQuantity(selectedProduct);

    if (actualItemsToAdd > available && available > 0 && flowType === 'order') {
      Alert.alert(
        'Low Stock',
        `Only ${available} items available. Do you want to add what's available?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Available',
            onPress: () => {
              addToCart(selectedProduct, available, 'Item', price);
              setShowQuickAdd(false);
            }
          },
          {
            text: 'Add Anyway',
            onPress: () => {
              addToCart(selectedProduct, actualItemsToAdd, 'Item', price);
              setShowQuickAdd(false);
            },
            style: 'destructive'
          }
        ]
      );
    } else if (available === 0 && flowType === 'order') {
      Alert.alert(
        'Out of Stock',
        'This item is currently out of stock. Do you want to add it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            onPress: () => {
              addToCart(selectedProduct, actualItemsToAdd, 'Item', price);
              setShowQuickAdd(false);
            },
            style: 'destructive'
          }
        ]
      );
    } else {
      addToCart(selectedProduct, actualItemsToAdd, 'Item', price);
      setShowQuickAdd(false);
    }
    
    await fetchReservedQuantities();
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const stockStatus = getStockStatus(item);
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
            
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleQuickAdd(item)}
            >
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
       <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
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
            placeholder="Search products by name, SKU, or category"
            placeholderTextColor="#686666ff"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {isSearching && (
            <ActivityIndicator size="small" color="#E74C3C" style={{ marginLeft: 8 }} />
          )}
        </View>
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
              <Text style={styles.emptySubtext}>Try adjusting your search</Text>
            </View>
          }
        />
      )}

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
                    </View>
                    
                    {/* Unit selection pills */}
                    <View style={styles.unitPills}>
                      <TouchableOpacity
                        style={[styles.unitPill, selectedUnit === 'Item' && styles.unitPillActive]}
                        onPress={() => setSelectedUnit('Item')}
                      >
                        <Text style={[styles.unitPillText, selectedUnit === 'Item' && styles.unitPillTextActive]}>
                          Item
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitPill, selectedUnit === 'Case' && styles.unitPillActive]}
                        onPress={() => setSelectedUnit('Case')}
                      >
                        <Text style={[styles.unitPillText, selectedUnit === 'Case' && styles.unitPillTextActive]}>
                          Case (30 Items)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitPill, selectedUnit === 'Pallet' && styles.unitPillActive]}
                        onPress={() => setSelectedUnit('Pallet')}
                      >
                        <Text style={[styles.unitPillText, selectedUnit === 'Pallet' && styles.unitPillTextActive]}>
                          Pallet (100 Items)
                        </Text>
                      </TouchableOpacity>
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

      {/* Continue to Cart Button with Total Price */}
      {cartCount > 0 && (
        <View style={styles.bottomActionContainer}>
          <View style={styles.cartSummary}>
            <View style={styles.cartSummaryLeft}>
              <Text style={styles.cartSummaryLabel}>Cart Total</Text>
              <Text style={styles.cartSummaryPrice}>${cartTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.cartSummaryRight}>
              <Text style={styles.cartItemCount}>{cartCount} {cartCount === 1 ? 'item' : 'items'}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push('/(sales)/cart' as any)}
          >
            <Text style={styles.continueButtonText}>Continue to Cart</Text>
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
  cartSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cartSummaryLeft: {
    flex: 1,
  },
  cartSummaryRight: {
    alignItems: 'flex-end',
  },
  cartSummaryLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  cartSummaryPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  cartItemCount: {
    fontSize: 14,
    color: '#666',
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
  unitPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unitPillActive: {
    backgroundColor: '#FFF0F0',
    borderColor: '#E74C3C',
  },
  unitPillText: {
    fontSize: 13,
    color: '#666',
  },
  unitPillTextActive: {
    color: '#E74C3C',
    fontWeight: '500',
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
    paddingBottom: 140,
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