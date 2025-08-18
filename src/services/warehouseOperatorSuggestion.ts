// src/services/warehouseOperatorSuggestion.ts
import { supabase } from '../lib/supabase';

export interface WarehouseOperator {
  id: string;
  user_id: string;
  operator_name: string;
  is_available: boolean;
  current_workload: number;
  specializations: string[];
  shift_start: string;
  shift_end: string;
  performance_score: number;
  created_at: string;
  updated_at: string;
}

export interface OrderAssignmentSuggestion {
  suggested_operator_id: string;
  suggested_operator: WarehouseOperator;
  suggestion_reason: string;
  suggestion_confidence: number;
  alternative_operators: WarehouseOperator[];
}

export interface OrderCategories {
  tobacco: boolean;
  accessories: boolean;
  coals: boolean;
  vape: boolean;
  large_order: boolean; // > 10 items or high value
  urgent: boolean; // same day delivery
}

/**
 * Analyzes order items to determine product categories and complexity
 */
export function analyzeOrderCategories(orderItems: any[]): OrderCategories {
  const categories: OrderCategories = {
    tobacco: false,
    accessories: false,
    coals: false,
    vape: false,
    large_order: false,
    urgent: false
  };

  // Analyze each item
  orderItems.forEach(item => {
    const productName = item.product_name.toLowerCase();
    const category = item.category?.toLowerCase() || '';

    // Categorize by product type
    if (productName.includes('fakher') || productName.includes('adalya') || 
        productName.includes('starbuzz') || productName.includes('tobacco') ||
        category === 'tobacco') {
      categories.tobacco = true;
    }

    if (productName.includes('coal') || productName.includes('charcoal') ||
        category === 'coals') {
      categories.coals = true;
    }

    if (productName.includes('vape') || productName.includes('juice') ||
        category === 'vape' || category === 'vape_juice') {
      categories.vape = true;
    }

    if (productName.includes('hose') || productName.includes('bowl') || 
        productName.includes('tip') || productName.includes('tong') ||
        category === 'accessories') {
      categories.accessories = true;
    }
  });

  // Determine if large order
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = orderItems.reduce((sum, item) => sum + item.total_price, 0);
  categories.large_order = totalItems > 10 || totalValue > 500;

  return categories;
}

/**
 * Calculate suggestion score for an operator based on various factors
 */
function calculateOperatorScore(
  operator: WarehouseOperator,
  orderCategories: OrderCategories,
  deliveryDate: Date,
  priorityLevel: number = 5
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Base availability score (most important)
  if (!operator.is_available) {
    return { score: 0, reasons: ['Operator is not available'] };
  }
  score += 100;
  reasons.push('Available for assignment');

  // Workload factor (lower workload = higher score)
  const workloadScore = Math.max(0, 100 - (operator.current_workload * 10));
  score += workloadScore;
  if (operator.current_workload === 0) {
    reasons.push('No current workload');
  } else if (operator.current_workload <= 3) {
    reasons.push('Light workload');
  } else if (operator.current_workload <= 6) {
    reasons.push('Moderate workload');
  }

  // Performance score factor
  const performanceBonus = (operator.performance_score - 3.0) * 20;
  score += performanceBonus;
  if (operator.performance_score >= 4.5) {
    reasons.push('High performance rating');
  } else if (operator.performance_score >= 4.0) {
    reasons.push('Good performance rating');
  }

  // Specialization matching
  if (operator.specializations && operator.specializations.length > 0) {
    let specializationMatches = 0;
    
    if (orderCategories.tobacco && operator.specializations.includes('tobacco')) {
      specializationMatches++;
      reasons.push('Tobacco specialization');
    }
    
    if (orderCategories.accessories && operator.specializations.includes('accessories')) {
      specializationMatches++;
      reasons.push('Accessories specialization');
    }
    
    if (orderCategories.coals && operator.specializations.includes('coals')) {
      specializationMatches++;
      reasons.push('Coals specialization');
    }
    
    if (orderCategories.vape && operator.specializations.includes('vape')) {
      specializationMatches++;
      reasons.push('Vape products specialization');
    }

    if (orderCategories.large_order && operator.specializations.includes('large_orders')) {
      specializationMatches++;
      reasons.push('Large order specialization');
    }

    // Bonus for specialization matches
    score += specializationMatches * 30;
  }

  // Shift timing factor
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  if (operator.shift_start && operator.shift_end) {
    const shiftStart = parseTimeString(operator.shift_start);
    const shiftEnd = parseTimeString(operator.shift_end);
    
    if (isCurrentlyInShift(currentTime, shiftStart, shiftEnd)) {
      score += 50;
      reasons.push('Currently in shift');
    } else if (isStartingSoonShift(currentTime, shiftStart)) {
      score += 25;
      reasons.push('Shift starts soon');
    }
  }

  // Priority handling bonus
  if (priorityLevel >= 8 && operator.specializations?.includes('urgent_orders')) {
    score += 40;
    reasons.push('Urgent order specialist');
  }

  // Penalize if too much workload for urgent orders
  if (priorityLevel >= 8 && operator.current_workload > 5) {
    score -= 30;
    reasons.push('High workload for urgent order');
  }

  return { score, reasons };
}

