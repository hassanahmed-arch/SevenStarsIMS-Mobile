// src/contexts/CartContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  unit: string;
  custom_price?: number;
  added_at: string;
}

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  addToCart: (product: any, quantity: number, unit: string, customPrice?: number) => void;
  updateQuantity: (itemId: string, quantity: number, customPrice?: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = '@sevenstars_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart from storage on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    saveCart();
  }, [cartItems]);

  const loadCart = async () => {
    try {
      const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) {
        setCartItems(JSON.parse(storedCart));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addToCart = (product: any, quantity: number, unit: string, customPrice?: number) => {
    const existingItem = cartItems.find(item => item.product_id === product.id);
    
    if (existingItem) {
      // Update quantity if item already exists
      updateQuantity(existingItem.id, existingItem.quantity + quantity, customPrice);
    } else {
      // Add new item
      const newItem: CartItem = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        product_id: product.id,
        quantity,
        unit,
        custom_price: customPrice,
        added_at: new Date().toISOString(),
      };
      
      setCartItems(prev => [...prev, newItem]);
    }
  };

  const updateQuantity = (itemId: string, quantity: number, customPrice?: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCartItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            quantity,
            ...(customPrice !== undefined && { custom_price: customPrice })
          }
        : item
    ));
  };

  const removeItem = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const isInCart = (productId: string): boolean => {
    return cartItems.some(item => item.product_id === productId);
  };

  const getItemQuantity = (productId: string): number => {
    const item = cartItems.find(i => i.product_id === productId);
    return item?.quantity || 0;
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        isInCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}