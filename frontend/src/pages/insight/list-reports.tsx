import { 
  Box, 
  ContentLayout,
  Header,
  SpaceBetween,
  Table,
  Button,
  Container,
  Link,
  Pagination,
} from '@cloudscape-design/components'
import { InsightLayout } from '@/features/insight/ui/insight-layout'

// Sample data for the reports table
const reports = [
  { id: '1', title: 'Q1 Market Analysis', date: '2025-01-15', author: 'John Smith', status: 'Published' },
  { id: '2', title: 'Tech Sector Overview', date: '2025-02-03', author: 'Jane Doe', status: 'Published' },
  { id: '3', title: 'Emerging Markets Report', date: '2025-02-28', author: 'Michael Johnson', status: 'Draft' },
  { id: '4', title: 'Cryptocurrency Trends', date: '2025-03-10', author: 'Sarah Williams', status: 'Published' },
];

function ReportsTable() {
  return (
    <Table
      columnDefinitions={[
        {
          id: 'title',
          header: 'Report Title',
          cell: item => <Link href={`/insight/reports/${item.id}`}>{item.title}</Link>,
          sortingField: 'title',
        },
        {
          id: 'date',
          header: 'Date',
          cell: item => item.date,
          sortingField: 'date',
        },
        {
          id: 'author',
          header: 'Author',
          cell: item => item.author,
          sortingField: 'author',
        },
        {
          id: 'status',
          header: 'Status',
          cell: item => item.status,
          sortingField: 'status',
        },
      ]}
      items={reports}
      loadingText="Loading reports"
      sortingDisabled
      empty={
        <Box textAlign="center" color="inherit">
          <b>No reports</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            No reports to display.
          </Box>
        </Box>
      }
      header={
        <Header
          counter={`(${reports.length})`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button href="/insight/add-report">Add report</Button>
            </SpaceBetween>
          }
        >
          Trading Reports
        </Header>
      }
      pagination={
        <Pagination
          currentPageIndex={1}
          pagesCount={1}
          ariaLabels={{
            nextPageLabel: 'Next page',
            previousPageLabel: 'Previous page',
            pageLabel: pageNumber => `Page ${pageNumber} of all pages`,
          }}
        />
      }
    />
  );
}

export default function ListReportsPage() {
  return (
    <InsightLayout activePage="reports">
      <ContentLayout
        header={
          <Header variant="h1">
            Report Management
          </Header>
        }
      >
        <Container>
          <SpaceBetween size="l">
            <ReportsTable />
          </SpaceBetween>
        </Container>
      </ContentLayout>
    </InsightLayout>
  )
}