import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useCorporate } from '@/contexts/CorporateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, Package, MapPin, X, Layers } from 'lucide-react-native';
import BulkOrderModal from '@/components/BulkOrderModal';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface CorporateOrder {
  id: string;
  order_id: string;
  approval_status: string;
  created_at: string;
  department: { name: string } | null;
  orders: {
    pickup_address: string;
    dropoff_address: string;
    package_description: string;
    total_price: number;
    status: string;
  };
}

export default function CorporateDeliveries() {
  const { company, companyStaff, isFinance } = useCorporate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<CorporateOrder[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showBulkOrderModal, setShowBulkOrderModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  const [newOrder, setNewOrder] = useState({
    pickup_address: '',
    dropoff_address: '',
    package_description: '',
    department_id: '',
    po_number: '',
    internal_reference: '',
  });

  const fetchOrders = async () => {
    if (!company) return;

    try {
      const { data, error } = await supabase
        .from('corporate_orders')
        .select(`
          *,
          orders(pickup_address, dropoff_address, package_description, total_price, status),
          department:departments(name)
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDepartments = async () => {
    if (!company) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDepartments();

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
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [company]);

  const handleCreateOrder = async () => {
    if (!newOrder.pickup_address || !newOrder.dropoff_address || !newOrder.package_description) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    if (!company || !user) return;

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          pickup_address: newOrder.pickup_address,
          dropoff_address: newOrder.dropoff_address,
          package_description: newOrder.package_description,
          status: company.requires_approval ? 'draft' : 'pending',
          total_price: 0,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const { error: corporateOrderError } = await supabase
        .from('corporate_orders')
        .insert({
          order_id: orderData.id,
          company_id: company.id,
          department_id: newOrder.department_id || null,
          requested_by: user.id,
          approval_status: company.requires_approval ? 'pending' : 'approved',
          po_number: newOrder.po_number || null,
          internal_reference: newOrder.internal_reference || null,
        });

      if (corporateOrderError) throw corporateOrderError;

      Alert.alert(
        'Success',
        company.requires_approval
          ? 'Delivery request submitted for approval'
          : 'Delivery request created successfully'
      );

      setShowNewOrderModal(false);
      setNewOrder({
        pickup_address: '',
        dropoff_address: '',
        package_description: '',
        department_id: '',
        po_number: '',
        internal_reference: '',
      });
      fetchOrders();
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to create delivery request');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return order.orders.status === 'pending' || order.approval_status === 'pending';
    if (filter === 'active') return ['accepted', 'picked_up'].includes(order.orders.status);
    if (filter === 'completed') return order.orders.status === 'delivered';
    return true;
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Deliveries</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading deliveries...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Deliveries</Text>
        {!isFinance && (
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.bulkButton}
              onPress={() => setShowBulkOrderModal(true)}
            >
              <Layers size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowNewOrderModal(true)}
            >
              <Plus size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All ({orders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Package size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No deliveries found</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.orderHeaderLeft}>
                  <Package size={20} color="#f59e0b" />
                  <Text style={styles.orderId}>#{order.order_id.substring(0, 8)}</Text>
                </View>
                <View style={styles.badges}>
                  <StatusBadge status={order.orders.status} />
                  {order.approval_status === 'pending' && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending Approval</Text>
                    </View>
                  )}
                </View>
              </View>

              {order.department && (
                <Text style={styles.departmentText}>
                  Department: {order.department.name}
                </Text>
              )}

              <View style={styles.locationContainer}>
                <View style={styles.locationRow}>
                  <MapPin size={16} color="#10b981" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {order.orders.pickup_address}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <MapPin size={16} color="#ef4444" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {order.orders.dropoff_address}
                  </Text>
                </View>
              </View>

              <View style={styles.orderFooter}>
                <Text style={styles.packageText}>{order.orders.package_description}</Text>
                <Text style={styles.priceText}>${order.orders.total_price.toFixed(2)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showNewOrderModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Delivery Request</Text>
            <TouchableOpacity onPress={() => setShowNewOrderModal(false)}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Pickup Address *</Text>
            <TextInput
              style={styles.input}
              value={newOrder.pickup_address}
              onChangeText={(text) => setNewOrder({ ...newOrder, pickup_address: text })}
              placeholder="Enter pickup address"
            />

            <Text style={styles.label}>Dropoff Address *</Text>
            <TextInput
              style={styles.input}
              value={newOrder.dropoff_address}
              onChangeText={(text) => setNewOrder({ ...newOrder, dropoff_address: text })}
              placeholder="Enter dropoff address"
            />

            <Text style={styles.label}>Package Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newOrder.package_description}
              onChangeText={(text) => setNewOrder({ ...newOrder, package_description: text })}
              placeholder="Describe the package"
              multiline
              numberOfLines={3}
            />

            {departments.length > 0 && (
              <>
                <Text style={styles.label}>Department (Optional)</Text>
                <View style={styles.departmentPicker}>
                  {departments.map((dept) => (
                    <TouchableOpacity
                      key={dept.id}
                      style={[
                        styles.departmentOption,
                        newOrder.department_id === dept.id && styles.departmentOptionActive,
                      ]}
                      onPress={() => setNewOrder({ ...newOrder, department_id: dept.id })}
                    >
                      <Text
                        style={[
                          styles.departmentOptionText,
                          newOrder.department_id === dept.id && styles.departmentOptionTextActive,
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>PO Number (Optional)</Text>
            <TextInput
              style={styles.input}
              value={newOrder.po_number}
              onChangeText={(text) => setNewOrder({ ...newOrder, po_number: text })}
              placeholder="Purchase order number"
            />

            <Text style={styles.label}>Internal Reference (Optional)</Text>
            <TextInput
              style={styles.input}
              value={newOrder.internal_reference}
              onChangeText={(text) => setNewOrder({ ...newOrder, internal_reference: text })}
              placeholder="Internal tracking reference"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreateOrder}
            >
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BulkOrderModal
        visible={showBulkOrderModal}
        onClose={() => setShowBulkOrderModal(false)}
        onSuccess={() => {
          setShowBulkOrderModal(false);
          fetchOrders();
        }}
        companyId={company?.id || ''}
        departments={departments}
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkButton: {
    backgroundColor: '#8b5cf6',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#f59e0b',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#f59e0b',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
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
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
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
    marginBottom: 8,
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
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#d97706',
  },
  departmentText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  locationContainer: {
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  packageText: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f59e0b',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  departmentPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  departmentOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  departmentOptionActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  departmentOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  departmentOptionTextActive: {
    color: '#ffffff',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
