import React from 'react'
import { useApp } from '../../contexts/AppContext'
import SyncProgressBar from './SyncProgressBar'

const ConnectedSyncProgressBar = () => {
  const { state } = useApp()
  const { syncProgress } = state

  // Debug log para acompanhar mudanças no estado
  React.useEffect(() => {
    console.log('🎨 ConnectedSyncProgressBar - Estado do progresso:', syncProgress)
  }, [syncProgress])

  return (
    <SyncProgressBar
      isVisible={syncProgress.isVisible}
      progress={syncProgress.progress}
      step={syncProgress.step}
      type={syncProgress.type}
      contactsProcessed={syncProgress.contactsProcessed}
      totalContacts={syncProgress.totalContacts}
      chatsProcessed={syncProgress.chatsProcessed}
      totalChats={syncProgress.totalChats}
      status={syncProgress.status}
    />
  )
}

export default ConnectedSyncProgressBar