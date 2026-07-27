import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/admin/AdminShell';
import { OverviewModule } from '../components/admin/OverviewModule';
import { OrdersVendorsModule } from '../components/admin/OrdersVendorsModule';
import { UsersModule } from '../components/admin/UsersModule';
import { ConfigEmergencyModule } from '../components/admin/ConfigEmergencyModule';
import { SystemLogsModule } from '../components/admin/SystemLogsModule';
import '../components/admin/admin_dashboard.css';

const AdminControlCenter = () => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('overview');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('sgu_user');
    if (!userData) {
      navigate('/login', { replace: true });
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'admin') {
      navigate('/login', { replace: true });
      return;
    }
    setUser(parsedUser);
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
      {activeModule === 'users' && <UsersModule />}
      {activeModule === 'config' && <ConfigEmergencyModule />}
      {activeModule === 'logs' && <SystemLogsModule />}
    </AdminShell>
  );
};

export default AdminControlCenter;
