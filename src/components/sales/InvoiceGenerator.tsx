// src/components/sales/InvoiceGenerator.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
    const deliveryDate = new Date(orderData.deliveryDate).toLocaleDateString();
    const currentDate = new Date().toLocaleDateString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoiceNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #E74C3C;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #E74C3C;
          }
          .invoice-details {
            text-align: right;
          }
          .invoice-number {
            font-size: 24px;
            font-weight: bold;
            color: #333;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #666;
          }
          .customer-info {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: #E74C3C;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
          }
          .total-section {
            margin-top: 30px;
            text-align: right;
          }
          .total-line {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
          }
          .total-label {
            font-weight: 600;
            margin-right: 20px;
            min-width: 100px;
          }
          .grand-total {
            font-size: 20px;
            font-weight: bold;
            color: #E74C3C;
            border-top: 2px solid #E74C3C;
            padding-top: 10px;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Seven Stars Wholesale</div>
          <div class="invoice-details">
            <div class="invoice-number">INVOICE</div>
            <div>${invoiceNumber}</div>
            <div>Date: ${currentDate}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">BILL TO:</div>
          <div class="customer-info">
            <strong>${customer?.name || 'N/A'}</strong><br>
            ${customer?.email || ''}<br>
            ${customer?.phone || ''}<br>
            ${customer?.address || ''}<br>
            ${customer?.city || ''}, ${customer?.state || ''} ${customer?.zip_code || ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">ORDER DETAILS:</div>
          <div>Delivery Date: ${deliveryDate}</div>
          <div>Payment Terms: ${orderData.paymentType.toUpperCase()}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.product_name}</td>
                <td>${item.sku || '-'}</td>
                <td>${item.quantity}</td>
                <td>${item.unit}</td>
                <td>${item.unit_price.toFixed(2)}</td>
                <td>${item.total_price.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-line">
            <span class="total-label">Subtotal:</span>
            <span>${orderSummary.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-line">
            <span class="total-label">Tax (10%):</span>
            <span>${orderSummary.tax.toFixed(2)}</span>
          </div>
          <div class="total-line grand-total">
            <span class="total-label">Total:</span>
            <span>${orderSummary.total.toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Seven Stars Wholesale | Contact: sales@sevenstars.com | Phone: +1 323 555 0001</p>
        </div>
      </body>
      </html>
    `;
  };

  const sendInvoice = async () => {
    setIsSending(true);
    
    try {
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: generateInvoiceHTML(),
        base64: false
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
      
      // For email sending, you would need to:
      // 1. Set up an email service (SendGrid, AWS SES, etc.)
      // 2. Create an API endpoint to handle email sending
      // 3. Upload the PDF to storage
      // 4. Send email with PDF attachment
      
      // For now, we'll show success and allow local sharing
      setInvoiceSent(true);
      
      // Share the PDF locally if available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Invoice',
          UTI: 'com.adobe.pdf'
        });
      }
      
      Alert.alert(
        'Invoice Generated!',
        `Invoice ${invoiceNumber} has been generated successfully.\n\nNote: Email sending requires backend setup with an email service provider.`,
        [
          {
            text: 'OK',
            onPress: () => onClose()
          }
        ]
      );
      
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
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invoice Preview</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Invoice Header */}
          <View style={styles.invoiceHeader}>
            <View style={styles.companyInfo}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
              <Text style={styles.invoiceDate}>Date: {new Date().toLocaleDateString()}</Text>
            </View>
          </View>

          {/* Bill To Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BILL TO:</Text>
            <View style={styles.customerCard}>
              <Text style={styles.customerName}>{customer?.name}</Text>
              <Text style={styles.customerDetail}>{customer?.email}</Text>
              <Text style={styles.customerDetail}>{customer?.phone}</Text>
              <Text style={styles.customerDetail}>
                {customer?.address}, {customer?.city}, {customer?.state} {customer?.zip_code}
              </Text>
            </View>
          </View>

          {/* Order Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER DETAILS:</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery Date:</Text>
              <Text style={styles.detailValue}>
                {new Date(orderData.deliveryDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Terms:</Text>
              <Text style={styles.detailValue}>{orderData.paymentType.toUpperCase()}</Text>
            </View>
          </View>

          {/* Items Table */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ITEMS:</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Item</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Qty</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Unit Price</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Total</Text>
              </View>
              {items.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{item.product_name}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>${item.unit_price.toFixed(2)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, fontWeight: '600' }]}>
                    ${item.total_price.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Total Section */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>${orderSummary.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax (10%):</Text>
              <Text style={styles.totalValue}>${orderSummary.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>${orderSummary.total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your business!</Text>
            <Text style={styles.footerContact}>
              Seven Stars Wholesale | sales@sevenstars.com | +1 323 555 0001
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!invoiceSent ? (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.sendButton, isSending && styles.sendButtonDisabled]}
                onPress={sendInvoice}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>Send Invoice</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, styles.doneButton]}
              onPress={onClose}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}
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
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 15,
    borderRadius: 12,
    padding: 20,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E74C3C',
    marginBottom: 20,
  },
  companyInfo: {
    flex: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 180,
    height: 50,
  },
  invoiceInfo: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  invoiceNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  invoiceDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  customerCard: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  table: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tableCell: {
    fontSize: 14,
    color: '#333',
  },
  totalSection: {
    marginTop: 20,
    paddingTop: 15,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 20,
    width: 100,
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    width: 100,
    textAlign: 'right',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#E74C3C',
    paddingTop: 10,
    marginTop: 5,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 20,
    width: 100,
    textAlign: 'right',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
    width: 100,
    textAlign: 'right',
  },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  footerContact: {
    fontSize: 12,
    color: '#999',
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#E74C3C',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  doneButton: {
    backgroundColor: '#27AE60',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});