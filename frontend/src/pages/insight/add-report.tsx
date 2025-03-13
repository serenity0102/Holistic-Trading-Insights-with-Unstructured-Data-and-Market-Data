import { 
  Box, 
  ContentLayout,
  Header,
  SpaceBetween,
  FormField,
  Input,
  Button,
  Container,
  Textarea,
  Select,
} from '@cloudscape-design/components'
import { InsightLayout } from '@/features/insight/ui/insight-layout'

function AddReportForm() {
  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="Create a new trading insight report"
        >
          Add New Report
        </Header>
        
        <form>
          <SpaceBetween size="m">
            <FormField label="Report Title" required>
              <Input placeholder="Enter report title" />
            </FormField>
            
            <FormField label="Report Type" required>
              <Select
                options={[
                  { label: 'Market Analysis', value: 'market' },
                  { label: 'Sector Overview', value: 'sector' },
                  { label: 'Stock Analysis', value: 'stock' },
                  { label: 'Economic Forecast', value: 'economic' },
                ]}
                placeholder="Select report type"
              />
            </FormField>
            
            <FormField label="Related Symbols">
              <Input placeholder="Enter stock symbols (comma separated)" />
            </FormField>
            
            <FormField label="Report Content" required>
              <Textarea
                placeholder="Enter report content"
                rows={10}
              />
            </FormField>
            
            <FormField label="Attachments">
              <Button iconName="upload">Upload files</Button>
            </FormField>
            
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" href="/insight/reports">Cancel</Button>
              <Button variant="primary">Submit Report</Button>
            </SpaceBetween>
          </SpaceBetween>
        </form>
      </SpaceBetween>
    </Container>
  )
}

export default function AddReportPage() {
  return (
    <InsightLayout activePage="add-report">
      <ContentLayout
        header={
          <Header variant="h1">
            Add Report
          </Header>
        }
      >
        <AddReportForm />
      </ContentLayout>
    </InsightLayout>
  )
}