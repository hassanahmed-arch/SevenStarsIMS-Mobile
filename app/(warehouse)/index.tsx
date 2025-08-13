// app/(warehouse)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

// Import tab components from src folder
import AuditTab from '../../src/components/warehouse/AuditTab';
import IncomingTab from '../../src/components/warehouse/IncomingTab';
import OutgoingTab from '../../src/components/warehouse/OutgoingTab';

type TabType = 'incoming' | 'outgoing' | 'audit';

export default function WarehouseOperatorDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
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
          setUserName(user.email?.split('@')[0] || 'Operator');
        }
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    } finally {
      setIsLoading(false);
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

  const getTabIcon = (tab: TabType): string => {
    switch (tab) {
      case 'incoming':
        return 'arrow-down-outline';
      case 'outgoing':
        return 'arrow-up-outline';
      case 'audit':
        return 'clipboard-outline';
      default:
        return 'cube-outline';
    }
  };

  const getTabIconActive = (tab: TabType): string => {
    switch (tab) {
      case 'incoming':
        return 'arrow-down-outline';
      case 'outgoing':
        return 'arrow-up-outline';
      case 'audit':
        return 'clipboard-outline';
      default:
        return 'cube';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'incoming':
        return <IncomingTab />;
      case 'outgoing':
        return <OutgoingTab />;
      case 'audit':
        return <AuditTab />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E74C3C" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
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
        <Text style={styles.roleText}>Warehouse Operator</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'incoming' && styles.activeTab]}
          onPress={() => setActiveTab('incoming')}
        >
          <Ionicons
            name={activeTab === 'incoming' ? getTabIconActive('incoming') : getTabIcon('incoming') as any}
            size={20}
            color={activeTab === 'incoming' ? '#E74C3C' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'incoming' && styles.activeTabText]}>
            Incoming
          </Text>
          <View style={[styles.tabIndicator, activeTab === 'incoming' && styles.activeTabIndicator]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'outgoing' && styles.activeTab]}
          onPress={() => setActiveTab('outgoing')}
        >
          <Ionicons
            name={activeTab === 'outgoing' ? getTabIconActive('outgoing') : getTabIcon('outgoing') as any}
            size={20}
            color={activeTab === 'outgoing' ? '#E74C3C' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'outgoing' && styles.activeTabText]}>
            Outgoing
          </Text>
          <View style={[styles.tabIndicator, activeTab === 'outgoing' && styles.activeTabIndicator]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'audit' && styles.activeTab]}
          onPress={() => setActiveTab('audit')}
        >
          <Ionicons
            name={activeTab === 'audit' ? getTabIconActive('audit') : getTabIcon('audit') as any}
            size={20}
            color={activeTab === 'audit' ? '#E74C3C' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'audit' && styles.activeTabText]}>
            Audit
          </Text>
          <View style={[styles.tabIndicator, activeTab === 'audit' && styles.activeTabIndicator]} />
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  roleText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 5,
  },
  logoutButton: {
    padding: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#E74C3C',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: 'transparent',
    borderRadius: 2,
  },
  activeTabIndicator: {
    backgroundColor: '#E74C3C',
  },
  content: {
    flex: 1,
  },
});