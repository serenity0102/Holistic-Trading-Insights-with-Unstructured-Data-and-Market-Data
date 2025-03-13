import { ReactNode } from 'react';
import { BreadcrumbGroup } from '@cloudscape-design/components';
import { BaseLayout } from '@/shared/ui/base-layout';

interface InsightLayoutProps {
  children: ReactNode;
  activePage?: 'query' | 'reports' | 'add-report';
}

export function InsightLayout({ children, activePage = 'query' }: InsightLayoutProps) {
  const navigation = {
    header: { text: 'Trading Insight', href: '/insight/query' },
    items: [
      {
        type: 'section',
        text: 'Query',
        items: [
          { type: 'link', text: 'Query', href: '/insight/query' },
        ],
      },
      {
        type: 'section',
        text: 'Report Management',
        items: [
          { type: 'link', text: 'List Reports', href: '/insight/reports' },
        ],
      },
    ],
  } as const;

  // Define breadcrumb items based on active page
  let breadcrumbItems = [
    { text: "Trading Insight", href: "/insight/query" }
  ];
  
  if (activePage === 'query') {
    breadcrumbItems.push({ text: "Query", href: "/insight/query" });
  } else if (activePage === 'reports') {
    breadcrumbItems.push({ text: "Report Management", href: "/insight/reports" });
    breadcrumbItems.push({ text: "List Reports", href: "/insight/reports" });
  } else if (activePage === 'add-report') {
    breadcrumbItems.push({ text: "Report Management", href: "/insight/reports" });
    breadcrumbItems.push({ text: "Add Report", href: "/insight/add-report" });
  }

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