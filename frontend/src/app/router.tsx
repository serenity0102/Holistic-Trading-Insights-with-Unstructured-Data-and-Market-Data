import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy } from 'react'

const InsightQueryPage = lazy(() => import('@/pages/insight/query'))
const InsightListReportsPage = lazy(() => import('@/pages/insight/list-reports'))
const InsightAddReportPage = lazy(() => import('@/pages/insight/add-report'))

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/insight/query" replace />}
      />
      <Route
        path="/insight/query"
        element={<InsightQueryPage />}
      />
      <Route
        path="/insight/reports"
        element={<InsightListReportsPage />}
      />
      <Route
        path="/insight/add-report"
        element={<InsightAddReportPage />}
      />
    </Routes>
  )
}