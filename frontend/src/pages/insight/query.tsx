import { 
  ContentLayout,
  Grid,
  Header,
  SpaceBetween,
  FormField,
  Input,
  Button,
  Container,
  Box,
  ColumnLayout,
  LineChart,
  Table,
  Spinner,
} from '@cloudscape-design/components'
import { InsightLayout } from '@/features/insight/ui/insight-layout'
import { useState } from 'react'

// Sample data for the line chart
const lineChartData = {
  series: [
    {
      title: "Stock Price",
      type: "line",
      data: [
        { x: new Date(2023, 0, 1), y: 125 },
        { x: new Date(2023, 1, 1), y: 136 },
        { x: new Date(2023, 2, 1), y: 130 },
        { x: new Date(2023, 3, 1), y: 142 },
        { x: new Date(2023, 4, 1), y: 148 },
        { x: new Date(2023, 5, 1), y: 157 },
        { x: new Date(2023, 6, 1), y: 165 },
        { x: new Date(2023, 7, 1), y: 172 },
        { x: new Date(2023, 8, 1), y: 168 },
        { x: new Date(2023, 9, 1), y: 175 },
        { x: new Date(2023, 10, 1), y: 182 },
        { x: new Date(2023, 11, 1), y: 189 },
      ]
    },
    {
      title: "Industry Average",
      type: "line",
      data: [
        { x: new Date(2023, 0, 1), y: 120 },
        { x: new Date(2023, 1, 1), y: 125 },
        { x: new Date(2023, 2, 1), y: 128 },
        { x: new Date(2023, 3, 1), y: 132 },
        { x: new Date(2023, 4, 1), y: 138 },
        { x: new Date(2023, 5, 1), y: 142 },
        { x: new Date(2023, 6, 1), y: 145 },
        { x: new Date(2023, 7, 1), y: 150 },
        { x: new Date(2023, 8, 1), y: 153 },
        { x: new Date(2023, 9, 1), y: 158 },
        { x: new Date(2023, 10, 1), y: 162 },
        { x: new Date(2023, 11, 1), y: 165 },
      ]
    }
  ],
  xDomain: [new Date(2023, 0, 1), new Date(2023, 11, 1)],
  yDomain: [100, 200],
  xScaleType: "time",
  xTitle: "Date",
  yTitle: "Price ($)",
  hideFilter: true
};

// Separate component for the query form
const QueryForm = ({ 
  symbol, 
  setSymbol, 
  fromDate, 
  setFromDate, 
  toDate, 
  setToDate, 
  query, 
  setQuery, 
  onSubmit,
  loading
}) => {
  return (
    <form onSubmit={onSubmit}>
      <Grid
        gridDefinition={[
          { colspan: 2 },
          { colspan: 2 },
          { colspan: 2 },
          { colspan: 4 },
          { colspan: 2 }
        ]}
      >
        <FormField label="Symbol">
          <Input 
            placeholder="e.g., AAPL" 
            value={symbol}
            onChange={({ detail }) => setSymbol(detail.value)}
            disabled={loading}
          />
        </FormField>
        
        <FormField label="From">
          <Input 
            placeholder="e.g., 2024-Q4" 
            value={fromDate}
            onChange={({ detail }) => setFromDate(detail.value)}
            disabled={loading}
          />
        </FormField>
        
        <FormField label="To">
          <Input 
            placeholder="e.g., 2025-Q1" 
            value={toDate}
            onChange={({ detail }) => setToDate(detail.value)}
            disabled={loading}
          />
        </FormField>
        
        <FormField label="Analysis Query">
          <Input 
            placeholder="passenger traffic" 
            value={query}
            onChange={({ detail }) => setQuery(detail.value)}
            disabled={loading}
          />
        </FormField>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '7px' }}>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? (
              <SpaceBetween direction="horizontal" size="xs">
                <Spinner />
                <span>Running query...</span>
              </SpaceBetween>
            ) : (
              "Run Query"
            )}
          </Button>
        </div>
      </Grid>
    </form>
  );
};

