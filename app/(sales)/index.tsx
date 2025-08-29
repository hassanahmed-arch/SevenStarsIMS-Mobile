// app/(sales)/index.tsx - Sales Manager Home Dashboard (renamed from manager/index.tsx)
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface DashboardMetrics {
  todayOrders: number;
  weekOrders: number;
  monthRevenue: number;
  pendingProposals: number;
  outstandingInvoices: number;
  lowStockItems: number;
}

interface QuickAction {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  badge?: number;
}

export default function SalesHomeScreen() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todayOrders: 0,
    weekOrders: 0,
    monthRevenue: 0,
    pendingProposals: 0,
    outstandingInvoices: 0,
    lowStockItems: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetchUserData();
    fetchDashboardMetrics();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        setUserName(profile?.full_name || user.email?.split('@')[0] || 'Sales Manager');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchDashboardMetrics = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Fetch today's orders
      const { data: todayOrdersData } = await supabase
        .from('orders')
        .select('id')
        .eq('sales_agent_id', user.id)
        .gte('created_at', today.toISOString())
        .not('status', 'eq', 'cancelled');

      // Fetch week's orders
      const { data: weekOrdersData } = await supabase
        .from('orders')
        .select('id')
        .eq('sales_agent_id', user.id)
        .gte('created_at', weekAgo.toISOString())
        .not('status', 'eq', 'cancelled');

      // Fetch month's revenue
      const { data: monthRevenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('sales_agent_id', user.id)
        .gte('created_at', monthStart.toISOString())
        .in('status', ['confirmed', 'delivered', 'paid']);

      // Fetch pending proposals
      const { data: proposalsData } = await supabase
        .from('orders')
        .select('id')
        .eq('sales_agent_id', user.id)
        .eq('order_type', 'proposal')
        .eq('proposal_accepted', false)
        .gte('created_at', weekAgo.toISOString());

      // Fetch outstanding invoices
      const { data: invoicesData } = await supabase
        .from('orders')
        .select('id')
        .eq('sales_agent_id', user.id)
        .eq('invoice_sent', true)
        .neq('status', 'paid');

      // Fetch low stock items
      const { data: lowStockData } = await supabase
        .from('products')
        .select('id')
        .lt('quantity', 'min_stock_level');

      const monthTotal = monthRevenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

      setMetrics({
        todayOrders: todayOrdersData?.length || 0,
        weekOrders: weekOrdersData?.length || 0,
        monthRevenue: monthTotal,
        pendingProposals: proposalsData?.length || 0,
        outstandingInvoices: invoicesData?.length || 0,
        lowStockItems: lowStockData?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      id: 'new-order',
      title: 'New Order',
      icon: 'cart',
      color: '#E74C3C',
      route: '/(sales)/new-order/select-customer',
    },
    {
      id: 'new-proposal',
      title: 'New Proposal',
      icon: 'document-text',
      color: '#E74C3C',
      route: '/(sales)/new-proposal/select-customer',
    },
    {
      id: 'new-customer',
      title: 'New Customer',
      icon: 'person-add',
      color: '#E74C3C',
      route: '/(sales)/new-customer',
    },
    {
      id: 'past-orders',
      title: 'Past Orders',
      icon: 'time',
      color: '#E74C3C',
      route: '/(sales)/past-orders',
      badge: metrics.weekOrders,
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: 'analytics',
      color: '#E74C3C',
      route: '/(sales)/analytics',
    },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login' as any);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchDashboardMetrics(true)}
            colors={['#E74C3C']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <Ionicons name="log-out-outline" size={24} color="#ffffffff" />
          </TouchableOpacity>
        </View>

        {/* Metrics Cards */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricRow}>
            <View style={[styles.metricCard, styles.metricCardPrimary]}>
              <View style={styles.metricIconContainer}>
                <Ionicons name="cash-outline" size={24} color="#FFF" />
              </View>
              <Text style={styles.metricValueLight}>
                ${metrics.monthRevenue.toLocaleString()}
              </Text>
              <Text style={styles.metricLabelLight}>Month Revenue</Text>
            </View>
            
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Ionicons name="cart-outline" size={24} color="#E74C3C"/>
                <Text style={styles.metricValue}>{metrics.todayOrders}</Text>
              </View>
              <Text style={styles.metricLabel}>Today's Orders</Text>
            </View>

            
          </View>
          

          


          {metrics.lowStockItems > 0 && (
            <TouchableOpacity 
              style={styles.alertCard}
              onPress={() => router.push('/(sales)/products' as any)}
            >
              <Ionicons name="warning" size={20} color="#E74C3C" />
              <Text style={styles.alertText}>
                {metrics.lowStockItems} products are running low on stock
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#E74C3C" />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionCard}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${action.color}15` }]}>
                  <Ionicons name={action.icon} size={28} color={action.color} />
                  {action.badge && action.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{action.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentContainer}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(sales)/past-orders' as any)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.recentCard}>
            <Text style={styles.recentEmptyText}>
              Your recent orders will appear here
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000ff',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000ff',
  },
  greeting: {
    fontSize: 14,
    color: '#ffffffff',
  },
  userName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffffff',
    marginTop: 4,
  },
  signOutButton: {
    padding: 8,
  },
  metricsContainer: {
    padding: 20,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  metricCardPrimary: {
    backgroundColor: '#E74C3C',
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  metricValueLight: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#666',
  },
  metricLabelLight: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.9,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    marginHorizontal: 10,
  },
  actionsContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
 actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '31%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionTitle: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  recentContainer: {
    padding: 20,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '500',
  },
  recentCard: {
    backgroundColor: '#FFF',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEmptyText: {
    fontSize: 14,
    color: '#999',
  },
});