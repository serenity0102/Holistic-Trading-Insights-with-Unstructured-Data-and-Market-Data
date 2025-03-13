import { AppLayout, SideNavigation } from '@cloudscape-design/components'
import type { SideNavigationProps } from '@cloudscape-design/components/side-navigation'
import { type PropsWithChildren, type ReactNode } from 'react'

interface BaseLayoutProps extends PropsWithChildren {
  navigation: {
    header: SideNavigationProps['header']
    items: SideNavigationProps['items']
  }
  breadcrumbs?: ReactNode
}

export function BaseLayout({ children, navigation, breadcrumbs }: BaseLayoutProps) {
  return (
    <AppLayout
      navigation={<SideNavigation {...navigation} />}
      content={children}
      breadcrumbs={breadcrumbs}
      toolsHide
      
    />
  )
}