/**
 * Parse time string (HH:MM:SS) to minutes
 */
function parseTimeString(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if current time is within shift hours
 */
function isCurrentlyInShift(currentTime: number, shiftStart: number, shiftEnd: number): boolean {
  if (shiftEnd > shiftStart) {
    // Normal shift (e.g., 9:00 - 17:00)
    return currentTime >= shiftStart && currentTime <= shiftEnd;
  } else {
    // Night shift (e.g., 22:00 - 06:00)
    return currentTime >= shiftStart || currentTime <= shiftEnd;
  }
}

/**
 * Check if shift starts within the next 2 hours
 */
function isStartingSoonShift(currentTime: number, shiftStart: number): boolean {
  const timeDiff = shiftStart - currentTime;
  return timeDiff > 0 && timeDiff <= 120; // Within 2 hours
}

/**
 * Get all available warehouse operators
 */
export async function getWarehouseOperators(): Promise<WarehouseOperator[]> {
  try {
    const { data, error } = await supabase
      .from('warehouse_operators')
      .select('*')
      .order('operator_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching warehouse operators:', error);
    return [];
  }
}

/**
 * Suggest the best warehouse operator for an order
 */
export async function suggestWarehouseOperator(
  orderItems: any[],
  deliveryDate: Date,
  priorityLevel: number = 5
): Promise<OrderAssignmentSuggestion | null> {
  try {
    // Get all operators
    const operators = await getWarehouseOperators();
    
    if (operators.length === 0) {
      throw new Error('No warehouse operators found');
    }

    // Analyze order requirements
    const orderCategories = analyzeOrderCategories(orderItems);

    // Calculate scores for each operator
    const scoredOperators = operators.map(operator => {
      const { score, reasons } = calculateOperatorScore(
        operator,
        orderCategories,
        deliveryDate,
        priorityLevel
      );
      
      return {
        operator,
        score,
        reasons
      };
    }).filter(item => item.score > 0); // Remove unavailable operators

    if (scoredOperators.length === 0) {
      throw new Error('No available warehouse operators found');
    }

    // Sort by score (highest first)
    scoredOperators.sort((a, b) => b.score - a.score);

    const bestMatch = scoredOperators[0];
    const alternatives = scoredOperators.slice(1, 4); // Top 3 alternatives

    // Calculate confidence based on score difference
    const maxPossibleScore = 100 + 100 + 40 + 120 + 50 + 40; // rough maximum
    const confidence = Math.min(95, (bestMatch.score / maxPossibleScore) * 100);

    return {
      suggested_operator_id: bestMatch.operator.id,
      suggested_operator: bestMatch.operator,
      suggestion_reason: bestMatch.reasons.join(', '),
      suggestion_confidence: Math.round(confidence),
      alternative_operators: alternatives.map(alt => alt.operator)
    };

  } catch (error) {
    console.error('Error suggesting warehouse operator:', error);
    return null;
  }
}

/**
 * Create order assignment with suggestion
 */
export async function createOrderAssignment(
  orderId: string,
  suggestion: OrderAssignmentSuggestion
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('order_assignments')
      .insert({
        order_id: orderId,
        suggested_operator_id: suggestion.suggested_operator_id,
        suggested_by: 'AI_ALGORITHM',
        suggestion_reason: suggestion.suggestion_reason,
        suggestion_confidence: suggestion.suggestion_confidence,
        status: 'pending_manager_review'
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error creating order assignment:', error);
    return null;
  }
}

/**
 * Update operator workload when assignment is created/completed
 */
export async function updateOperatorWorkload(
  operatorId: string,
  increment: boolean = true
): Promise<void> {
  try {
    const { data: operator, error: fetchError } = await supabase
      .from('warehouse_operators')
      .select('current_workload')
      .eq('id', operatorId)
      .single();

    if (fetchError) throw fetchError;

    const newWorkload = increment 
      ? (operator.current_workload || 0) + 1 
      : Math.max(0, (operator.current_workload || 0) - 1);

    const { error: updateError } = await supabase
      .from('warehouse_operators')
      .update({ 
        current_workload: newWorkload,
        updated_at: new Date().toISOString()
      })
      .eq('id', operatorId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error updating operator workload:', error);
  }
}

/**
 * Get operator suggestions with detailed analytics for warehouse manager
 */
export async function getOrderAssignmentDetails(orderId: string) {
  try {
    const { data, error } = await supabase
      .from('order_assignments')
      .select(`
        *,
        suggested_operator:warehouse_operators!suggested_operator_id(*),
        assigned_operator:warehouse_operators!assigned_operator_id(*),
        order:orders(*)
      `)
      .eq('order_id', orderId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching assignment details:', error);
    return null;
  }
}