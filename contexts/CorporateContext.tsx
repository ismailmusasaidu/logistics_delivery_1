import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

export type CorporateRole = 'admin' | 'staff' | 'finance';

export interface CompanyStaff {
  id: string;
  company_id: string;
  user_id: string;
  role: CorporateRole;
  employee_id: string | null;
  is_active: boolean;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  billing_address: string | null;
  tax_id: string | null;
  payment_terms: string;
  requires_approval: boolean;
  credit_limit: number;
  is_active: boolean;
}

interface CorporateContextType {
  companyStaff: CompanyStaff | null;
  company: Company | null;
  loading: boolean;
  isCorporateUser: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isFinance: boolean;
  refreshCorporateData: () => Promise<void>;
}

const CorporateContext = createContext<CorporateContextType | undefined>(undefined);

export function CorporateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [companyStaff, setCompanyStaff] = useState<CompanyStaff | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCorporateData = async () => {
    if (!user) {
      setCompanyStaff(null);
      setCompany(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch company staff record
      const { data: staffData, error: staffError } = await supabase
        .from('company_staff')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (staffError) throw staffError;

      setCompanyStaff(staffData);

      // If user is corporate staff, fetch company details
      if (staffData) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', staffData.company_id)
          .single();

        if (companyError) throw companyError;
        setCompany(companyData);
      } else {
        setCompany(null);
      }
    } catch (error) {
      console.error('Error fetching corporate data:', error);
      setCompanyStaff(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorporateData();
  }, [user]);

  const isCorporateUser = !!companyStaff;
  const isAdmin = companyStaff?.role === 'admin';
  const isStaff = companyStaff?.role === 'staff';
  const isFinance = companyStaff?.role === 'finance';

  return (
    <CorporateContext.Provider
      value={{
        companyStaff,
        company,
        loading,
        isCorporateUser,
        isAdmin,
        isStaff,
        isFinance,
        refreshCorporateData: fetchCorporateData,
      }}
    >
      {children}
    </CorporateContext.Provider>
  );
}

export function useCorporate() {
  const context = useContext(CorporateContext);
  if (context === undefined) {
    throw new Error('useCorporate must be used within a CorporateProvider');
  }
  return context;
}
