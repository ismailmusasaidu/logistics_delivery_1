import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useCorporate } from '@/contexts/CorporateContext';
import { supabase } from '@/lib/supabase';
import { Package, Clock, CheckCircle, XCircle, TrendingUp, DollarSign } from 'lucide-react-native';

interface DashboardStats {
  totalOrders: number;
  pendingApprovals: number;
  activeDeliveries: number;
  completedToday: number;
  monthlySpend: number;
  avgDeliveryTime: number;
}

export default function CorporateDashboard() {
  const { company } = useCorporate();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingApprovals: 0,
    activeDeliveries: 0,
    completedToday: 0,
    monthlySpend: 0,
    avgDeliveryTime: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = async () => {
    if (!company) return;

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: corporateOrders } = await supabase
        .from('corporate_orders')
        .select('*, orders(*)')
        .eq('company_id', company.id);

      const totalOrders = corporateOrders?.length || 0;
      const pendingApprovals = corporateOrders?.filter(co => co.approval_status === 'pending').length || 0;
      const activeDeliveries = corporateOrders?.filter(co =>
        co.orders?.status && ['pending', 'accepted', 'picked_up'].includes(co.orders.status)
      ).length || 0;
      const completedToday = corporateOrders?.filter(co =>
        co.orders?.status === 'delivered' &&
        new Date(co.orders.completed_at) >= todayStart
      ).length || 0;

      const monthlyOrders = corporateOrders?.filter(co =>
        new Date(co.created_at) >= monthStart
      ) || [];
      const monthlySpend = monthlyOrders.reduce((sum, co) =>
        sum + (co.orders?.total_price || 0), 0
      );

      setStats({
        totalOrders,
        pendingApprovals,
        activeDeliveries,
        completedToday,
        monthlySpend,
        avgDeliveryTime: 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [company]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardStats();
  };

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
    suffix = ''
  }: {
    icon: any;
    label: string;
    value: number | string;
    color: string;
    suffix?: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statIconContainer}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}{suffix}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          {company && <Text style={styles.companyName}>{company.name}</Text>}
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        {company && <Text style={styles.companyName}>{company.name}</Text>}
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon={Package}
          label="Total Orders"
          value={stats.totalOrders}
          color="#3b82f6"
        />
        <StatCard
          icon={Clock}
          label="Pending Approvals"
          value={stats.pendingApprovals}
          color="#f59e0b"
        />
        <StatCard
          icon={TrendingUp}
          label="Active Deliveries"
          value={stats.activeDeliveries}
          color="#10b981"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed Today"
          value={stats.completedToday}
          color="#8b5cf6"
        />
        <StatCard
          icon={DollarSign}
          label="Monthly Spend"
          value={`$${stats.monthlySpend.toFixed(2)}`}
          color="#ef4444"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton}>
          <Package size={20} color="#f59e0b" />
          <Text style={styles.actionButtonText}>View All Deliveries</Text>
        </TouchableOpacity>
        {stats.pendingApprovals > 0 && (
          <TouchableOpacity style={styles.actionButton}>
            <Clock size={20} color="#f59e0b" />
            <Text style={styles.actionButtonText}>
              Review {stats.pendingApprovals} Pending Approval{stats.pendingApprovals !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    color: '#6b7280',
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
  statsGrid: {
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIconContainer: {
    marginRight: 16,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
    fontWeight: '500',
  },
});
