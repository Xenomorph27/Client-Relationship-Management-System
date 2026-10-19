import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Button } from '../components/ui/Button.jsx'

export default function NotFound() {
  return (
    <Screen>
      <PageHeader title="Not found" />
      <Panel>
        <EmptyState
          icon={Compass}
          title="There is no screen at this address"
          body="Check the link, or head back to the overview."
          action={
            <Link to="/">
              <Button variant="primary">Go to overview</Button>
            </Link>
          }
        />
      </Panel>
    </Screen>
  )
}