// Separate component for the graph container
const GraphContainer = () => {
  return (
    <Container
      header={
        <Header variant="h2">Graph</Header>
      }
      style={{ height: '400px' }}
    >
      <LineChart
        series={lineChartData.series}
        xDomain={lineChartData.xDomain}
        yDomain={lineChartData.yDomain}
        xScaleType={lineChartData.xScaleType}
        xTitle={lineChartData.xTitle}
        yTitle={lineChartData.yTitle}
        hideFilter={lineChartData.hideFilter}
        height={300}
        ariaLabel="Stock price line chart"
        ariaDescription="Line chart showing stock price trends over time compared to industry average."
      />
    </Container>
  );
};

// Separate component for the reference container
const ReferenceContainer = ({ referenceData, loading, error }) => {
  return (
    <Container
      header={
        <Header 
          variant="h2"
          counter={loading ? undefined : `(${referenceData.length})`}
          actions={
            loading && <Spinner size="normal" />
          }
        >
          Reference
        </Header>
      }
      style={{ height: '400px' }}
    >
      <div style={{ height: '300px', overflow: 'auto' }}>
        {error && (
          <Box color="text-status-error" padding="s">
            Error loading data: {error}
          </Box>
        )}
        
        <Table
          columnDefinitions={[
            {
              id: "date",
              header: "Date",
              cell: item => item.date,
              sortingField: "date",
              width: 100,
            },
            {
              id: "score",
              header: "Relevancy",
              cell: item => item.score ? item.score.toFixed(2) : 'N/A',
              width: 100,
            },
            {
              id: "excerpt",
              header: "Excerpt",
              cell: item => item.excerpt,
              minWidth: "400px",
            },
          ]}
          items={referenceData}
          sortingDisabled
          variant="embedded"
          stripedRows
          stickyHeader
          loading={loading}
          loadingText="Loading reference data"
          empty={
            <Box textAlign="center" color="inherit">
              <b>No references found</b>
              <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                Try adjusting your search criteria.
              </Box>
            </Box>
          }
        />
      </div>
    </Container>
  );
};

export default function QueryPage() {
  const [symbol, setSymbol] = useState('BA');
  const [fromDate, setFromDate] = useState('2018-Q3');
  const [toDate, setToDate] = useState('2018-Q3');
  const [query, setQuery] = useState('quality');
  const [referenceData, setReferenceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchReferenceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `https://t6tqj0umm2.execute-api.us-east-1.amazonaws.com/local/search?ticker=${symbol}&reportStart=${fromDate}&reportEnd=${toDate}&query=${query}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform API response to match our table structure
      if (data.results && Array.isArray(data.results)) {
        const transformedData = data.results.map(item => ({
          date: item.reportDate || 'N/A',
          excerpt: item.extraction || 'No excerpt available',
          score: item.score || 0,
        }));
        
        setReferenceData(transformedData);
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (err) {
      console.error('Error fetching reference data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const handleRunQuery = (e) => {
    e.preventDefault();
    fetchReferenceData();
  };

  return (
    <InsightLayout activePage="query">
      <ContentLayout>
        <Box padding={{ top: 'l' }}>
          <SpaceBetween size="l">
            <Container>
              <SpaceBetween size="l">
                <Header
                  variant="h1"
                  description="Search and analyze trading data"
                >
                  Query Trading Insights
                </Header>
                
                <QueryForm
                  symbol={symbol}
                  setSymbol={setSymbol}
                  fromDate={fromDate}
                  setFromDate={setFromDate}
                  toDate={toDate}
                  setToDate={setToDate}
                  query={query}
                  setQuery={setQuery}
                  onSubmit={handleRunQuery}
                  loading={loading}
                />
              </SpaceBetween>
            </Container>
            
            {hasSearched && (
              <ColumnLayout columns={2} variant="text-grid">
                <GraphContainer />
                <ReferenceContainer 
                  referenceData={referenceData}
                  loading={loading}
                  error={error}
                />
              </ColumnLayout>
            )}
            
            {!hasSearched && (
              <Box textAlign="center" color="inherit" padding={{ top: 'xxxl', bottom: 'xxxl' }}>
                <SpaceBetween size="m">
                  <b>Enter your search criteria and click "Run Query" to see results</b>
                  <div>Results will appear here after you run a query.</div>
                </SpaceBetween>
              </Box>
            )}
          </SpaceBetween>
        </Box>
      </ContentLayout>
    </InsightLayout>
  );
}