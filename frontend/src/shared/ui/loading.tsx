import { Box, Spinner } from '@cloudscape-design/components'

export function Loading() {
  return (
    <Box
      margin="xxl"
      padding="xxl"
      textAlign="center"
    >
      <Spinner size="large" />
    </Box>
  )
} 