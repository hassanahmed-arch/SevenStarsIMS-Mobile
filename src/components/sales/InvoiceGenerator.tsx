// src/components/sales/InvoiceGenerator.tsx

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
import { supabase } from '../../lib/supabase';

interface InvoiceGeneratorProps {
  orderId: string;
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

// Company Configuration - Update these with your details (same as ProposalGenerator)
// To add your logo: Convert your logo to base64 format (use an online converter)
// Include the data URI prefix: 'data:image/png;base64,' or 'data:image/jpeg;base64,'
// Example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const COMPANY_LOGO_BASE64 = ''; // Add your base64 logo here with data URI prefix
const COMPANY_NAME = 'Seven Stars Wholesale';
const COMPANY_ADDRESS = '123 Business Ave, Suite 100';
const COMPANY_CITY = 'Your City, State 12345';
const COMPANY_PHONE = '(555) 123-4567';
const COMPANY_EMAIL = 'sales@sevenstars.com';

export default function InvoiceGenerator({ 
  orderId, 
  customer, 
  items, 
  orderSummary, 
  orderData,
  onClose 
}: InvoiceGeneratorProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);

  useEffect(() => {
    generateInvoiceNumber();
  }, []);

  const generateInvoiceNumber = () => {
    const date = new Date();
    const invoiceNum = `INV-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    setInvoiceNumber(invoiceNum);
  };

  const generateInvoiceHTML = () => {
    const currentDate = new Date().toLocaleDateString();
    const deliveryDate = new Date(orderData.deliveryDate).toLocaleDateString();
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(); // 30 days payment terms

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
      <title>Invoice - ${invoiceNumber}</title>
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
        
        /* Payment Info */
        .payment-section {
          margin-top: auto;
          padding: 15px;
          background: #FFF8F8;
          border: 1px solid #E74C3C;
        }
        
        .payment-title {
          font-size: 12px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        
        .payment-content {
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
              <div class="document-title">ORDER INVOICE</div>
              <div class="document-number">${invoiceNumber}</div>
              <div class="document-date">Date: ${currentDate}</div>
              <div class="document-date">Due Date: ${dueDate}</div>
            </div>
          </div>
        </div>
        
        <!-- Customer Information -->
        <div class="info-section">
          <div class="info-title">Bill To</div>
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
            <div class="detail-label">Order Number</div>
            <div class="detail-value">${orderId.substring(0, 8).toUpperCase()}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Payment Terms</div>
            <div class="detail-value">${orderData.paymentType.replace('_', ' ').toUpperCase()}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Delivery Date</div>
            <div class="detail-value">${deliveryDate}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Total Items</div>
            <div class="detail-value">${items.length} Product${items.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        
        <!-- Items Table -->
        <div class="info-section">
          <div class="info-title">Order Items</div>
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
                  <td>$${item.unit_price.toFixed(2)}</td>
                  <td>$${item.total_price.toFixed(2)}</td>
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
              <span class="summary-value">$${orderSummary.subtotal.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Tax:</span>
              <span class="summary-value">$${orderSummary.tax.toFixed(2)}</span>
            </div>
            <div class="summary-row summary-total">
              <span class="summary-label">Total Due:</span>
              <span class="summary-value">$${orderSummary.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <!-- Payment Info -->
        <div class="payment-section">
          <div class="payment-title">Payment Information</div>
          <div class="payment-content">
            • Payment Terms: ${orderData.paymentType.replace('_', ' ').toUpperCase()}<br>
            • Due Date: ${dueDate}<br>
            • Please reference invoice number ${invoiceNumber} with your payment<br>
            • Late payments may incur additional charges
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-company">${COMPANY_NAME}</div>
          <div>Thank you for your business!</div>
          <div>${COMPANY_EMAIL} | ${COMPANY_PHONE}</div>
        </div>
        ` : `
        <div class="continued-notice">Continued on next page...</div>
        `}
      </div>
      
      ${itemChunks.slice(1).map((chunk, index) => `
        <div class="page page-break">
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
                  <td>$${item.unit_price.toFixed(2)}</td>
                  <td>$${item.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${index === itemChunks.length - 2 ? `
          <!-- Summary on last page -->
          <div class="summary-section">
            <div class="summary-box">
              <div class="summary-row">
                <span class="summary-label">Subtotal:</span>
                <span class="summary-value">$${orderSummary.subtotal.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Tax:</span>
                <span class="summary-value">$${orderSummary.tax.toFixed(2)}</span>
              </div>
              <div class="summary-row summary-total">
                <span class="summary-label">Total Due:</span>
                <span class="summary-value">$${orderSummary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <!-- Payment Info -->
          <div class="payment-section">
            <div class="payment-title">Payment Information</div>
            <div class="payment-content">
              • Payment Terms: ${orderData.paymentType.replace('_', ' ').toUpperCase()}<br>
              • Due Date: ${dueDate}<br>
              • Please reference invoice number ${invoiceNumber} with your payment<br>
              • Late payments may incur additional charges
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div class="footer-company">${COMPANY_NAME}</div>
            <div>Thank you for your business!</div>
            <div>${COMPANY_EMAIL} | ${COMPANY_PHONE}</div>
          </div>
          ` : ''}
        </div>
      `).join('')}
    </body>
    </html>`;
  };

  const sendInvoice = async () => {
    setIsSending(true);
    
    try {
      // Generate PDF with optimized settings
      const { uri } = await Print.printToFileAsync({
        html: generateInvoiceHTML(),
        base64: false,
        width: 612, // Standard letter width in points
        height: 792, // Standard letter height in points
      });

      // Update order with invoice info
      await supabase
        .from('orders')
        .update({
          invoice_number: invoiceNumber,
          invoice_sent: true,
          invoice_sent_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      
      // Share the PDF locally if available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice ${invoiceNumber}`,
          UTI: 'com.adobe.pdf'
        });
        
        setInvoiceSent(true);
        
        Alert.alert(
          'Success',
          `Invoice ${invoiceNumber} has been generated successfully.`,
          [{ text: 'Done', onPress: () => onClose() }]
        );
      } else {
        Alert.alert(
          'Sharing Not Available',
          'Sharing is not available on this device, but the invoice has been generated.'
        );
      }
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      Alert.alert('Error', 'Failed to generate invoice. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Generate Invoice</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Invoice Preview Card */}
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="receipt" size={40} color="#E74C3C" />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
                <Text style={styles.invoiceDate}>Created: {new Date().toLocaleDateString()}</Text>
                <Text style={styles.dueDate}>Due: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          {/* Customer Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BILL TO</Text>
            <View style={styles.infoBox}>
              <Text style={styles.customerName}>{customer?.name}</Text>
              <Text style={styles.customerDetail}>{customer?.email}</Text>
              <Text style={styles.customerDetail}>{customer?.phone}</Text>
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
            <Text style={styles.sectionTitle}>TOTAL DUE</Text>
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
                <Text style={styles.grandTotalLabel}>Total Due:</Text>
                <Text style={styles.grandTotalValue}>${orderSummary.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {invoiceSent && (
            <View style={styles.successMessage}>
              <Ionicons name="checkmark-circle" size={48} color="#27AE60" />
              <Text style={styles.successText}>Invoice Generated Successfully!</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionButton, (isSending || invoiceSent) && styles.buttonDisabled]}
            onPress={sendInvoice}
            disabled={isSending || invoiceSent}
          >
            {isSending ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.buttonText}>Generating...</Text>
              </>
            ) : invoiceSent ? (
              <>
                <Ionicons name="checkmark" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Generated</Text>
              </>
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Generate & Send</Text>
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
  invoiceNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  dueDate: {
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