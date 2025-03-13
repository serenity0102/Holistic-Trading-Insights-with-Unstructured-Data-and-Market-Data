import { ReactNode } from 'react';
import { BreadcrumbGroup, Link } from '@cloudscape-design/components';
import { BaseLayout } from '@/shared/ui/base-layout';

interface ConsensusLayoutProps {
  children: ReactNode;
  activePage?: 'list' | 'create';
}

export function ConsensusLayout({ children, activePage = 'list' }: ConsensusLayoutProps) {
  const navigation = {
    header: { text: 'Consensus', href: '/consensus' },
    items: [
      {
        type: 'section',
        text: 'Manage',
        items: [
          { type: 'link', text: 'Dashboard', href: '/consensus' },
          { type: 'link', text: 'Requests', href: '/consensus/requests' },
          { type: 'link', text: 'Templates', href: '/consensus/templates' },
        ],
      },
      {
        type: 'section',
        text: 'Monitor & Configure',
        items: [
          { type: 'link', text: 'Reports', href: '/consensus/reports' },
          { type: 'link', text: 'Settings', href: '/consensus/settings' },
        ],
      },
    ],
  } as const;

  const breadcrumbItems = [
    { text: "Consensus", href: "/consensus" },
    ...(activePage === 'create' 
      ? [{ text: "Create Request" }]
      : [{ text: "Requests", href: "/consensus/requests" }]
    ),
  ];

  return (
    <BaseLayout
      navigation={navigation}
      breadcrumbs={
        <BreadcrumbGroup
          items={breadcrumbItems}
          ariaLabel="Breadcrumbs"
        />
      }
    >
      {children}
    </BaseLayout>
  );
} 