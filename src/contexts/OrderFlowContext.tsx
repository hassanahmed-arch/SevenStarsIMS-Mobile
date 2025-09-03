// src/contexts/OrderFlowContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';


const ORDER_FLOW_STORAGE_KEY = '@sevenstars_order_flow';
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  customer_type?: string;
  outstanding_balance: number;
  credit_limit: number;
  is_active: boolean;
  out_of_state: boolean;
}

interface OrderData {
  orderType: 'delivery' | 'pickup' | 'phone' | 'out_of_state';
  paymentType: 'cash' | 'card_zelle' | 'net15' | 'net30' | 'net60';
  deliveryDate: string;
  deliveryTime?: string;
  poNumber?: string;
  notes?: string;
  specialHandlingNotes?: string;
  proposalId?: string; // ADD THIS for tracking proposal conversions
  proposalNumber?: string; // ADD THIS for reference
}

interface ProposalData {
  id: string;
  proposalNumber: string;
  items: any[];
  customer: Customer;
}

interface OrderFlowContextType {
  // Current step tracking
  currentStep: number;
  setCurrentStep: (step: number) => void;
  
  // Customer data
  customer: Customer | null;
  setCustomer: (customer: Customer | null) => void;
  
  // Order details
  orderData: OrderData | null;
  setOrderData: (data: OrderData | null) => void;
  
  // Flow type
  flowType: 'order' | 'proposal';
  setFlowType: (type: 'order' | 'proposal') => void;

    // Proposal conversion support
  proposalToConvert: ProposalData | null;
  setProposalToConvert: (proposal: ProposalData | null) => void;
  // Reset flow
  resetFlow: () => void;
  
  // Validation
  canProceedToStep: (step: number) => boolean;
}

const OrderFlowContext = createContext<OrderFlowContextType | undefined>(undefined);

export function OrderFlowProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [flowType, setFlowType] = useState<'order' | 'proposal'>('order');
  const [proposalToConvert, setProposalToConvert] = useState<ProposalData | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    saveState();
  }, [customer, orderData, currentStep, flowType, proposalToConvert]);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    saveState();
  }, [customer, orderData, currentStep, flowType]);

  const loadPersistedState = async () => {
    try {
      const stored = await AsyncStorage.getItem(ORDER_FLOW_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCustomer(parsed.customer);
        setOrderData(parsed.orderData);
        setCurrentStep(parsed.currentStep || 1);
        setFlowType(parsed.flowType || 'order');
        setProposalToConvert(parsed.proposalToConvert || null);
      }
    } catch (error) {
      console.error('Error loading order flow state:', error);
    }
  };

 const saveState = async () => {
    try {
      const state = {
        customer,
        orderData,
        currentStep,
        flowType,
        proposalToConvert,
      };
      await AsyncStorage.setItem(ORDER_FLOW_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving order flow state:', error);
    }
  };

 const resetFlow = async () => {
    setCurrentStep(1);
    setCustomer(null);
    setOrderData(null);
    setFlowType('order');
    setProposalToConvert(null);
    try {
      await AsyncStorage.removeItem(ORDER_FLOW_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing order flow state:', error);
    }
  };

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return true; // Can always go to customer selection
      case 2:
        return customer !== null; // Need customer selected
      case 3:
        return customer !== null && orderData !== null; // Need customer and order details
      case 4:
        return customer !== null && orderData !== null; // Need everything for overview
      default:
        return false;
    }
  };

  return (
    <OrderFlowContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        customer,
        setCustomer,
        orderData,
        setOrderData,
        flowType,
        setFlowType,
        proposalToConvert,
        setProposalToConvert,
        resetFlow,
        canProceedToStep,
      }}
    >
      {children}
    </OrderFlowContext.Provider>
  );
}

export function useOrderFlow() {
  const context = useContext(OrderFlowContext);
  if (!context) {
    throw new Error('useOrderFlow must be used within an OrderFlowProvider');
  }
  return context;
}