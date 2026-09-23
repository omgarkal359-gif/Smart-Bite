import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/admin/AdminShell';
import { OverviewModule } from '../components/admin/OverviewModule';
import { OrdersVendorsModule } from '../components/admin/OrdersVendorsModule';
import { OnboardingModule } from '../components/admin/OnboardingModule';
import { SecurityLogsModule } from '../components/admin/SecurityLogsModule';
import { BackupsModule } from '../components/admin/BackupsModule';
import { SystemHealthModule } from '../components/admin/SystemHealthModule';
import { UserDirectoryModule } from '../components/admin/UserDirectoryModule';
import { MenuApprovalsModule } from '../components/admin/MenuApprovalsModule';
import { ConfigEmergencyModule } from '../components/admin/ConfigEmergencyModule';
import { getStoredUser, setStoredUser, clearStoredUser, checkAdminAccess } from '../utils/auth';
import { supabase } from '../supabaseClient';
import '../components/admin/admin_dashboard.css';

const AdminControlCenter = () => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('overview');
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function initUser() {
      let parsedUser = getStoredUser();
      if (!parsedUser || parsedUser.role !== 'admin') {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            const email = (data.session.user.email || '').toLowerCase().trim();
            if (await checkAdminAccess(email)) {
              parsedUser = {
                role: 'admin',
                name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name || 'System Admin',
                id: email,
                shopId: null,
                timestamp: new Date().toISOString()
              };
              setStoredUser(parsedUser, true);
              setUser(parsedUser);
              return;
            }
          }
        } catch (_e) {}

        clearStoredUser();
        navigate('/login', { replace: true });
        return;
      }
      setUser(parsedUser);
    }

    initUser();
  }, [navigate]);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#E4002B' }}>Verifying Super Admin Authorization...</div>
      </div>
    );
  }

  return (
    <AdminShell activeModule={activeModule} setActiveModule={setActiveModule} user={user}>
      {activeModule === 'overview' && <OverviewModule onNavigateModule={setActiveModule} />}
      {activeModule === 'orders' && <OrdersVendorsModule />}
      {activeModule === 'vendors' && <OnboardingModule />}
      {activeModule === 'menu-approvals' && <MenuApprovalsModule />}
      {activeModule === 'security-logs' && <SecurityLogsModule />}
      {activeModule === 'backups' && <BackupsModule />}
      {activeModule === 'system-health' && <SystemHealthModule />}
      {activeModule === 'users' && <UserDirectoryModule />}
      {activeModule === 'config' && <ConfigEmergencyModule />}
    </AdminShell>
  );
};

export default AdminControlCenter;
