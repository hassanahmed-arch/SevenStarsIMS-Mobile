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

// Company Configuration - Update these with your details
// To add your logo: Convert your logo to base64 format (use an online converter)
// Include the data URI prefix: 'data:image/png;base64,' or 'data:image/jpeg;base64,'
// Example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const COMPANY_LOGO_BASE64 = 'data:image/jpeg;base64,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';
const COMPANY_NAME = 'Seven Stars Wholesale';
const COMPANY_ADDRESS = '123 Business Ave, Suite 100';
const COMPANY_CITY = 'Your City, State 12345';
const COMPANY_PHONE = '(555) 123-4567';
const COMPANY_EMAIL = 'sales@sevenstars.com';

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
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();

    // Process items in chunks to prevent page overflow
    const itemsPerPage = 15; // Adjust based on testing
    const itemChunks = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      itemChunks.push(items.slice(i, i + itemsPerPage));
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Proposal - ${proposalNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          color: #000;
          background: #fff;
          line-height: 1.4;
          font-size: 14px;
        }
        
        .page {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .page-content {
          flex: 1;
        }
        
        /* Header */
        .header {
          border-bottom: 3px solid #E74C3C;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        
        .company-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        
        .company-logo {
          width: 150px;
          height: 80px;
          object-fit: contain;
          margin-bottom: 10px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #E74C3C;
          margin-bottom: 8px;
        }
        
        .company-details {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }
        
        .document-section {
          text-align: right;
        }
        
        .document-title {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin-bottom: 8px;
        }
        
        .document-number {
          font-size: 14px;
          color: #E74C3C;
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .document-date {
          font-size: 12px;
          color: #666;
        }
        
        /* Customer Section */
        .info-section {
          margin-bottom: 25px;
        }
        
        .info-title {
          font-size: 12px;
          font-weight: bold;
          color: #000;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #E0E0E0;
        }
        
        .info-content {
          background: #F8F8F8;
          padding: 15px;
          border-left: 3px solid #E74C3C;
        }
        
        .customer-name {
          font-size: 16px;
          font-weight: bold;
          color: #000;
          margin-bottom: 8px;
        }
        
        .customer-details {
          font-size: 13px;
          color: #333;
          line-height: 1.5;
        }
        
        /* Details Grid */
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }
        
        .detail-item {
          font-size: 13px;
        }
        
        .detail-label {
          color: #666;
          margin-bottom: 2px;
        }
        
        .detail-value {
          color: #000;
          font-weight: 600;
        }
        
        /* Table */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
          font-size: 13px;
        }
        
        .items-table th {
          background: #000;
          color: #fff;
          padding: 10px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .items-table th:last-child,
        .items-table td:last-child {
          text-align: right;
        }
        
        .items-table td {
          padding: 10px;
          border-bottom: 1px solid #E0E0E0;
          color: #333;
        }
        
        .items-table tbody tr:nth-child(even) {
          background: #FAFAFA;
        }
        
        .product-name {
          font-weight: 600;
          color: #000;
        }
        
        .product-sku {
          font-size: 11px;
          color: #666;
          margin-top: 2px;
        }
        
        /* Summary */
        .summary-section {
          margin-top: 30px;
          display: flex;
          justify-content: flex-end;
        }
        
        .summary-box {
          width: 300px;
          background: #F8F8F8;
          padding: 20px;
          border: 2px solid #E74C3C;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
        }
        
        .summary-label {
          color: #666;
        }
        
        .summary-value {
          font-weight: 600;
          color: #000;
        }
        
        .summary-total {
          border-top: 2px solid #E74C3C;
          padding-top: 10px;
          margin-top: 10px;
        }
        
        .summary-total .summary-label {
          font-size: 16px;
          font-weight: bold;
          color: #000;
        }
        
        .summary-total .summary-value {
          font-size: 18px;
          font-weight: bold;
          color: #E74C3C;
        }
        
        /* Terms */
        .terms-section {
          margin-top: auto;
          padding: 15px;
          background: #FFF8F8;
          border: 1px solid #E74C3C;
        }
        
        .terms-title {
          font-size: 12px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        
        .terms-content {
          font-size: 12px;
          color: #333;
          line-height: 1.5;
        }
        
        /* Footer */
        .footer {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #E0E0E0;
          text-align: center;
          font-size: 11px;
          color: #666;
        }
        
        .footer-company {
          font-weight: bold;
          color: #000;
          margin-bottom: 5px;
        }
        
        /* Page break control */
        @media print {
          .page-break {
            page-break-before: always;
          }
        }
        
        .continued-notice {
          text-align: center;
          font-style: italic;
          color: #666;
          margin: 20px 0;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header -->
        <div class="header">
          <div class="header-top">
            <div class="company-section">
              ${COMPANY_LOGO_BASE64 ? `
                <img src="${COMPANY_LOGO_BASE64}" alt="Company Logo" class="company-logo">
              ` : `
                <div class="company-name">${COMPANY_NAME}</div>
              `}
              <div class="company-details">
                ${COMPANY_ADDRESS}<br>
                ${COMPANY_CITY}<br>
                Phone: ${COMPANY_PHONE}<br>
                Email: ${COMPANY_EMAIL}
              </div>
            </div>
            <div class="document-section">
              <div class="document-title">PROPOSAL</div>
              <div class="document-number">${proposalNumber}</div>
              <div class="document-date">Date: ${currentDate}</div>
              <div class="document-date">Valid Until: ${validUntil}</div>
            </div>
          </div>
        </div>
        
        <div class="page-content">
          <!-- Customer Information -->
          <div class="info-section">
            <div class="info-title">Customer Information</div>
            <div class="info-content">
              <div class="customer-name">${customer.name}</div>
              <div class="customer-details">
                ${customer.email}<br>
                ${customer.phone}<br>
                ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip_code || ''}
                ${customer.customer_type ? `<br>Customer Type: ${customer.customer_type}` : ''}
              </div>
            </div>
          </div>
          
          <!-- Order Details -->
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">Delivery Type</div>
              <div class="detail-value">${orderData.orderType === 'delivery' ? 'Delivery' : orderData.orderType === 'pickup' ? 'Customer Pickup' : orderData.orderType.toUpperCase()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Payment Terms</div>
              <div class="detail-value">${orderData.paymentType.replace('_', ' ').toUpperCase()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Proposed Delivery Date</div>
              <div class="detail-value">${new Date(orderData.deliveryDate).toLocaleDateString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Total Items</div>
              <div class="detail-value">${items.length} Product${items.length > 1 ? 's' : ''}</div>
            </div>
          </div>
          
          <!-- Items Table -->
          <div class="info-section">
            <div class="info-title">Proposed Products</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 40%">Product</th>
                  <th style="width: 15%">SKU</th>
                  <th style="width: 15%">Quantity</th>
                  <th style="width: 15%">Unit Price</th>
                  <th style="width: 15%">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemChunks[0].map(item => `
                  <tr>
                    <td>
                      <div class="product-name">${item.product_name}</div>
                      ${item.sku ? `<div class="product-sku">SKU: ${item.sku}</div>` : ''}
                    </td>
                    <td>${item.sku || '-'}</td>
                    <td>${item.quantity} ${item.unit || ''}</td>
                    <td>${item.unit_price.toFixed(2)}</td>
                    <td>${item.total_price.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          ${itemChunks.length <= 1 ? `
          <!-- Summary (only on last page) -->
          <div class="summary-section">
            <div class="summary-box">
              <div class="summary-row">
                <span class="summary-label">Subtotal:</span>
                <span class="summary-value">${orderSummary.subtotal.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Tax:</span>
                <span class="summary-value">${orderSummary.tax.toFixed(2)}</span>
              </div>
              <div class="summary-row summary-total">
                <span class="summary-label">Total:</span>
                <span class="summary-value">${orderSummary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
        
        ${itemChunks.length <= 1 ? `
        <!-- Terms -->
        <div class="terms-section">
          <div class="terms-title">Terms & Conditions</div>
          <div class="terms-content">
            • This proposal is valid until ${validUntil}<br>
            • Prices are subject to change after the validity period<br>
            • All sales are subject to our standard terms and conditions<br>
            • Products are subject to availability at time of order confirmation
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-company">${COMPANY_NAME}</div>
          <div>Thank you for your business opportunity</div>
          <div>${COMPANY_EMAIL} | ${COMPANY_PHONE}</div>
        </div>
        ` : ''}
      </div>
      
      ${itemChunks.slice(1).map((chunk, index) => `
        <div class="page page-break">
          ${index === itemChunks.length - 2 ? `
          <div class="page-content">
            <div class="continued-notice">Page ${index + 2} of ${itemChunks.length}</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 40%">Product</th>
                  <th style="width: 15%">SKU</th>
                  <th style="width: 15%">Quantity</th>
                  <th style="width: 15%">Unit Price</th>
                  <th style="width: 15%">Total</th>
                </tr>
              </thead>
              <tbody>
                ${chunk.map(item => `
                  <tr>
                    <td>
                      <div class="product-name">${item.product_name}</div>
                      ${item.sku ? `<div class="product-sku">SKU: ${item.sku}</div>` : ''}
                    </td>
                    <td>${item.sku || '-'}</td>
                    <td>${item.quantity} ${item.unit || ''}</td>
                    <td>${item.unit_price.toFixed(2)}</td>
                    <td>${item.total_price.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <!-- Summary on last page -->
            <div class="summary-section">
              <div class="summary-box">
                <div class="summary-row">
                  <span class="summary-label">Subtotal:</span>
                  <span class="summary-value">${orderSummary.subtotal.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Tax:</span>
                  <span class="summary-value">${orderSummary.tax.toFixed(2)}</span>
                </div>
                <div class="summary-row summary-total">
                  <span class="summary-label">Total:</span>
                  <span class="summary-value">${orderSummary.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Terms -->
          <div class="terms-section">
            <div class="terms-title">Terms & Conditions</div>
            <div class="terms-content">
              • This proposal is valid until ${validUntil}<br>
              • Prices are subject to change after the validity period<br>
              • All sales are subject to our standard terms and conditions<br>
              • Products are subject to availability at time of order confirmation
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div class="footer-company">${COMPANY_NAME}</div>
            <div>Thank you for your business opportunity</div>
            <div>${COMPANY_EMAIL} | ${COMPANY_PHONE}</div>
          </div>
          ` : `
          <div class="continued-notice">Page ${index + 2} of ${itemChunks.length}</div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 40%">Product</th>
                <th style="width: 15%">SKU</th>
                <th style="width: 15%">Quantity</th>
                <th style="width: 15%">Unit Price</th>
                <th style="width: 15%">Total</th>
              </tr>
            </thead>
            <tbody>
              ${chunk.map(item => `
                <tr>
                  <td>
                    <div class="product-name">${item.product_name}</div>
                    ${item.sku ? `<div class="product-sku">SKU: ${item.sku}</div>` : ''}
                  </td>
                  <td>${item.sku || '-'}</td>
                  <td>${item.quantity} ${item.unit || ''}</td>
                  <td>${item.unit_price.toFixed(2)}</td>
                  <td>${item.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          `}
        </div>
      `).join('')}
    </body>
    </html>`;
  };

  const handleGenerateAndShare = async () => {
    setIsSending(true);
    try {
      const htmlContent = generateProposalHTML();

      // Generate PDF with optimized settings
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        width: 612, // Standard letter width in points
        height: 792, // Standard letter height in points
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Proposal ${proposalNumber}`,
          UTI: 'com.adobe.pdf'
        });
        
        setProposalSent(true);
        
        Alert.alert(
          'Success',
          `Proposal ${proposalNumber} has been generated successfully.`,
          [{ text: 'Done', onPress: () => onClose() }]
        );
      } else {
        Alert.alert(
          'Sharing Not Available',
          'Sharing is not available on this device, but the proposal has been generated.'
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
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Generate Proposal</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Proposal Preview Card */}
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="document-text" size={40} color="#E74C3C" />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.proposalNumber}>{proposalNumber}</Text>
                <Text style={styles.proposalDate}>Created: {new Date().toLocaleDateString()}</Text>
                <Text style={styles.validUntil}>Valid until: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          {/* Customer Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CUSTOMER</Text>
            <View style={styles.infoBox}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.customerDetail}>{customer.email}</Text>
              <Text style={styles.customerDetail}>{customer.phone}</Text>
            </View>
          </View>

          {/* Items Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ITEMS ({items.length})</Text>
            <View style={styles.infoBox}>
              {items.slice(0, 3).map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemPrice}>
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
            <Text style={styles.sectionTitle}>TOTAL</Text>
            <View style={styles.totalBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalValue}>${orderSummary.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax:</Text>
                <Text style={styles.totalValue}>${orderSummary.tax.toFixed(2)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotal]}>
                <Text style={styles.grandTotalLabel}>Total:</Text>
                <Text style={styles.grandTotalValue}>${orderSummary.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {proposalSent && (
            <View style={styles.successMessage}>
              <Ionicons name="checkmark-circle" size={48} color="#27AE60" />
              <Text style={styles.successText}>Proposal Generated Successfully!</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionButton, (isSending || proposalSent) && styles.buttonDisabled]}
            onPress={handleGenerateAndShare}
            disabled={isSending || proposalSent}
          >
            {isSending ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.buttonText}>Generating...</Text>
              </>
            ) : proposalSent ? (
              <>
                <Ionicons name="checkmark" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Generated</Text>
              </>
            ) : (
              <>
                <Ionicons name="share" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Generate & Share</Text>
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
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 50,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  previewCard: {
    backgroundColor: '#FFF',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  previewInfo: {
    flex: 1,
  },
  proposalNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  proposalDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  validUntil: {
    fontSize: 13,
    color: '#E74C3C',
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoBox: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  customerDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  itemRow: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  itemPrice: {
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
  totalBox: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E74C3C',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  grandTotal: {
    borderTopWidth: 2,
    borderTopColor: '#E74C3C',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  successMessage: {
    alignItems: 'center',
    padding: 30,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27AE60',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27AE60',
    marginTop: 12,
  },
  bottomActions: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});