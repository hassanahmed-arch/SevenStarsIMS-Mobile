import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function AuditTab() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.placeholderContainer}>
        <Ionicons name="clipboard-outline" size={64} color="#CCC" />
        <Text style={styles.placeholderTitle}>Inventory Audit</Text>
        <Text style={styles.placeholderText}>
          This section will provide tools for conducting physical inventory counts and reconciliation.
        </Text>
        
        <View style={styles.featureList}>
          <Text style={styles.featureTitle}>Coming Soon:</Text>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Schedule and conduct inventory audits</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Scan items for physical count verification</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Identify discrepancies and missing items</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Generate audit reports and adjustments</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Track inventory accuracy metrics</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    paddingTop: 60,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  featureList: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
});