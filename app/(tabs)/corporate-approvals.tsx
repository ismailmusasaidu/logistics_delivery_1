import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useCorporate } from '@/contexts/CorporateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, Package, MapPin, User, Calendar } from 'lucide-react-native';

interface PendingOrder {
  id: string;
  order_id: string;
  approval_status: string;
  po_number: string | null;
  internal_reference: string | null;
  created_at: string;
  requested_by_profile: {
    full_name: string;
  };
  department: {
    name: string;
  } | null;
  orders: {
    pickup_address: string;
    dropoff_address: string;
    package_description: string;
    total_price: number;
  };
}

export default function CorporateApprovals() {
  const { company } = useCorporate();
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  const fetchPendingOrders = async () => {
    if (!company) return;

    try {
      const { data, error } = await supabase
        .from('corporate_orders')
        .select(`
          *,
          orders(pickup_address, dropoff_address, package_description, total_price),
          requested_by_profile:profiles!corporate_orders_requested_by_fkey(full_name),
          department:departments(name)
        `)
        .eq('company_id', company.id)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingOrders(data || []);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPendingOrders();

    const subscription = supabase
      .channel('corporate_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'corporate_orders',
          filter: `company_id=eq.${company?.id}`,
        },
        () => {
          fetchPendingOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [company]);

  const handleApprove = async (corporateOrderId: string, orderId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('corporate_orders')
        .update({
          approval_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: approvalNotes || null,
        })
        .eq('id', corporateOrderId);

      if (updateError) throw updateError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'pending' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      Alert.alert('Success', 'Order approved successfully');
      setSelectedOrder(null);
      setApprovalNotes('');
      fetchPendingOrders();
    } catch (error) {
      console.error('Error approving order:', error);
      Alert.alert('Error', 'Failed to approve order');
    }
  };

  const handleReject = async (corporateOrderId: string, orderId: string) => {
    if (!approvalNotes.trim()) {
      Alert.alert('Rejection Reason Required', 'Please provide a reason for rejection');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('corporate_orders')
        .update({
          approval_status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: approvalNotes,
        })
        .eq('id', corporateOrderId);

      if (updateError) throw updateError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      Alert.alert('Order Rejected', 'The order has been rejected');
      setSelectedOrder(null);
      setApprovalNotes('');
      fetchPendingOrders();
    } catch (error) {
      console.error('Error rejecting order:', error);
      Alert.alert('Error', 'Failed to reject order');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingOrders();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pending Approvals</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading approvals...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Approvals</Text>
        <Text style={styles.subtitle}>{pendingOrders.length} request{pendingOrders.length !== 1 ? 's' : ''} pending</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {pendingOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <CheckCircle size={64} color="#10b981" />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>No pending approvals at the moment</Text>
          </View>
        ) : (
          pendingOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.orderHeaderLeft}>
                  <Package size={20} color="#f59e0b" />
                  <Text style={styles.orderId}>Order #{order.order_id.substring(0, 8)}</Text>
                </View>
                <Text style={styles.orderPrice}>${order.orders.total_price.toFixed(2)}</Text>
              </View>

              <View style={styles.orderDetail}>
                <User size={16} color="#6b7280" />
                <Text style={styles.orderDetailText}>
                  Requested by: {order.requested_by_profile?.full_name || 'Unknown'}
                </Text>
              </View>

              {order.department && (
                <View style={styles.orderDetail}>
                  <Package size={16} color="#6b7280" />
                  <Text style={styles.orderDetailText}>Department: {order.department.name}</Text>
                </View>
              )}

              <View style={styles.orderDetail}>
                <Calendar size={16} color="#6b7280" />
                <Text style={styles.orderDetailText}>
                  {new Date(order.created_at).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.locationContainer}>
                <View style={styles.locationRow}>
                  <MapPin size={16} color="#10b981" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {order.orders.pickup_address}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <MapPin size={16} color="#ef4444" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {order.orders.dropoff_address}
                  </Text>
                </View>
              </View>

              <View style={styles.packageInfo}>
                <Text style={styles.packageLabel}>Package:</Text>
                <Text style={styles.packageText}>{order.orders.package_description}</Text>
              </View>

              {selectedOrder === order.id && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes (optional for approval, required for rejection):</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Add notes..."
                    value={approvalNotes}
                    onChangeText={setApprovalNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}

              <View style={styles.actionButtons}>
                {selectedOrder === order.id ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => {
                        setSelectedOrder(null);
                        setApprovalNotes('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(order.id, order.order_id)}
                    >
                      <XCircle size={18} color="#ffffff" />
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(order.id, order.order_id)}
                    >
                      <CheckCircle size={18} color="#ffffff" />
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.reviewButton]}
                    onPress={() => setSelectedOrder(order.id)}
                  >
                    <Text style={styles.reviewButtonText}>Review Order</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
  },
  orderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  orderDetailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  locationContainer: {
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  packageInfo: {
    marginTop: 8,
    marginBottom: 12,
  },
  packageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  packageText: {
    fontSize: 14,
    color: '#374151',
  },
  notesContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  reviewButton: {
    backgroundColor: '#f59e0b',
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
