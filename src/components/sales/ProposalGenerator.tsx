// src/components/sales/ProposalGenerator.tsx

import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface ProposalGeneratorProps {
  orderId: string; // Not used for proposals, but kept for interface compatibility
  customer: any;
  items: any[];
  orderSummary: {
    subtotal: number;
    tax: number;
    total: number;
  };
  orderData: any;
  onClose: () => void;
}

export default function ProposalGenerator({
  customer,
  items,
  orderSummary,
  orderData,
  onClose
}: ProposalGeneratorProps) {
  const [proposalNumber, setProposalNumber] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [proposalSent, setProposalSent] = useState(false);

  useEffect(() => {
    generateProposalNumber();
  }, []);

  const generateProposalNumber = () => {
    const date = new Date();
    const proposalNum = `PROP-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    setProposalNumber(proposalNum);
  };

  const generateProposalHTML = () => {
    const currentDate = new Date().toLocaleDateString();
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(); // Valid for 7 days

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Sales Proposal - ${proposalNumber}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f8f9fa;
          color: #333;
        }
        .proposal-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #E74C3C, #C0392B);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 2.2em;
          font-weight: 300;
        }
        .proposal-number {
          font-size: 1.1em;
          opacity: 0.9;
          margin-top: 10px;
        }
        .content {
          padding: 30px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section h2 {
          color: #E74C3C;
          border-bottom: 2px solid #E74C3C;
          padding-bottom: 10px;
          margin-bottom: 20px;
          font-size: 1.4em;
          font-weight: 600;
        }
        .customer-info {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #E74C3C;
        }
        .customer-info h3 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 1.3em;
        }
        .customer-details {
          line-height: 1.6;
          color: #666;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        .items-table th {
          background-color: #E74C3C;
          color: white;
          padding: 15px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 0.95em;
        }
        .items-table td {
          padding: 15px 12px;
          border-bottom: 1px solid #eee;
          vertical-align: top;
        }
        .items-table tr:last-child td {
          border-bottom: none;
        }
        .items-table tr:nth-child(even) {
          background-color: #fafafa;
        }
        .price-cell {
          text-align: right;
          font-weight: 500;
        }
        .custom-price-note {
          color: #3498DB;
          font-size: 0.85em;
          font-style: italic;
        }
        .summary-section {
          background-color: #f8f9fa;
          padding: 25px;
          border-radius: 8px;
          margin-top: 20px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #ddd;
        }
        .summary-row:last-child {
          border-bottom: none;
          font-weight: bold;
          font-size: 1.2em;
          color: #E74C3C;
          margin-top: 10px;
          padding-top: 15px;
          border-top: 2px solid #E74C3C;
        }
        .terms-section {
          background-color: #fff3cd;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #ffc107;
        }
        .terms-section h3 {
          color: #856404;
          margin-top: 0;
        }
        .terms-list {
          list-style-type: none;
          padding: 0;
          color: #856404;
        }
        .terms-list li {
          padding: 5px 0;
          padding-left: 20px;
          position: relative;
        }
        .terms-list li:before {
          content: "•";
          color: #ffc107;
          font-weight: bold;
          position: absolute;
          left: 0;
        }
        .footer {
          background-color: #343a40;
          color: white;
          padding: 25px 30px;
          text-align: center;
        }
        .footer p {
          margin: 5px 0;
          opacity: 0.8;
        }
        .validity-notice {
          background-color: #d1ecf1;
          border-left: 4px solid #17a2b8;
          padding: 15px;
          margin-top: 20px;
          border-radius: 5px;
        }
        .validity-notice strong {
          color: #0c5460;
        }
        @media print {
          body { background-color: white; }
          .proposal-container { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="proposal-container">
        <div class="header">
          <h1>Sales Proposal</h1>
          <div class="proposal-number">${proposalNumber}</div>
        </div>
        
        <div class="content">
          <!-- Customer Information -->
          <div class="section">
            <h2>Customer Information</h2>
            <div class="customer-info">
              <h3>${customer.name}</h3>
              <div class="customer-details">
                <p><strong>Email:</strong> ${customer.email}</p>
                <p><strong>Phone:</strong> ${customer.phone}</p>
                <p><strong>Address:</strong> ${customer.address}, ${customer.city}, ${customer.state}</p>
                ${customer.customer_type ? `<p><strong>Customer Type:</strong> ${customer.customer_type}</p>` : ''}
              </div>
            </div>
          </div>

          <!-- Proposal Details -->
          <div class="section">
            <h2>Proposal Details</h2>
            <table class="items-table">
              <tr>
                <th style="width: 40%">Item Description</th>
                <th style="width: 15%">SKU</th>
                <th style="width: 15%">Quantity</th>
                <th style="width: 15%">Unit Price</th>
                <th style="width: 15%">Total</th>
              </tr>
              ${items.map(item => `
                <tr>
                  <td>
                    ${item.product_name}
                    ${item.using_customer_price ? '<div class="custom-price-note">*Special pricing applied</div>' : ''}
                  </td>
                  <td>${item.sku || '-'}</td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td class="price-cell">$${item.unit_price.toFixed(2)}</td>
                  <td class="price-cell">$${item.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </table>
            
            <div class="summary-section">
              <div class="summary-row">
                <span>Subtotal:</span>
                <span>$${orderSummary.subtotal.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span>Tax:</span>
                <span>$${orderSummary.tax.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span>Total:</span>
                <span>$${orderSummary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <!-- Terms and Conditions -->
          <div class="section">
            <div class="terms-section">
              <h3>Terms & Conditions</h3>
              <ul class="terms-list">
                <li>This proposal is valid until ${validUntil}</li>
                <li>Prices are subject to change without notice after expiry</li>
                <li>Payment terms: ${orderData.paymentType}</li>
                <li>Delivery type: ${orderData.orderType}</li>
                <li>All sales are subject to our standard terms and conditions</li>
              </ul>
            </div>
          </div>

          <div class="validity-notice">
            <strong>Note:</strong> This proposal is automatically generated and valid until ${validUntil}. 
            Please contact us to confirm your order or for any questions.
          </div>
        </div>

        <div class="footer">
          <p><strong>Thank you for your business!</strong></p>
          <p>Generated on ${currentDate}</p>
          <p>This is a system-generated proposal</p>
        </div>
      </div>
    </body>
    </html>`;
  };

  const handleGenerateAndShare = async () => {
    setIsSending(true);
    try {
      const htmlContent = generateProposalHTML();

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Increment the proposal counter
      // TypeScript: declare global property to avoid implicit 'any'
      const globalWithCounter = global as typeof global & { incrementProposalCounter?: () => Promise<void> };
      if (globalWithCounter.incrementProposalCounter) {
        await globalWithCounter.incrementProposalCounter();
      }

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Proposal ${proposalNumber}`,
          UTI: 'com.adobe.pdf'
        });
        
        setProposalSent(true);
        
        Alert.alert(
          'Proposal Generated!',
          `Proposal ${proposalNumber} has been generated and shared successfully. The proposal counter has been updated.`,
          [
            {
              text: 'Done',
              onPress: () => onClose()
            }
          ]
        );
      } else {
        Alert.alert(
          'Sharing Not Available',
          'Sharing is not available on this device, but the proposal has been generated successfully.'
        );
      }

    } catch (error) {
      console.error('Error generating proposal:', error);
      Alert.alert(
        'Error',
        'Failed to generate proposal. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Generate Proposal</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Proposal Info */}
          <View style={styles.section}>
            <View style={styles.proposalInfo}>
              <View style={styles.proposalHeader}>
                <Ionicons name="document-text-outline" size={48} color="#27AE60" />
                <View style={styles.proposalDetails}>
                  <Text style={styles.proposalNumber}>{proposalNumber}</Text>
                  <Text style={styles.proposalDate}>
                    Generated: {new Date().toLocaleDateString()}
                  </Text>
                  <Text style={styles.validUntil}>
                    Valid until: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Customer Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <View style={styles.customerSummary}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.customerDetail}>{customer.email}</Text>
              <Text style={styles.customerDetail}>{customer.phone}</Text>
            </View>
          </View>

          {/* Items Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items ({items.length})</Text>
            <View style={styles.itemsList}>
              {items.slice(0, 3).map((item, index) => (
                <View key={index} style={styles.itemSummary}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemDetails}>
                    {item.quantity} × ${item.unit_price.toFixed(2)} = ${item.total_price.toFixed(2)}
                  </Text>
                </View>
              ))}
              {items.length > 3 && (
                <Text style={styles.moreItems}>... and {items.length - 3} more items</Text>
              )}
            </View>
          </View>

          {/* Total Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.totalSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryValue}>${orderSummary.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax:</Text>
                <Text style={styles.summaryValue}>${orderSummary.tax.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>${orderSummary.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's Included</Text>
            <View style={styles.featuresList}>
              <View style={styles.feature}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#27AE60" />
                <Text style={styles.featureText}>Professional PDF format</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#27AE60" />
                <Text style={styles.featureText}>7-day validity period</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#27AE60" />
                <Text style={styles.featureText}>Detailed customer & product info</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#27AE60" />
                <Text style={styles.featureText}>Instant sharing capability</Text>
              </View>
            </View>
          </View>

          {proposalSent && (
            <View style={styles.successSection}>
              <Ionicons name="checkmark-circle" size={48} color="#27AE60" />
              <Text style={styles.successTitle}>Proposal Generated!</Text>
              <Text style={styles.successMessage}>
                Your proposal has been successfully generated and shared. 
                The proposal counter has been updated in your dashboard.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[styles.generateButton, (isSending || proposalSent) && styles.generateButtonDisabled]}
            onPress={handleGenerateAndShare}
            disabled={isSending || proposalSent}
          >
            {isSending ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Generating...</Text>
              </>
            ) : proposalSent ? (
              <>
                <Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Proposal Generated</Text>
              </>
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Generate & Share Proposal</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 50, // Account for status bar
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  proposalInfo: {
    alignItems: 'center',
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  proposalDetails: {
    marginLeft: 16,
    flex: 1,
  },
  proposalNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  proposalDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  validUntil: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '500',
  },
  customerSummary: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemsList: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
  },
  itemSummary: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: '#666',
  },
  moreItems: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  totalSummary: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  featuresList: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  successSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0FFF4',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27AE60',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#27AE60',
    marginTop: 12,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#27AE60',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomAction: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  generateButton: {
    backgroundColor: '#27AE60',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#CCC',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});