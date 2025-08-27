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
import { supabase } from '../../lib/supabase';

interface ProposalGeneratorProps {
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

export default function ProposalGenerator({ 
  orderId, 
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
    const deliveryDate = new Date(orderData.deliveryDate).toLocaleDateString();
    const currentDate = new Date().toLocaleDateString();
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(); // Valid for 7 days
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Sales Proposal ${proposalNumber}</title>
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
          .proposal-details {
            text-align: right;
          }
          .proposal-number {
            font-size: 24px;
            font-weight: bold;
            color: #333;
          }
          .status-badge {
            display: inline-block;
            background: #FFF0F0;
            color: #E74C3C;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
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
          .validity-box {
            background: #FFF9E6;
            border: 1px solid #FFD700;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .validity-text {
            color: #B8860B;
            font-weight: 600;
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
          .customer-price {
            color: #3498DB;
            font-size: 11px;
            font-weight: 600;
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
          .terms-section {
            margin-top: 40px;
            padding: 20px;
            background: #F8F9FA;
            border-radius: 8px;
          }
          .terms-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .terms-list {
            list-style-type: disc;
            margin-left: 20px;
            line-height: 1.6;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          .action-box {
            background: #E8F8F5;
            border: 2px solid #27AE60;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
            text-align: center;
          }
          .action-text {
            font-size: 16px;
            color: #27AE60;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Seven Stars Wholesale</div>
          <div class="proposal-details">
            <div class="proposal-number">SALES PROPOSAL</div>
            <div>${proposalNumber}</div>
            <div>Date: ${currentDate}</div>
            <div class="status-badge">PENDING APPROVAL</div>
          </div>
        </div>

        <div class="validity-box">
          <div class="validity-text">⏰ This proposal is valid until: ${validUntil}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">
            Prices and availability subject to change after this date
          </div>
        </div>

        <div class="section">
          <div class="section-title">PREPARED FOR:</div>
          <div class="customer-info">
            <strong>${customer?.name || 'N/A'}</strong><br>
            ${customer?.email || ''}<br>
            ${customer?.phone || ''}<br>
            ${customer?.address || ''}<br>
            ${customer?.city || ''}, ${customer?.state || ''} ${customer?.zip_code || ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">PROPOSED DELIVERY:</div>
          <div>Date: ${deliveryDate}</div>
          <div>Payment Terms: ${orderData.paymentType.toUpperCase()}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
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
                <td>
                  ${item.product_name}
                  ${item.using_customer_price ? '<br><span class="customer-price">*Customer Price Applied</span>' : ''}
                </td>
                <td>${item.sku || '-'}</td>
                <td>${item.quantity}</td>
                <td>${item.unit}</td>
                <td>$${item.unit_price.toFixed(2)}</td>
                <td>$${item.total_price.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-line">
            <span class="total-label">Subtotal:</span>
            <span>$${orderSummary.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-line">
            <span class="total-label">Estimated Tax (10%):</span>
            <span>$${orderSummary.tax.toFixed(2)}</span>
          </div>
          <div class="total-line grand-total">
            <span class="total-label">Total Amount:</span>
            <span>$${orderSummary.total.toFixed(2)}</span>
          </div>
        </div>

        <div class="terms-section">
          <div class="terms-title">Terms & Conditions:</div>
          <ul class="terms-list">
            <li>Prices are subject to change without notice</li>
            <li>Delivery dates are estimated and subject to product availability</li>
            <li>Payment terms as specified must be adhered to</li>
            <li>This proposal does not guarantee product availability</li>
            <li>Final order confirmation required from management</li>
            <li>Customer-specific pricing applied where applicable based on purchase history</li>
          </ul>
        </div>

        <div class="action-box">
          <div class="action-text">✓ To accept this proposal, please contact your sales representative</div>
        </div>

        <div class="footer">
          <p>Thank you for considering Seven Stars Wholesale!</p>
          <p>Seven Stars Wholesale | Contact: sales@sevenstars.com | Phone: +1 323 555 0001</p>
          <p style="margin-top: 10px; font-size: 10px;">
            This is a sales proposal only and does not constitute a confirmed order.
          </p>
        </div>
      </body>
      </html>
    `;
  };

  const sendProposal = async () => {
    setIsSending(true);
    
    try {
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: generateProposalHTML(),
        base64: false
      });

      // Update order with proposal info
      await supabase
        .from('orders')
        .update({
          proposal_number: proposalNumber,
          proposal_sent: true,
          proposal_sent_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      
      setProposalSent(true);
      
      // Share the PDF locally if available
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Proposal',
          UTI: 'com.adobe.pdf'
        });
      }
      
      Alert.alert(
        'Proposal Generated!',
        `Proposal ${proposalNumber} has been generated successfully.\n\nThe order has been saved as a draft and will be sent to management for approval.`,
        [
          {
            text: 'OK',
            onPress: () => onClose()
          }
        ]
      );
      
    } catch (error) {
      console.error('Error generating proposal:', error);
      Alert.alert('Error', 'Failed to generate proposal. Please try again.');
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
         <Text style={styles.headerTitle}>Proposal Preview</Text>
         <View style={{ width: 24 }} />
       </View>

       <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
         {/* Proposal Header */}
         <View style={styles.proposalHeader}>
           <View style={styles.companyInfo}>
             <Text style={styles.companyName}>Seven Stars Wholesale</Text>
           </View>
           <View style={styles.proposalInfo}>
             <Text style={styles.proposalTitle}>SALES PROPOSAL</Text>
             <Text style={styles.proposalNumber}>{proposalNumber}</Text>
             <Text style={styles.proposalDate}>Date: {new Date().toLocaleDateString()}</Text>
             <View style={styles.statusBadge}>
               <Text style={styles.statusText}>PENDING APPROVAL</Text>
             </View>
           </View>
         </View>

         {/* Validity Notice */}
         <View style={styles.validityBox}>
           <Ionicons name="time-outline" size={20} color="#B8860B" />
           <View style={styles.validityContent}>
             <Text style={styles.validityText}>
               Valid until: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
             </Text>
             <Text style={styles.validitySubtext}>
               Prices and availability subject to change after this date
             </Text>
           </View>
         </View>

         {/* Customer Section */}
         <View style={styles.section}>
           <Text style={styles.sectionTitle}>PREPARED FOR:</Text>
           <View style={styles.customerCard}>
             <Text style={styles.customerName}>{customer?.name}</Text>
             <Text style={styles.customerDetail}>{customer?.email}</Text>
             <Text style={styles.customerDetail}>{customer?.phone}</Text>
             <Text style={styles.customerDetail}>
               {customer?.address}, {customer?.city}, {customer?.state} {customer?.zip_code}
             </Text>
           </View>
         </View>

         {/* Delivery Details */}
         <View style={styles.section}>
           <Text style={styles.sectionTitle}>PROPOSED DELIVERY:</Text>
           <View style={styles.detailRow}>
             <Text style={styles.detailLabel}>Date:</Text>
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
           <Text style={styles.sectionTitle}>PROPOSED ITEMS:</Text>
           <View style={styles.table}>
             <View style={styles.tableHeader}>
               <Text style={[styles.tableHeaderText, { flex: 2 }]}>Item</Text>
               <Text style={[styles.tableHeaderText, { flex: 1 }]}>Qty</Text>
               <Text style={[styles.tableHeaderText, { flex: 1 }]}>Unit Price</Text>
               <Text style={[styles.tableHeaderText, { flex: 1 }]}>Total</Text>
             </View>
             {items.map((item, index) => (
               <View key={index} style={styles.tableRow}>
                 <View style={{ flex: 2 }}>
                   <Text style={styles.itemName}>{item.product_name}</Text>
                   {item.using_customer_price && (
                     <Text style={styles.customerPriceIndicator}>*Customer Price Applied</Text>
                   )}
                 </View>
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
             <Text style={styles.totalLabel}>Estimated Tax (10%):</Text>
             <Text style={styles.totalValue}>${orderSummary.tax.toFixed(2)}</Text>
           </View>
           <View style={[styles.totalRow, styles.grandTotalRow]}>
             <Text style={styles.grandTotalLabel}>Total Amount:</Text>
             <Text style={styles.grandTotalValue}>${orderSummary.total.toFixed(2)}</Text>
           </View>
         </View>

         {/* Terms & Conditions */}
         <View style={styles.termsSection}>
           <Text style={styles.termsTitle}>Terms & Conditions:</Text>
           <View style={styles.termsList}>
             <Text style={styles.termItem}>• Prices are subject to change without notice</Text>
             <Text style={styles.termItem}>• Delivery dates are estimated and subject to availability</Text>
             <Text style={styles.termItem}>• Payment terms as specified must be adhered to</Text>
             <Text style={styles.termItem}>• This proposal does not guarantee product availability</Text>
             <Text style={styles.termItem}>• Final order confirmation required from management</Text>
             <Text style={styles.termItem}>• Customer-specific pricing applied based on purchase history</Text>
           </View>
         </View>

         {/* Action Box */}
         <View style={styles.actionBox}>
           <Ionicons name="checkmark-circle-outline" size={24} color="#27AE60" />
           <Text style={styles.actionText}>
             To accept this proposal, please contact your sales representative
           </Text>
         </View>

         {/* Footer */}
         <View style={styles.footer}>
           <Text style={styles.footerText}>Thank you for considering Seven Stars Wholesale!</Text>
           <Text style={styles.footerContact}>
             Seven Stars Wholesale | sales@sevenstars.com | +1 323 555 0001
           </Text>
           <Text style={styles.footerDisclaimer}>
             This is a sales proposal only and does not constitute a confirmed order.
           </Text>
         </View>
       </ScrollView>

       {/* Action Buttons */}
       <View style={styles.actionContainer}>
         {!proposalSent ? (
           <>
             <TouchableOpacity 
               style={[styles.actionButton, styles.cancelButton]}
               onPress={onClose}
             >
               <Text style={styles.cancelButtonText}>Cancel</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={[styles.actionButton, styles.sendButton, isSending && styles.sendButtonDisabled]}
               onPress={sendProposal}
               disabled={isSending}
             >
               {isSending ? (
                 <ActivityIndicator color="#FFFFFF" />
               ) : (
                 <>
                   <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                   <Text style={styles.sendButtonText}>Generate Proposal</Text>
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
 proposalHeader: {
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
 companyName: {
   fontSize: 24,
   fontWeight: 'bold',
   color: '#E74C3C',
 },
 proposalInfo: {
   alignItems: 'flex-end',
 },
 proposalTitle: {
   fontSize: 20,
   fontWeight: 'bold',
   color: '#333',
 },
 proposalNumber: {
   fontSize: 14,
   color: '#666',
   marginTop: 5,
 },
 proposalDate: {
   fontSize: 14,
   color: '#666',
   marginTop: 2,
 },
 statusBadge: {
   backgroundColor: '#FFF0F0',
   paddingHorizontal: 12,
   paddingVertical: 6,
   borderRadius: 20,
   marginTop: 8,
 },
 statusText: {
   fontSize: 11,
   fontWeight: '600',
   color: '#E74C3C',
 },
 validityBox: {
   flexDirection: 'row',
   backgroundColor: '#FFF9E6',
   borderWidth: 1,
   borderColor: '#FFD700',
   padding: 15,
   borderRadius: 8,
   marginBottom: 20,
   alignItems: 'center',
 },
 validityContent: {
   marginLeft: 10,
   flex: 1,
 },
 validityText: {
   fontSize: 14,
   fontWeight: '600',
   color: '#B8860B',
 },
 validitySubtext: {
   fontSize: 12,
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
 itemName: {
   fontSize: 14,
   color: '#333',
 },
 customerPriceIndicator: {
   fontSize: 11,
   color: '#3498DB',
   fontWeight: '600',
   marginTop: 2,
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
   width: 150,
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
   width: 150,
   textAlign: 'right',
 },
 grandTotalValue: {
   fontSize: 18,
   fontWeight: 'bold',
   color: '#E74C3C',
   width: 100,
   textAlign: 'right',
 },
 termsSection: {
   backgroundColor: '#F8F9FA',
   padding: 15,
   borderRadius: 8,
   marginTop: 20,
 },
 termsTitle: {
   fontSize: 14,
   fontWeight: '600',
   color: '#333',
   marginBottom: 10,
 },
 termsList: {
   marginLeft: 5,
 },
 termItem: {
   fontSize: 13,
   color: '#666',
   lineHeight: 22,
 },
 actionBox: {
   flexDirection: 'row',
   backgroundColor: '#E8F8F5',
   borderWidth: 2,
   borderColor: '#27AE60',
   padding: 20,
   borderRadius: 8,
   marginTop: 20,
   alignItems: 'center',
   justifyContent: 'center',
 },
 actionText: {
   fontSize: 15,
   color: '#27AE60',
   fontWeight: '600',
   marginLeft: 10,
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
 footerDisclaimer: {
   fontSize: 10,
   color: '#999',
   marginTop: 10,
   fontStyle: 'italic',
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