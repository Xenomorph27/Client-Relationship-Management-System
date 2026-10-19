import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.jsx'
import { LoadingPanel } from './components/ui/Spinner.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Todo from './pages/Todo.jsx'
import Leads from './pages/Leads.jsx'
import Orders from './pages/Orders.jsx'
import Returns from './pages/Returns.jsx'
import Logistics from './pages/Logistics.jsx'
import Inventory from './pages/Inventory.jsx'
import Insights from './pages/Insights.jsx'
import Customers from './pages/Customers.jsx'
import Organisations from './pages/Organisations.jsx'
import Emails from './pages/Emails.jsx'
import Campaigns from './pages/Campaigns.jsx'
import People from './pages/People.jsx'
import NotFound from './pages/NotFound.jsx'

/**
 * Statistics is the only screen that pulls in a charting library, and recharts
 * is roughly 390 kB of the bundle on its own. Loading it eagerly would make
 * every visit pay for a screen most visits never open, so it is split out and
 * fetched on first navigation.
 */
const Statistics = lazy(() => import('./pages/Statistics.jsx'))

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="todo" element={<Todo />} />
        <Route
          path="statistics"
          element={
            <Suspense fallback={<LoadingPanel label="Loading statistics" />}>
              <Statistics />
            </Suspense>
          }
        />
        <Route path="leads" element={<Leads />} />
        <Route path="orders" element={<Orders />} />
        <Route path="returns" element={<Returns />} />
        <Route path="logistics" element={<Logistics />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="insights" element={<Insights />} />
        <Route path="customers" element={<Customers />} />
        <Route path="organisations" element={<Organisations />} />
        <Route path="emails" element={<Emails />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="users" element={<People />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
