import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useCorporate } from '@/contexts/CorporateContext';
import { supabase } from '@/lib/supabase';
import { FileText, Download, Calendar, TrendingUp, DollarSign, Package } from 'lucide-react-native';

interface MonthlyStats {
  month: string;
  total_orders: number;
  total_spend: number;
  completed_orders: number;
}

export default function CorporateReports() {
  const { company } = useCorporate();
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [currentMonthStats, setCurrentMonthStats] = useState({
    orders: 0,
    spend: 0,
    avgPrice: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    if (!company) return;

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: corporateOrders } = await supabase
        .from('corporate_orders')
        .select(`
          *,
          orders(total_price, status, completed_at, created_at),
          department:departments(name)
        `)
        .eq('company_id', company.id);

      const currentMonthOrders = corporateOrders?.filter(co =>
        new Date(co.created_at) >= monthStart
      ) || [];

      const currentMonthSpend = currentMonthOrders.reduce((sum, co) =>
        sum + (co.orders?.total_price || 0), 0
      );

      const avgPrice = currentMonthOrders.length > 0
        ? currentMonthSpend / currentMonthOrders.length
        : 0;

      setCurrentMonthStats({
        orders: currentMonthOrders.length,
        spend: currentMonthSpend,
        avgPrice,
      });

      const monthlyData: { [key: string]: MonthlyStats } = {};
      corporateOrders?.forEach(co => {
        const date = new Date(co.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            total_orders: 0,
            total_spend: 0,
            completed_orders: 0,
          };
        }

        monthlyData[monthKey].total_orders++;
        monthlyData[monthKey].total_spend += co.orders?.total_price || 0;
        if (co.orders?.status === 'delivered') {
          monthlyData[monthKey].completed_orders++;
        }
      });

      const sortedMonthly = Object.values(monthlyData).sort((a, b) =>
        b.month.localeCompare(a.month)
      );

      setMonthlyStats(sortedMonthly);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [company]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const handleExportCSV = () => {
    Alert.alert('Export CSV', 'CSV export functionality would be implemented here');
  };

  const handleExportPDF = () => {
    Alert.alert('Export PDF', 'PDF export functionality would be implemented here');
  };

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reports & Analytics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports & Analytics</Text>
        {company && <Text style={styles.companyName}>{company.name}</Text>}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Month Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Package size={24} color="#3b82f6" />
              <Text style={styles.statValue}>{currentMonthStats.orders}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </View>
            <View style={styles.statCard}>
              <DollarSign size={24} color="#10b981" />
              <Text style={styles.statValue}>${currentMonthStats.spend.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Spend</Text>
            </View>
            <View style={styles.statCard}>
              <TrendingUp size={24} color="#f59e0b" />
              <Text style={styles.statValue}>${currentMonthStats.avgPrice.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Avg per Order</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Options</Text>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV}>
            <Download size={20} color="#3b82f6" />
            <View style={styles.exportButtonContent}>
              <Text style={styles.exportButtonTitle}>Download CSV</Text>
              <Text style={styles.exportButtonText}>Export detailed order data</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF}>
            <FileText size={20} color="#ef4444" />
            <View style={styles.exportButtonContent}>
              <Text style={styles.exportButtonTitle}>Download PDF Report</Text>
              <Text style={styles.exportButtonText}>Generate monthly summary</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly History</Text>
          {monthlyStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FileText size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No historical data available</Text>
            </View>
          ) : (
            monthlyStats.map((stat) => (
              <View key={stat.month} style={styles.monthCard}>
                <View style={styles.monthHeader}>
                  <Calendar size={20} color="#f59e0b" />
                  <Text style={styles.monthTitle}>{formatMonth(stat.month)}</Text>
                </View>
                <View style={styles.monthStats}>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Orders</Text>
                    <Text style={styles.monthStatValue}>{stat.total_orders}</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Completed</Text>
                    <Text style={styles.monthStatValue}>{stat.completed_orders}</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Total Spend</Text>
                    <Text style={styles.monthStatValue}>${stat.total_spend.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
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
  companyName: {
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  exportButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  exportButtonContent: {
    marginLeft: 16,
    flex: 1,
  },
  exportButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  exportButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  monthCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  monthStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  monthStat: {
    alignItems: 'center',
  },
  monthStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  monthStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
});
