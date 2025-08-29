// app/(sales)/profile.tsx - User Profile Screen
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface SalesStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  avgOrderValue: number;
  proposalsSent: number;
  proposalsAccepted: number;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<SalesStats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    avgOrderValue: 0,
    proposalsSent: 0,
    proposalsAccepted: 0,
  });
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    lowStock: true,
    newCustomers: false,
    dailySummary: true,
  });

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile({
        id: user.id,
        email: user.email || '',
        full_name: data?.full_name || user.email?.split('@')[0] || 'User',
        role: data?.role || 'sales_agent',
        created_at: user.created_at,
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch total orders and revenue
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, customer_id')
        .eq('sales_agent_id', user.id)
        .in('status', ['confirmed', 'delivered', 'paid']);

      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const uniqueCustomers = new Set(orders?.map(o => o.customer_id)).size;

      // Fetch proposals
      const { data: proposals } = await supabase
        .from('orders')
        .select('proposal_sent, proposal_accepted')
        .eq('sales_agent_id', user.id)
        .eq('order_type', 'proposal');

      const proposalsSent = proposals?.filter(p => p.proposal_sent).length || 0;
      const proposalsAccepted = proposals?.filter(p => p.proposal_accepted).length || 0;

      setStats({
        totalOrders: orders?.length || 0,
        totalRevenue,
        totalCustomers: uniqueCustomers,
        avgOrderValue: orders?.length ? totalRevenue / orders.length : 0,
        proposalsSent,
        proposalsAccepted,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login' as any);
          },
        },
      ]
    );
  };

  const MenuSection = ({ 
    title, 
    items 
  }: { 
    title: string; 
    items: Array<{
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      value?: string;
      onPress?: () => void;
      showArrow?: boolean;
    }>;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.menuItem}
          onPress={item.onPress}
          disabled={!item.onPress}
        >
          <View style={styles.menuItemLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon} size={20} color="#666" />
            </View>
            <Text style={styles.menuItemLabel}>{item.label}</Text>
          </View>
          {item.value && (
            <Text style={styles.menuItemValue}>{item.value}</Text>
          )}
          {item.showArrow && (
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.profileName}>{profile?.full_name}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile?.role === 'sales_agent' ? 'Sales Agent' : 
               profile?.role === 'sales_manager' ? 'Sales Manager' : 
               profile?.role}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              ${(stats.totalRevenue / 1000).toFixed(1)}k
            </Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalCustomers}</Text>
            <Text style={styles.statLabel}>Customers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.proposalsAccepted}/{stats.proposalsSent}
            </Text>
            <Text style={styles.statLabel}>Proposals</Text>
          </View>
        </View>

        {/* Account Settings */}
        <MenuSection
          title="Account"
          items={[
            {
              icon: 'person-outline',
              label: 'Edit Profile',
              showArrow: true,
              onPress: () => Alert.alert('Coming Soon', 'Profile editing will be available soon'),
            },
            {
              icon: 'lock-closed-outline',
              label: 'Change Password',
              showArrow: true,
              onPress: () => Alert.alert('Coming Soon', 'Password change will be available soon'),
            },
            {
              icon: 'card-outline',
              label: 'Commission Plan',
              value: 'Standard',
              showArrow: true,
              onPress: () => Alert.alert('Commission Plan', 'Tobacco: 5%\nNon-Tobacco: 10%'),
            },
          ]}
        />

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.switchItem}>
            <View style={styles.switchItemLeft}>
              <Ionicons name="cart-outline" size={20} color="#666" />
              <Text style={styles.switchLabel}>Order Updates</Text>
            </View>
            <Switch
              value={notifications.orderUpdates}
              onValueChange={(value) => 
                setNotifications(prev => ({ ...prev, orderUpdates: value }))
              }
              trackColor={{ false: '#E0E0E0', true: '#FFB3B3' }}
              thumbColor={notifications.orderUpdates ? '#E74C3C' : '#FFF'}
            />
          </View>

          <View style={styles.switchItem}>
            <View style={styles.switchItemLeft}>
              <Ionicons name="warning-outline" size={20} color="#666" />
              <Text style={styles.switchLabel}>Low Stock Alerts</Text>
            </View>
            <Switch
              value={notifications.lowStock}
              onValueChange={(value) => 
                setNotifications(prev => ({ ...prev, lowStock: value }))
              }
              trackColor={{ false: '#E0E0E0', true: '#FFB3B3' }}
              thumbColor={notifications.lowStock ? '#E74C3C' : '#FFF'}
            />
          </View>

          <View style={styles.switchItem}>
            <View style={styles.switchItemLeft}>
              <Ionicons name="people-outline" size={20} color="#666" />
              <Text style={styles.switchLabel}>New Customers</Text>
            </View>
            <Switch
              value={notifications.newCustomers}
              onValueChange={(value) => 
                setNotifications(prev => ({ ...prev, newCustomers: value }))
              }
              trackColor={{ false: '#E0E0E0', true: '#FFB3B3' }}
              thumbColor={notifications.newCustomers ? '#E74C3C' : '#FFF'}
            />
          </View>

          <View style={styles.switchItem}>
            <View style={styles.switchItemLeft}>
              <Ionicons name="today-outline" size={20} color="#666" />
              <Text style={styles.switchLabel}>Daily Summary</Text>
            </View>
            <Switch
              value={notifications.dailySummary}
              onValueChange={(value) => 
                setNotifications(prev => ({ ...prev, dailySummary: value }))
              }
              trackColor={{ false: '#E0E0E0', true: '#FFB3B3' }}
              thumbColor={notifications.dailySummary ? '#E74C3C' : '#FFF'}
            />
          </View>
        </View>

        {/* Support */}
        <MenuSection
          title="Support"
          items={[
            {
              icon: 'help-circle-outline',
              label: 'Help Center',
              showArrow: true,
              onPress: () => Alert.alert('Help', 'Contact support@sevenstars.com'),
            },
            {
              icon: 'document-text-outline',
              label: 'Terms & Conditions',
              showArrow: true,
              onPress: () => Alert.alert('Terms', 'Terms and conditions'),
            },
            {
              icon: 'shield-checkmark-outline',
              label: 'Privacy Policy',
              showArrow: true,
              onPress: () => Alert.alert('Privacy', 'Privacy policy'),
            },
          ]}
        />

        {/* App Info */}
        <MenuSection
          title="About"
          items={[
            {
              icon: 'information-circle-outline',
              label: 'App Version',
              value: '1.0.0',
            },
            {
              icon: 'git-branch-outline',
              label: 'Build',
              value: '2025.1.1',
            },
          ]}
        />

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => router.push('/(sales)/manager' as any)}
        >
          <Ionicons name="home-outline" size={24} color="#666" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => router.push('/(sales)/products' as any)}
        >
          <Ionicons name="cube-outline" size={24} color="#666" />
          <Text style={styles.tabLabel}>Products</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => router.push('/(sales)/cart' as any)}
        >
          <Ionicons name="cart-outline" size={24} color="#666" />
          <Text style={styles.tabLabel}>Cart</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => router.push('/(sales)/past-orders' as any)}
        >
          <Ionicons name="receipt-outline" size={24} color="#666" />
          <Text style={styles.tabLabel}>Orders</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="person" size={24} color="#E74C3C" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#FFF',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E74C3C',
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 1,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  menuItemValue: {
    fontSize: 14,
    color: '#999',
    marginRight: 8,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  switchItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    color: '#333',
    marginLeft: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginTop: 20,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 100,
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
});