import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Components & Layout
import AuthGuard from './components/AuthGuard'
import AppLayout from './components/AppLayout'

// Pages (Phase 2 & 3)
import LoginPage from './features/auth/LoginPage'
import Dashboard from './features/dashboard/Dashboard'
import RequisitionForm from './features/requisition/RequisitionForm'
import PrintRequisition from './features/requisition/PrintRequisition'
import RequisitionHistory from './features/requisition/RequisitionHistory'
import IssueForm from './features/issue/IssueForm'
import ReceiveForm from './features/receive/ReceiveForm'
import ExpiredForm from './features/expired/ExpiredForm'
import ExpiryTrackingPage from './features/expiry_tracking/ExpiryTrackingPage'
import StockBalancePage from './features/stock/StockBalancePage'
import StockAdjustmentPage from './features/stock/StockAdjustmentPage'
import NotificationsPage from './features/notifications/NotificationsPage'
import ProductManagementPage from './features/products/ProductManagementPage'
import OfficerManagementPage from './features/officers/OfficerManagementPage'
import UserManagementPage from './features/users/UserManagementPage'
import SettingsPage from './features/settings/SettingsPage'
import StockCardReport from './features/reports/StockCardReport'
import MovementReports from './features/reports/MovementReports'
import PrintMovement from './features/reports/PrintMovement'
import NegativeStockReport from './features/reports/NegativeStockReport'
import NegativeStockAnalysis from './features/reports/NegativeStockAnalysis'
import PrintLabelPage from './features/stock/PrintLabelPage'
import DatabaseManagementPage from './features/database/DatabaseManagementPage'
import KeyboardShortcutsPage from './features/help/KeyboardShortcutsPage'
import UnfulfilledReport from './features/reports/UnfulfilledReport'
import InventoryAnalysisReport from './features/reports/InventoryAnalysisReport'

// Borrow / Return System
import BorrowReturnPage from './features/borrow/BorrowReturnPage'
import BorrowForm from './features/borrow/BorrowForm'
import ReturnForm from './features/borrow/ReturnForm'

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
          <Route path="/requisition/edit/:id" element={<RequisitionForm />} />
          <Route path="/requisition/history" element={<RequisitionHistory />} />
          <Route path="/issue" element={<IssueForm />} />
          <Route path="/expired" element={<ExpiredForm />} />
          <Route path="/expiry-tracking" element={<ExpiryTrackingPage />} />
          <Route path="/receive" element={<ReceiveForm />} />
          <Route path="/stock" element={<StockBalancePage />} />
          <Route path="/stock/adjust" element={<StockAdjustmentPage />} />
          <Route path="/stock/labels" element={<PrintLabelPage />} />
          <Route path="/borrow" element={<BorrowReturnPage />} />
          <Route path="/borrow/new" element={<BorrowForm />} />
          <Route path="/borrow/return/:id" element={<ReturnForm />} />
          <Route path="/reports/stock-card" element={<StockCardReport />} />
          <Route path="/reports/movements" element={<MovementReports />} />
          <Route path="/reports/print-movement" element={<PrintMovement />} />
          <Route path="/reports/negative-stock" element={<NegativeStockReport />} />
          <Route path="/reports/negative-stock/analysis" element={<NegativeStockAnalysis />} />
          <Route path="/reports/unfulfilled" element={<UnfulfilledReport />} />
          <Route path="/reports/inventory-analysis" element={<InventoryAnalysisReport />} />
          <Route path="/products" element={<ProductManagementPage />} />
          <Route path="/officers" element={<OfficerManagementPage />} />
          <Route path="/users" element={<UserManagementPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/database" element={<DatabaseManagementPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/help/shortcuts" element={<KeyboardShortcutsPage />} />
        </Route>

        {/* 🖨️ Route พิเศษ: พิมพ์ใบเบิก (ไม่ต้องมี Sidebar Layout ครอบ เพื่อให้ปรินต์เต็มหน้า A4 ได้) */}
        <Route path="/requisition/print/:id" element={
          <AuthGuard>
            <PrintRequisition />
          </AuthGuard>
        } />
        
        <Route path="/movement/print/:id" element={
          <AuthGuard>
            <PrintMovement />
          </AuthGuard>
        } />
        
        {/* Fallback route - ถ้าเข้า URL แปลกๆ ให้ปัดกลับหน้าแรก */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
