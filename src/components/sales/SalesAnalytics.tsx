// src/components/sales/SalesAnalytics.tsx - Fixed errors
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../../lib/supabase';

interface SalesAnalyticsProps {
  salesAgentId: string;
}

interface MonthlyData {
  month: string;
  total: number;
  orderCount: number;
}

interface TopCustomer {
  customer_id: string;
  customer_name: string;
  total_sales: number;
  order_count: number;
}

interface DiscountData {
  total_orders: number;
  orders_with_discount: number;
  total_discount_amount: number;
  average_discount_percentage: number;
}

interface CommissionData {
  tobacco_sales: number;
  non_tobacco_sales: number;
  tobacco_commission: number;
  non_tobacco_commission: number;
  total_commission: number;
  commission_rate_tobacco: number;
  commission_rate_non_tobacco: number;
}

const screenWidth = Dimensions.get('window').width;

export default function SalesAnalytics({ salesAgentId }: SalesAnalyticsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [discountData, setDiscountData] = useState<DiscountData | null>(null);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null);
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    // Only fetch if we have a valid salesAgentId (not undefined or "undefined")
    if (salesAgentId && salesAgentId !== 'undefined') {
      fetchAnalytics();
    } else {
      console.error('Invalid salesAgentId:', salesAgentId);
      setIsLoading(false);
    }
  }, [salesAgentId, selectedPeriod]);

  const fetchAnalytics = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      await Promise.all([
        fetchMonthlySales(),
        fetchTopCustomers(),
        fetchDiscountAnalytics(),
        fetchAverageOrderValue(),
        fetchCommissionData(),
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchMonthlySales = async () => {
    try {
      // Get date range based on selected period
      const endDate = new Date();
      const startDate = new Date();
      
      if (selectedPeriod === 'month') {
        startDate.setMonth(startDate.getMonth() - 6); // Last 6 months
      } else if (selectedPeriod === 'quarter') {
        startDate.setMonth(startDate.getMonth() - 12); // Last 4 quarters
      } else {
        startDate.setFullYear(startDate.getFullYear() - 3); // Last 3 years
      }

      const { data, error } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('sales_agent_id', salesAgentId)
        .in('status', ['confirmed', 'delivered', 'paid']) // Only count confirmed orders
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Process data by period
      const processedData: { [key: string]: { total: number; count: number } } = {};
      let total = 0;

      data?.forEach(order => {
        const date = new Date(order.created_at);
        let key: string;

        if (selectedPeriod === 'month') {
          key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        } else if (selectedPeriod === 'quarter') {
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `Q${quarter} ${date.getFullYear()}`;
        } else {
          key = date.getFullYear().toString();
        }

        if (!processedData[key]) {
          processedData[key] = { total: 0, count: 0 };
        }

        processedData[key].total += order.total_amount;
        processedData[key].count += 1;
        total += order.total_amount;
      });

      const formattedData = Object.entries(processedData).map(([month, data]) => ({
        month,
        total: data.total,
        orderCount: data.count,
      }));

      setMonthlyData(formattedData);
      setTotalSales(total);
    } catch (error) {
      console.error('Error fetching monthly sales:', error);
    }
  };

  const fetchTopCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          customer_id,
          total_amount,
          customer:customers(name)
        `)
        .eq('sales_agent_id', salesAgentId)
        .in('status', ['confirmed', 'delivered', 'paid']);

      if (error) throw error;

      // Aggregate by customer
      const customerMap: { [key: string]: { name: string; total: number; count: number } } = {};

      data?.forEach(order => {
        const customerId = order.customer_id;
        if (!customerMap[customerId]) {
          // Type assertion to handle the nested customer object
          const customerData = order.customer as { name: string } | any; // I changed this from any to NULL
          customerMap[customerId] = {
            name: customerData?.name || 'Unknown',
            total: 0,
            count: 0,
          };
        }
        customerMap[customerId].total += order.total_amount;
        customerMap[customerId].count += 1;
      });

      // Convert to array and sort by total sales
      const sorted = Object.entries(customerMap)
        .map(([id, data]) => ({
          customer_id: id,
          customer_name: data.name,
          total_sales: data.total,
          order_count: data.count,
        }))
        .sort((a, b) => b.total_sales - a.total_sales)
        .slice(0, 10); // Top 10

      setTopCustomers(sorted);
    } catch (error) {
      console.error('Error fetching top customers:', error);
    }
  };

  const fetchDiscountAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('discount_amount, total_amount, subtotal')
        .eq('sales_agent_id', salesAgentId)
        .in('status', ['confirmed', 'delivered', 'paid']);

      if (error) throw error;

      const totalOrders = data?.length || 0;
      const ordersWithDiscount = data?.filter(o => (o.discount_amount || 0) > 0).length || 0;
      const totalDiscountAmount = data?.reduce((sum, o) => sum + (o.discount_amount || 0), 0) || 0;
      
      const avgDiscountPercentage = data
        ?.filter(o => (o.discount_amount || 0) > 0)
        .reduce((sum, o) => {
          const percentage = ((o.discount_amount || 0) / (o.subtotal || 1)) * 100;
          return sum + percentage;
        }, 0) || 0;

      setDiscountData({
        total_orders: totalOrders,
        orders_with_discount: ordersWithDiscount,
        total_discount_amount: totalDiscountAmount,
        average_discount_percentage: ordersWithDiscount > 0 ? avgDiscountPercentage / ordersWithDiscount : 0,
      });
    } catch (error) {
      console.error('Error fetching discount analytics:', error);
    }
  };

  const fetchAverageOrderValue = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('sales_agent_id', salesAgentId)
        .in('status', ['confirmed', 'delivered', 'paid']);

      if (error) throw error;

      const total = data?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
      const count = data?.length || 1;
      
      setAverageOrderValue(total / count);
    } catch (error) {
      console.error('Error fetching average order value:', error);
    }
  };

  const fetchCommissionData = async () => {
    try {
      // Get current month's orders with items
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          items:order_items(
            product_id,
            total_price
          )
        `)
        .eq('sales_agent_id', salesAgentId)
        .in('status', ['confirmed', 'delivered', 'paid'])
        .gte('created_at', startOfMonth.toISOString());

      if (ordersError) throw ordersError;

      // Get product details to check if tobacco
      let tobaccoSales = 0;
      let nonTobaccoSales = 0;

      for (const order of (orders || [])) {
        const orderItems = order.items as Array<{ product_id: string; total_price: number }> || [];
        
        for (const item of orderItems) {
          if (item.product_id) {
            const { data: product } = await supabase
              .from('products')
              .select('is_tobacco')
              .eq('id', item.product_id)
              .single();

            if (product?.is_tobacco) {
              tobaccoSales += item.total_price;
            } else {
              nonTobaccoSales += item.total_price;
            }
          }
        }
      }

      // Get commission plan (assuming default rates if not found)
      const { data: commissionPlan } = await supabase
        .from('commission_plans')
        .select('tobacco_rate, non_tobacco_rate')
        .single();

      const tobaccoRate = (commissionPlan?.tobacco_rate || 5) / 100;
      const nonTobaccoRate = (commissionPlan?.non_tobacco_rate || 10) / 100;

      setCommissionData({
        tobacco_sales: tobaccoSales,
        non_tobacco_sales: nonTobaccoSales,
        tobacco_commission: tobaccoSales * tobaccoRate,
        non_tobacco_commission: nonTobaccoSales * nonTobaccoRate,
        total_commission: (tobaccoSales * tobaccoRate) + (nonTobaccoSales * nonTobaccoRate),
        commission_rate_tobacco: tobaccoRate * 100,
        commission_rate_non_tobacco: nonTobaccoRate * 100,
      });
    } catch (error) {
      console.error('Error fetching commission data:', error);
    }
  };

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#E74C3C',
    },
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E74C3C" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchAnalytics(true)}
          colors={['#E74C3C']}
        />
      }
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['month', 'quarter', 'year'] as const).map(period => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.periodButtonTextActive
            ]}>
              {period === 'month' ? 'Monthly' : period === 'quarter' ? 'Quarterly' : 'Yearly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total Sales Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="trending-up" size={24} color="#E74C3C" />
          <Text style={styles.summaryTitle}>Sales Overview</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Sales</Text>
            <Text style={styles.summaryValue}>${totalSales.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg Order Value</Text>
            <Text style={styles.summaryValue}>${averageOrderValue.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Sales Chart */}
      {monthlyData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Sales Trend</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={{
                labels: monthlyData.map(d => d.month),
                datasets: [{
                  data: monthlyData.map(d => d.total),
                }],
              }}
              width={Math.max(screenWidth - 40, monthlyData.length * 80)}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={true}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              withDots={true}
              formatYLabel={(value) => `$${parseInt(value).toLocaleString()}`}
            />
          </ScrollView>
        </View>
      )}

      {/* Top Customers */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="people-outline" size={24} color="#E74C3C" />
          <Text style={styles.cardTitle}>Top 10 Customers</Text>
        </View>
        {topCustomers.length > 0 ? (
          topCustomers.map((customer, index) => (
            <View key={customer.customer_id} style={styles.customerRow}>
              <View style={styles.customerRank}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customer.customer_name}</Text>
                <Text style={styles.customerStats}>
                  {customer.order_count} orders
                </Text>
              </View>
              <Text style={styles.customerSales}>${customer.total_sales.toFixed(2)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No customer data available</Text>
        )}
      </View>

      {/* Discount Analytics */}
      {discountData && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="pricetag-outline" size={24} color="#E74C3C" />
            <Text style={styles.cardTitle}>Discount Analytics</Text>
          </View>
          <View style={styles.discountGrid}>
            <View style={styles.discountItem}>
              <Text style={styles.discountValue}>
                {discountData.total_orders > 0 
                  ? ((discountData.orders_with_discount / discountData.total_orders) * 100).toFixed(1)
                  : '0'}%
              </Text>
              <Text style={styles.discountLabel}>Orders with Discount</Text>
            </View>
            <View style={styles.discountItem}>
              <Text style={styles.discountValue}>
                {discountData.average_discount_percentage.toFixed(1)}%
              </Text>
              <Text style={styles.discountLabel}>Avg Discount %</Text>
            </View>
          </View>
          <View style={styles.discountSummary}>
            <Text style={styles.discountSummaryText}>
              Total Discounts Given: ${discountData.total_discount_amount.toFixed(2)}
            </Text>
            <Text style={styles.discountImpact}>
              Impact on Margins: -{totalSales > 0 
                ? ((discountData.total_discount_amount / totalSales) * 100).toFixed(2)
                : '0'}%
            </Text>
          </View>
        </View>
      )}

      {/* Commission Calculator */}
      {commissionData && (
        <View style={styles.commissionCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash-outline" size={24} color="#27AE60" />
            <Text style={styles.cardTitle}>Commission (Current Month)</Text>
          </View>
          
          <View style={styles.commissionBreakdown}>
            <View style={styles.commissionRow}>
              <View style={styles.commissionCategory}>
                <Text style={styles.commissionLabel}>Tobacco Sales</Text>
                <Text style={styles.commissionRate}>({commissionData.commission_rate_tobacco}%)</Text>
              </View>
              <View style={styles.commissionValues}>
                <Text style={styles.commissionSales}>${commissionData.tobacco_sales.toFixed(2)}</Text>
                <Text style={styles.commissionAmount}>+${commissionData.tobacco_commission.toFixed(2)}</Text>
              </View>
            </View>
            
            <View style={styles.commissionRow}>
              <View style={styles.commissionCategory}>
                <Text style={styles.commissionLabel}>Non-Tobacco Sales</Text>
                <Text style={styles.commissionRate}>({commissionData.commission_rate_non_tobacco}%)</Text>
              </View>
              <View style={styles.commissionValues}>
                <Text style={styles.commissionSales}>${commissionData.non_tobacco_sales.toFixed(2)}</Text>
                <Text style={styles.commissionAmount}>+${commissionData.non_tobacco_commission.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.commissionTotal}>
            <Text style={styles.commissionTotalLabel}>Total Commission</Text>
            <Text style={styles.commissionTotalValue}>${commissionData.total_commission.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {/* Order Value Trend */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Ionicons name="analytics-outline" size={24} color="#3498DB" />
          <Text style={styles.insightTitle}>Pricing Insights</Text>
        </View>
        <Text style={styles.insightText}>
          Your average order value is ${averageOrderValue.toFixed(2)}
        </Text>
        <Text style={styles.insightSubtext}>
          {averageOrderValue > 500 
            ? '✅ You are maintaining healthy order values'
            : '⚠️ Consider upselling to increase order values'}
        </Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: '#F5F5F5',
  },
  periodButtonActive: {
    backgroundColor: '#E74C3C',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
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
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  customerRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E74C3C',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  customerStats: {
    fontSize: 12,
    color: '#666',
  },
  customerSales: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  discountGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  discountItem: {
    alignItems: 'center',
  },
  discountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F39C12',
    marginBottom: 4,
  },
  discountLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  discountSummary: {
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  discountSummaryText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  discountImpact: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '500',
  },
  commissionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#27AE60',
  },
  commissionBreakdown: {
    marginBottom: 20,
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  commissionCategory: {
    flex: 1,
  },
  commissionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  commissionRate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  commissionValues: {
    alignItems: 'flex-end',
  },
  commissionSales: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  commissionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27AE60',
  },
  commissionTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: '#27AE60',
  },
  commissionTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  commissionTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  insightCard: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  insightSubtext: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 30,
  },
});