import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function OutgoingTab() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.placeholderContainer}>
        <Ionicons name="arrow-up-outline" size={64} color="#CCC" />
        <Text style={styles.placeholderTitle}>Outgoing Orders</Text>
        <Text style={styles.placeholderText}>
          This section will display orders placed by sales agents that need to be prepared and shipped.
        </Text>
        
        <View style={styles.featureList}>
          <Text style={styles.featureTitle}>Coming Soon:</Text>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>View pending orders from sales agents</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Pick and pack items for shipment</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Mark orders as ready for delivery</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Print shipping labels and invoices</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#666" />
            <Text style={styles.featureText}>Track order fulfillment status</Text>
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