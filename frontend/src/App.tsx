import { BrowserRouter } from 'react-router-dom'
import { Suspense } from 'react'
import { TopNavigation } from '@cloudscape-design/components'
import '@cloudscape-design/global-styles/index.css'
import { AppRouter } from '@/app/router'

function TopNav() {
  return (
    <TopNavigation
      identity={{
        href: '/insight/query',
        title: 'Trading Insight',
      }}
      utilities={[
        {
          type: 'button',
          text: 'Documentation',
          href: '/docs',
          external: true,
          externalIconAriaLabel: ' (opens in a new tab)',
        },
        {
          type: 'menu-dropdown',
          text: 'User',
          iconName: 'user-profile',
          items: [
            { id: 'profile', text: 'Profile' },
            { id: 'preferences', text: 'Preferences' },
            { id: 'settings', text: 'Settings' },
          ],
        },
      ]}
      i18nStrings={{
        searchIconAriaLabel: 'Search',
        searchDismissIconAriaLabel: 'Close search',
        overflowMenuTriggerText: 'More',
        overflowMenuTitleText: 'All',
        overflowMenuBackIconAriaLabel: 'Back',
        overflowMenuDismissIconAriaLabel: 'Close menu',
      }}
    />
  )
}

function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Suspense fallback={null}>
        <AppRouter />
      </Suspense>
    </BrowserRouter>
  )
}

export default App