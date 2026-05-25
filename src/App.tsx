import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Components & Layout
import AuthGuard from './components/AuthGuard'
import AppLayout from './components/AppLayout'

// Pages (Phase 2 & 3)
import LoginPage from './features/auth/LoginPage'
import Dashboard from './features/dashboard/Dashboard'
import RequisitionForm from './features/requisition/RequisitionForm'
import PrintRequisition from './features/requisition/PrintRequisition'
import DispenseForm from './features/dispense/DispenseForm'
import ReceiveForm from './features/receive/ReceiveForm'
import StockBalancePage from './features/stock/StockBalancePage'
import NotificationsPage from './features/notifications/NotificationsPage'
import ProductManagementPage from './features/products/ProductManagementPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🔓 Public Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* 🔒 Protected Routes (มี Sidebar + Header ครอบทุกหน้า) */}
        <Route element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requisition/new" element={<RequisitionForm />} />
          <Route path="/dispense" element={<DispenseForm />} />
          <Route path="/receive" element={<ReceiveForm />} />
          <Route path="/stock" element={<StockBalancePage />} />
          <Route path="/products" element={<ProductManagementPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>

        {/* 🖨️ Route พิเศษ: พิมพ์ใบเบิก (ไม่ต้องมี Sidebar Layout ครอบ เพื่อให้ปรินต์เต็มหน้า A4 ได้) */}
        <Route path="/requisition/print/:id" element={
          <AuthGuard>
            <PrintRequisition />
          </AuthGuard>
        } />
        
        {/* Fallback route - ถ้าเข้า URL แปลกๆ ให้ปัดกลับหน้าแรก */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
