// src/services/warehouseOrderService.ts
import { supabase } from '../lib/supabase';

export interface AssignedOrder {
  id: string;
  order_id: string;
  order: {
    id: string;
    order_number: string;
    delivery_date: string;
    delivery_time: string;
    total_amount: number;
    priority_level: number;
    customer: {
      name: string;
    };
  } | null;
  suggested_operator: {
    operator_name: string;
  } | null;
  assigned_operator?: {
    operator_name: string;
  } | null;
  status: string;
  work_started_at: string | null;
  work_completed_at: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  stock_status: string;
}

/**
 * Get all orders assigned to a specific warehouse operator
 */
export async function getAssignedOrders(operatorUserId: string): Promise<AssignedOrder[]> {
  try {
    // First get the warehouse operator record
    const { data: operator, error: operatorError } = await supabase
      .from('warehouse_operators')
      .select('id')
      .eq('user_id', operatorUserId)
      .single();

    if (operatorError || !operator) {
      console.error('Operator not found:', operatorError);
      return [];
    }

    // Get all order assignments for this operator
    const { data: assignments, error } = await supabase
      .from('order_assignments')
      .select(`
        id,
        order_id,
        status,
        work_started_at,
        work_completed_at,
        created_at,
        order:orders(
          id,
          order_number,
          delivery_date,
          delivery_time,
          total_amount,
          priority_level,
          customer:customers(name)
        ),
        suggested_operator:warehouse_operators!suggested_operator_id(operator_name),
        assigned_operator:warehouse_operators!assigned_operator_id(operator_name)
      `)
      .or(`suggested_operator_id.eq.${operator.id},assigned_operator_id.eq.${operator.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (assignments as unknown as AssignedOrder[]) || [];
  } catch (error) {
    console.error('Error fetching assigned orders:', error);
    return [];
  }
}

/**
 * Get order items for a specific order
 */
export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  try {
    const { data: items, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('product_name');

    if (error) throw error;
    return items || [];
  } catch (error) {
    console.error('Error fetching order items:', error);
    return [];
  }
}

/**
 * Start working on an order (operator pressed "Start")
 */
export async function startOrder(assignmentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('order_assignments')
      .update({
        status: 'in_progress',
        work_started_at: new Date().toISOString()
      })
      .eq('id', assignmentId);

    if (error) throw error;

    // Also update the order status
    const { data: assignment } = await supabase
      .from('order_assignments')
      .select('order_id')
      .eq('id', assignmentId)
      .single();

    if (assignment) {
      await supabase
        .from('orders')
        .update({ warehouse_status: 'in_progress' })
        .eq('id', assignment.order_id);
    }

    return true;
  } catch (error) {
    console.error('Error starting order:', error);
    return false;
  }
}

/**
 * Complete an order (operator pressed "Order Fulfilled")
 */
export async function completeOrder(assignmentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('order_assignments')
      .update({
        status: 'completed',
        work_completed_at: new Date().toISOString()
      })
      .eq('id', assignmentId);

    if (error) throw error;

    // Also update the order status
    const { data: assignment } = await supabase
      .from('order_assignments')
      .select('order_id')
      .eq('id', assignmentId)
      .single();

    if (assignment) {
      await supabase
        .from('orders')
        .update({ warehouse_status: 'completed' })
        .eq('id', assignment.order_id);
    }

    return true;
  } catch (error) {
    console.error('Error completing order:', error);
    return false;
  }
}

/**
 * Calculate work duration for performance tracking
 */
export function calculateWorkDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const diffMs = end.getTime() - start.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get priority level display text
 */
export function getPriorityText(level: number): string {
  if (level >= 9) return 'URGENT';
  if (level >= 7) return 'HIGH';
  if (level >= 6) return 'MEDIUM';
  return 'NORMAL';
}

/**
 * Get priority color
 */
export function getPriorityColor(level: number): string {
  if (level >= 9) return '#E74C3C';
  if (level >= 7) return '#F39C12';
  if (level >= 6) return '#3498DB';
  return '#27AE60';
}